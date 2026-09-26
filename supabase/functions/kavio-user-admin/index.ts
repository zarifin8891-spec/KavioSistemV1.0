import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Body =
  | { action: "list" }
  | { action: "create"; email: string; password: string; nama: string; role: string }
  | { action: "update_profile"; user_id: string; nama: string; role: string; status_aktif: boolean }
  | { action: "set_password"; user_id: string; password: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const allowedRoles = new Set(["DIREKTUR", "ADMIN", "MARKETING", "PELAKSANA", "USER"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: "Konfigurasi Supabase Function belum lengkap." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: managerProfile, error: managerError } = await admin
      .from("user_profiles")
      .select("role,status_aktif")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (
      managerError ||
      !managerProfile ||
      managerProfile.status_aktif !== true ||
      !["DIREKTUR", "ADMIN"].includes(managerProfile.role)
    ) {
      return json({ error: "Akses ditolak." }, 403);
    }

    const body = (req.method === "GET" ? { action: "list" } : await req.json()) as Body;

    if (body.action === "list") {
      const [{ data: authUsers, error: usersError }, { data: profiles, error: profilesError }] =
        await Promise.all([
          admin.auth.admin.listUsers({ perPage: 1000 }),
          admin.from("user_profiles").select("user_id,nama,role,status_aktif"),
        ]);

      if (usersError) return json({ error: usersError.message }, 400);
      if (profilesError) return json({ error: profilesError.message }, 400);

      const profileMap = new Map((profiles ?? []).map((p) => [String(p.user_id), p]));

      const data = (authUsers?.users ?? []).map((u) => {
        const p = profileMap.get(u.id);
        return {
          user_id: u.id,
          email: u.email ?? null,
          nama: p?.nama ?? null,
          role: p?.role ?? "USER",
          status_aktif: p?.status_aktif ?? true,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        };
      });

      return json({ data });
    }

    if (body.action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const nama = String(body.nama ?? "").trim();
      const role = String(body.role ?? "").trim().toUpperCase();
      const password = String(body.password ?? "");

      if (!email || !email.includes("@")) return json({ error: "Email tidak valid." }, 400);
      if (password.length < 8) return json({ error: "Password minimal 8 karakter." }, 400);
      if (!allowedRoles.has(role)) return json({ error: "Role tidak valid." }, 400);

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError || !created.user) {
        return json({ error: createError?.message ?? "Gagal membuat user." }, 400);
      }

      const { error: profileError } = await admin
        .from("user_profiles")
        .upsert({
          user_id: created.user.id,
          nama: nama || null,
          role,
          status_aktif: true,
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: profileError.message }, 400);
      }

      return json({ ok: true, user_id: created.user.id });
    }

    if (body.action === "set_password") {
      const userId = String(body.user_id ?? "").trim();
      const password = String(body.password ?? "");

      if (!userId) return json({ error: "User ID wajib." }, 400);
      if (password.length < 8) return json({ error: "Password minimal 8 karakter." }, 400);

      const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
      if (targetError || !target.user) return json({ error: "User tidak ditemukan." }, 404);

      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);

      return json({ ok: true });
    }

    if (body.action === "update_profile") {
      const userId = String(body.user_id ?? "").trim();
      const role = String(body.role ?? "").trim().toUpperCase();
      const nama = String(body.nama ?? "").trim();
      const statusAktif = body.status_aktif === true;

      if (!userId) return json({ error: "User ID wajib." }, 400);
      if (!allowedRoles.has(role)) return json({ error: "Role tidak valid." }, 400);
      if (userId === authData.user.id && (role !== "DIREKTUR" && role !== "ADMIN" || !statusAktif)) {
        return json({ error: "Akun yang sedang digunakan tidak boleh kehilangan akses Manajemen User." }, 400);
      }

      const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
      if (targetError || !target.user) return json({ error: "User tidak ditemukan." }, 404);

      const { data: targetProfile, error: profileReadError } = await admin
        .from("user_profiles")
        .select("role,status_aktif")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileReadError) return json({ error: profileReadError.message }, 400);

      const targetWasManager =
        targetProfile?.status_aktif === true &&
        ["DIREKTUR", "ADMIN"].includes(targetProfile.role);

      const targetWillBeManager =
        statusAktif && ["DIREKTUR", "ADMIN"].includes(role);

      if (targetWasManager && !targetWillBeManager) {
        const { count, error: managerCountError } = await admin
          .from("user_profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("status_aktif", true)
          .in("role", ["DIREKTUR", "ADMIN"]);

        if (managerCountError) return json({ error: managerCountError.message }, 400);
        if ((count ?? 0) <= 1) {
          return json({ error: "Tidak dapat menonaktifkan atau menurunkan role manager terakhir." }, 400);
        }
      }

      const { error } = await admin
        .from("user_profiles")
        .upsert({
          user_id: userId,
          nama: nama || null,
          role,
          status_aktif: statusAktif,
          updated_at: new Date().toISOString(),
        });

      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Action tidak dikenali." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Terjadi kesalahan." }, 500);
  }
});
