import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const { imageBase64, editPrompt, width, height } = await request.json();

    if (!imageBase64 || !editPrompt) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    console.log("🎨 Editando con Gemini (Global):", editPrompt);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
    });

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: "image/jpeg",
      },
    };

    const fullPrompt = `You are an expert image editor. Your task is to modify the provided image based on these instructions:

"${editPrompt}"

IMPORTANT RULES:
- Maintain the EXACT same composition, perspective, and overall structure
- Only modify what is explicitly requested in the instructions
- Keep all other elements unchanged
- Preserve the original dimensions (${width}x${height}px)
- Return a high-quality edited version of this specific image

Generate the edited image now.`;

    const result = await model.generateContent([fullPrompt, imagePart]);
    const response = result.response;
    
    const candidates = response.candidates;
    
    if (!candidates || candidates.length === 0) {
      console.error("❌ No se generó imagen");
      return NextResponse.json(
        { success: false, error: "No se generó imagen editada" },
        { status: 500 }
      );
    }

    let generatedImageBase64: string | null = null;
    
    for (const candidate of candidates) {
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData?.mimeType.startsWith("image/")) {
            generatedImageBase64 = part.inlineData.data;
            break;
          }
        }
      }
      if (generatedImageBase64) break;
    }

    if (!generatedImageBase64) {
      console.error("❌ No se encontró imagen en la respuesta");
      return NextResponse.json(
        { success: false, error: "No se generó imagen" },
        { status: 500 }
      );
    }

    console.log("✅ Imagen editada correctamente con Gemini");

    return NextResponse.json({
      success: true,
      image: {
        base64: generatedImageBase64,
        width,
        height,
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