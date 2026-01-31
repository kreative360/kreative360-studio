import { NextResponse } from "next/server";

const SITE_PASSWORD = process.env.SITE_PASSWORD || "kreative2024";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (password === SITE_PASSWORD) {
      const response = NextResponse.json({ success: true });
      
      // Establecer cookie que dura 7 días
      response.cookies.set('site-auth', SITE_PASSWORD, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 días
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Contraseña incorrecta' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error del servidor' },
      { status: 500 }
    );
  }
}
