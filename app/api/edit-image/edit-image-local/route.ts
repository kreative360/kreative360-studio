import { NextResponse } from "next/server";

const FAL_KEY = process.env.FAL_KEY;

export async function POST(request: Request) {
  try {
    console.log("🔵 Iniciando edición local con FAL...");

    const body = await request.json();
    const { imageBase64, maskBase64, editPrompt, width, height } = body;

    console.log("📦 Datos recibidos:", {
      hasImage: !!imageBase64,
      hasMask: !!maskBase64,
      prompt: editPrompt,
      dimensions: `${width}x${height}`,
    });

    if (!imageBase64 || !maskBase64 || !editPrompt) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    if (!FAL_KEY) {
      return NextResponse.json(
        { success: false, error: "FAL_KEY no configurada" },
        { status: 500 }
      );
    }

    console.log("🎨 Editando con FAL (Local/Inpainting):", editPrompt);

    const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;
    const maskDataUrl = `data:image/png;base64,${maskBase64}`;

    // FLUX Dev con inpainting
    const requestBody = {
      image_url: imageDataUrl,
      mask_url: maskDataUrl,
      prompt: editPrompt,
      strength: 0.95,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: false,
      sync_mode: true,
    };

    console.log("📡 Llamando a FAL API...");

    const response = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("📥 Respuesta FAL status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error de FAL:", errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Respuesta de FAL:", data);

    const imageUrl = data.images?.[0]?.url || data.image?.url;

    if (!imageUrl) {
      console.error("❌ No se generó imagen:", data);
      throw new Error("No se generó imagen");
    }

    console.log("📥 Descargando imagen editada...");
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error("Error descargando imagen generada");
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64Result = Buffer.from(imageBuffer).toString("base64");

    console.log("✅ Imagen editada correctamente con FAL");

    return NextResponse.json({
      success: true,
      image: {
        base64: imageBase64Result,
        width,
        height,
      },
    });

  } catch (error: any) {
    console.error("❌ Error en edición local:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error procesando imagen" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;
