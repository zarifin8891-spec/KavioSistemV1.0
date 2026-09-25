import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canViewPath, normalizeRole } from './lib/kavio-permissions';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: accessRows } = user
    ? await supabase.rpc('kavio_get_current_access')
    : { data: null };

  const access = accessRows?.[0] ?? { role: 'USER', status_aktif: true };
  const role = normalizeRole(access.role);
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/auth');

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (user && access.status_aktif !== true) {
    const logoutResponse = NextResponse.redirect(new URL('/login?akses=nonaktif', request.url));
    return logoutResponse;
  }

  if (user && !isPublicRoute && !canViewPath(role, pathname)) {
    return NextResponse.redirect(new URL('/dashboard?akses=ditolak', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
