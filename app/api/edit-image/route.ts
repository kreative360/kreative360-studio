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

    console.log("📡 Llamando a FAL API...");

    // Construir el body según el modo
    const requestBody: any = {
      prompt: editPrompt,
      image_url: `data:image/jpeg;base64,${imageBase64}`,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: false,
      output_format: "jpeg",
      sync_mode: true,
    };

    // Si es modo local, añadir la máscara
    if (editMode === "local" && maskBase64) {
      requestBody.mask_url = `data:image/png;base64,${maskBase64}`;
      requestBody.strength = 0.95;
    } else {
      // Modo global - solo image-to-image
      requestBody.strength = 0.75;
    }

    // Llamar a FAL
    const response = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    console.log("📥 Respuesta de FAL:", {
      status: response.status,
      ok: response.ok,
      hasImages: !!data.images,
    });

    if (!response.ok) {
      console.error("❌ Error de FAL:", data);
      return NextResponse.json(
        { 
          success: false, 
          error: data.detail || data.error || "Error en FAL API" 
        },
        { status: response.status }
      );
    }

    // Verificar que tenemos imágenes
    if (!data.images || !data.images[0] || !data.images[0].url) {
      console.error("❌ No se recibió imagen en la respuesta");
      return NextResponse.json(
        { success: false, error: "No se generó imagen" },
        { status: 500 }
      );
    }

    // Descargar la imagen y convertir a base64
    console.log("📥 Descargando imagen editada...");
    const imageUrl = data.images[0].url;
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    console.log("✅ Imagen editada generada exitosamente");

    return NextResponse.json({
      success: true,
      image: {
        base64: base64Image,
        url: imageUrl,
      },
    });

  } catch (error: any) {
    console.error("❌ Error en edit-image:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Error interno del servidor" 
      },
      { status: 500 }
    );
  }
}