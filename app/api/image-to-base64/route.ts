import { NextResponse } from "next/server";

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

    console.log("🖼️ Convirtiendo imagen a base64:", imageUrl);

    // Descargar la imagen
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    // Obtener el buffer
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convertir a base64
    const base64 = buffer.toString('base64');
    
    // Determinar el content-type
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    
    // Construir data URL
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log("✅ Imagen convertida, tamaño:", base64.length, "caracteres");

    return NextResponse.json({
      success: true,
      dataUrl,
      size: base64.length,
    });

  } catch (error: any) {
    console.error("❌ Error en image-to-base64:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}