import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY!);

export async function POST(request: Request) {
  try {
    console.log("🎨 Iniciando edición local con Gemini...");

    const { imageBase64, maskBase64, editPrompt, width, height, referenceImage } = await request.json();

    if (!imageBase64 || !maskBase64 || !editPrompt) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    console.log("📦 Datos recibidos:", {
      hasImage: !!imageBase64,
      hasMask: !!maskBase64,
      hasReferenceImage: !!referenceImage, // 🆕
      prompt: editPrompt,
    });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
    });

    // ✨ PROMPT mejorado con referencia si existe
    let enhancedPrompt = `Edit this image: ${editPrompt}

IMPORTANT RULES:
- Only modify the areas marked in white in the mask
- Keep everything else EXACTLY the same
- Maintain the same composition, lighting, and perspective
- The mask indicates where to apply changes
- Areas in black in the mask should remain untouched`;

    // 🆕 Si hay imagen de referencia, añadir instrucciones adicionales
    if (referenceImage) {
      enhancedPrompt += `

REFERENCE IMAGE PROVIDED:
- An additional reference image has been provided
- Use this reference image as a guide for the modifications
- Match the style, appearance, and details from the reference image
- Apply the reference to the masked areas only`;
    }

    const parts: any = [
      { text: enhancedPrompt },
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg",
        },
      },
      {
        inlineData: {
          data: maskBase64,
          mimeType: "image/png",
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

    console.log("🔮 Generando con Gemini...");

    // ✨ CLAVE: Usar generateContent con configuración específica
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    } as any);

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

    console.log("✅ Imagen editada correctamente");

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
        hasMask: true,
        hasReferenceImage: !!referenceImage, // 🆕
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