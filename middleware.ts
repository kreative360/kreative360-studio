import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 🔐 CONTRASEÑA SIMPLE PARA EL SITIO
const SITE_PASSWORD = process.env.SITE_PASSWORD || "kreative2024";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ PERMITIR LLAMADAS INTERNAS (API-to-API)
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret && internalSecret === process.env.INTERNAL_API_SECRET) {
    console.log('✅ [MIDDLEWARE] Internal call authenticated:', pathname);
    return NextResponse.next();
  }

  // ✅ PERMITIR RUTAS PÚBLICAS (APIs que el frontend necesita)
  const publicRoutes = [
    '/api/auth/login',           // Login
    '/api/generate',             // ⭐ CRÍTICO: Permitir generación de imágenes
    '/api/projects/list',
    '/api/projects/images',
    '/api/workflows/list',
    '/api/prompts/list',
    '/api/prompts/folders',
    '/_next',
    '/favicon',
  ];
  
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // 🔐 PROTEGER RESTO DE RUTAS (páginas y APIs sensibles)
  const authCookie = request.cookies.get('site-auth');
  
  // Si no hay cookie de auth y no es la página de login
  if (!authCookie && pathname !== '/auth/login') {
    // Redirigir a login
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Verificar cookie
  if (authCookie && authCookie.value !== SITE_PASSWORD) {
    // Cookie inválida, redirigir a login
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};