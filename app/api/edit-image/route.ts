import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const {
      imageBase64,
      maskBase64,
      editPrompt,
      editMode,
      width,
      height,
    } = await request.json();

    console.log("🎨 Edit-image recibido:", {
      hasImage: !!imageBase64,
      hasMask: !!maskBase64,
      mode: editMode,
      prompt: editPrompt,
    });

    if (!imageBase64 || !editPrompt) {
      return NextResponse.json(
        { success: false, error: "Imagen y prompt son requeridos" },
        { status: 400 }
      );
    }

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return NextResponse.json(
        { success: false, error: "FAL_KEY no configurada" },
        { status: 500 }
      );
    }

    // Determinar el endpoint según el modo
    let endpoint = "";
    let requestBody: any = {
      prompt: editPrompt,
      image_size: {
        width: width || 1024,
        height: height || 1024,
      },
      num_images: 1,
    };

    if (editMode === "local" && maskBase64) {
      // MODO LOCAL: Inpainting con máscara
      endpoint = "https://queue.fal.run/fal-ai/flux/dev/image-to-image";
      requestBody.image_url = `data:image/jpeg;base64,${imageBase64}`;
      requestBody.mask_url = `data:image/png;base64,${maskBase64}`;
      requestBody.strength = 0.95; // Más transformación en área seleccionada
    } else {
      // MODO GLOBAL: Image-to-image sin máscara
      endpoint = "https://queue.fal.run/fal-ai/flux/dev/image-to-image";
      requestBody.image_url = `data:image/jpeg;base64,${imageBase64}`;
      requestBody.strength = 0.75; // Menos transformación, mantener estructura
    }

    console.log("📡 Llamando a FAL:", endpoint);

    // Llamar a la API de FAL
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error de FAL:", errorText);
      return NextResponse.json(
        { success: false, error: "Error en la API de FAL: " + response.statusText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("✅ Respuesta de FAL:", data);

    // Extraer la URL de la imagen generada
    const imageUrl = data.images?.[0]?.url || data.image?.url;

    if (!imageUrl) {
      console.error("❌ No se encontró URL de imagen en respuesta:", data);
      return NextResponse.json(
        { success: false, error: "No se generó imagen" },
        { status: 500 }
      );
    }

    // Descargar la imagen y convertirla a base64
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    return NextResponse.json({
      success: true,
      image: {
        base64: base64Image,
        url: imageUrl,
        mime: "image/jpeg",
      },
    });

  } catch (error: any) {
    console.error("❌ Error fatal en edit-image:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}