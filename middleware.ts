import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canViewPath, normalizeRole } from './lib/kavio-permissions';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return NextResponse.next({ request });

  const forwardedHeaders = new Headers(request.headers);
  ['x-kavio-user-email', 'x-kavio-role', 'x-kavio-actions', 'x-kavio-access-ready'].forEach((name) => forwardedHeaders.delete(name));
  let refreshedCookies: { name: string; value: string; options?: any }[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        refreshedCookies = cookiesToSet;
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: accessRows, error: accessError } = user
    ? await supabase.rpc('kavio_get_current_access_context')
    : { data: null, error: null };

  const access = accessRows?.[0] ?? { role: 'USER', status_aktif: true, actions: [] };
  const role = normalizeRole(access.role);
  const actions = Array.isArray(access.actions) ? access.actions : [];
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/auth');
  const hasBrowserSession = request.cookies.get('kavio_browser_session')?.value === '1';

  const applyCookies = (response: NextResponse) => {
    refreshedCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  };

  const redirectTo = (path: string) => applyCookies(NextResponse.redirect(new URL(path, request.url)));

  if (!user && !isPublicRoute) return redirectTo('/login');
  if (user && !isPublicRoute && !hasBrowserSession) return redirectTo('/login?session=berakhir');
  if (user && access.status_aktif !== true && pathname !== '/login') return redirectTo('/login?akses=nonaktif');
  if (user && pathname === '/login' && hasBrowserSession) return redirectTo('/dashboard');
  if (user && !isPublicRoute && !canViewPath(role, pathname)) return redirectTo('/dashboard?akses=ditolak');

  if (user && !isPublicRoute) {
    forwardedHeaders.set('x-kavio-user-email', user.email ?? '');
    forwardedHeaders.set('x-kavio-role', role);
    forwardedHeaders.set('x-kavio-actions', actions.join(','));
    forwardedHeaders.set('x-kavio-access-ready', accessError ? '0' : '1');
  }

  return applyCookies(NextResponse.next({ request: { headers: forwardedHeaders } }));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
