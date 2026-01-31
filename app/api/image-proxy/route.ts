import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    console.log("🖼️ Proxy sirviendo imagen:", imageUrl);

    // Descargar la imagen
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    // Obtener el buffer de la imagen
    const imageBuffer = await imageResponse.arrayBuffer();

    // Determinar el content-type
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Devolver la imagen con headers CORS apropiados
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    });

  } catch (error: any) {
    console.error("❌ Error en image-proxy:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}