import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canViewPath, normalizeRole } from './lib/kavio-permissions';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname === '/login';
  const isAuthRoute = pathname.startsWith('/auth');
  const isPublicRoute = isLoginRoute || isAuthRoute;
  const browserSessionToken = request.cookies.get('kavio_browser_session')?.value ?? '';
  const hasBrowserSession = browserSessionToken.length > 0;

  // Browser-close policy can be resolved locally. Avoid any Supabase round-trip
  // when a private request no longer has the page-session binding.
  if (!isPublicRoute && !hasBrowserSession) {
    return NextResponse.redirect(new URL('/login?session=berakhir', request.url));
  }

  // A fresh login page does not need an auth/access lookup until login succeeds.
  if (isPublicRoute && !hasBrowserSession) {
    return NextResponse.next({ request });
  }

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

  const authStartedAt = Date.now();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  let claims = claimsData?.claims;
  let authenticated = Boolean(claims?.sub);
  let userEmail = typeof claims?.email === 'string' ? claims.email : '';
  let authDuration = Date.now() - authStartedAt;

  // Compatibility fallback for projects/tokens where local claim verification
  // is unavailable. The normal navigation path stays on getClaims().
  if (!authenticated && claimsError) {
    const fallbackStartedAt = Date.now();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authDuration += Date.now() - fallbackStartedAt;
    authenticated = Boolean(user);
    userEmail = user?.email ?? '';
  }

  const accessStartedAt = Date.now();
  const { data: accessRows, error: accessError } = authenticated
    ? await supabase.rpc('kavio_get_current_access_context')
    : { data: null, error: null };
  const accessDuration = Date.now() - accessStartedAt;

  const access = accessRows?.[0] ?? { role: 'USER', status_aktif: false, actions: [] };
  const accessReady = Boolean(authenticated && !accessError && accessRows?.[0]);
  const role = normalizeRole(access.role);
  const actions = Array.isArray(access.actions) ? access.actions : [];

  const applyCookies = (response: NextResponse) => {
    refreshedCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    response.headers.set(
      'Server-Timing',
      `kavio-auth;dur=${authDuration}, kavio-access;dur=${accessDuration}`,
    );
    return response;
  };

  const redirectTo = (path: string) => applyCookies(NextResponse.redirect(new URL(path, request.url)));

  if (!authenticated && !isPublicRoute) return redirectTo('/login');
  if (authenticated && !isPublicRoute && !accessReady) return redirectTo('/login?akses=gagal');
  if (authenticated && !isPublicRoute && access.status_aktif !== true) return redirectTo('/login?akses=nonaktif');
  if (authenticated && isLoginRoute && accessReady && access.status_aktif === true) return redirectTo('/dashboard');
  if (authenticated && !isPublicRoute && !canViewPath(role, pathname)) return redirectTo('/dashboard?akses=ditolak');

  if (authenticated && !isPublicRoute) {
    forwardedHeaders.set('x-kavio-user-email', userEmail);
    forwardedHeaders.set('x-kavio-role', role);
    forwardedHeaders.set('x-kavio-actions', actions.join(','));
    forwardedHeaders.set('x-kavio-access-ready', accessReady ? '1' : '0');
  }

  return applyCookies(NextResponse.next({ request: { headers: forwardedHeaders } }));
}

export const config = {
  // siteplan-image performs its own authenticated check; excluding it prevents
  // a duplicate middleware auth/access round-trip for the same image request.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/siteplan-image).*)'],
};
