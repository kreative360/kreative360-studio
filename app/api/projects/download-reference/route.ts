import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, fileName } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Falta la URL de la imagen" },
        { status: 400 }
      );
    }

    // Descargar la imagen desde el servidor (sin CORS)
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Error descargando imagen: ${response.status}`);
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    // Detectar tipo de contenido
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Devolver la imagen como descarga
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error en descarga de referencia:", error);
    return NextResponse.json(
      { error: "Error al descargar imagen de referencia" },
      { status: 500 }
    );
  }
}