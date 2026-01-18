import { NextResponse } from "next/server";

const FAL_KEY = process.env.FAL_KEY;

export async function POST(request: Request) {
  try {
    const { imageBase64, maskBase64, editPrompt, width, height } = await request.json();

    if (!imageBase64 || !maskBase64 || !editPrompt) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    console.log("🎨 Editando con FAL (Local/Inpainting):", editPrompt);

    const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;
    const maskDataUrl = `data:image/png;base64,${maskBase64}`;

    const response = await fetch("https://fal.run/fal-ai/flux-pro/v1.1/redux", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageDataUrl,
        mask_url: maskDataUrl,
        prompt: editPrompt,
        sync_mode: true,
        image_size: {
          width,
          height,
        },
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Error de FAL:", errorData);
      throw new Error(errorData.detail || errorData.error || "Error en FAL API");
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
