import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY!);

export async function POST(request: Request) {
  try {
    const { imageBase64, editPrompt, width, height, referenceImage } = await request.json();

    if (!imageBase64 || !editPrompt) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    console.log("🎨 Editando con Gemini (Global):", editPrompt);
    console.log("📦 Datos recibidos:", {
      hasImage: !!imageBase64,
      hasReferenceImage: !!referenceImage, // 🆕
      prompt: editPrompt,
    });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
    });

    // 🆕 Mejorar prompt si hay imagen de referencia
    let enhancedPrompt = editPrompt;
    
    if (referenceImage) {
      enhancedPrompt = `${editPrompt}

REFERENCE IMAGE PROVIDED:
- An additional reference image has been provided
- Use this reference image as a guide for the modifications
- Match the style, appearance, and details from the reference image
- Apply the reference throughout the entire image`;
    }

    const parts: any = [
      { text: enhancedPrompt },
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg",
        },
      },
    ];

    // 🆕 Añadir imagen de referencia si existe
    if (referenceImage) {
      parts.push({
        inlineData: {
          data: referenceImage,
          mimeType: "image/jpeg",
        },
      });
      console.log("🖼️ Imagen de referencia incluida en la petición");
    }

    // Llamada directa con array de parts
    const result = await model.generateContent(parts);

    // Extraer imagen
    const img = result.response?.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData && p.inlineData.mimeType.startsWith("image/")
    );

    if (!img) {
      console.error("❌ No se generó imagen");
      return NextResponse.json(
        { success: false, error: "No se generó imagen editada" },
        { status: 500 }
      );
    }

    console.log("✅ Imagen editada correctamente con Gemini");

    return NextResponse.json({
      success: true,
      image: {
        base64: img.inlineData.data,
        width,
        height,
      },
      metadata: {
        model: "gemini-2.5-flash-image",
        prompt: enhancedPrompt,
        originalPrompt: editPrompt,
        hasReferenceImage: !!referenceImage, // 🆕
      },
    });

  } catch (error: any) {
    console.error("❌ Error en edición global:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error procesando imagen" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;