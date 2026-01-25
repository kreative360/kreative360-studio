// ==============================================
// GOOGLE IMAGE GENERATION — STANDARD + PRO (SDK)
// ==============================================

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) throw new Error("Falta GOOGLE_API_KEY o GEMINI_API_KEY");

const genAI = new GoogleGenerativeAI(API_KEY);

// ==============================================
// Utils
// ==============================================
function isBase64(ref) {
  return (
    ref.startsWith("data:image/") ||
    /^[A-Za-z0-9+/=]+$/.test(ref.slice(0, 40))
  );
}

async function refToBase64(ref) {
  if (isBase64(ref)) {
    return ref.replace(/^data:image\/\w+;base64,/, "");
  }

  const res = await fetch(ref);
  if (!res.ok) {
    throw new Error(`No se pudo descargar la imagen: ${ref}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

// ==============================================
// GENERACIÓN UNIFICADA (SDK)
// ==============================================
export async function generateImage(prompt, refs = [], engine = "standard") {
  // 🔧 MAPEO CORRECTO DE MODELOS (basado en Pictulab)
  const modelName = engine === "pro" || engine === "v3"
    ? "gemini-3-pro-image-preview"      // Pro (Gemini 3.0)
    : "gemini-2.5-flash-image";         // Standard (Gemini 2.5 Flash)

  const model = genAI.getGenerativeModel({
    model: modelName,
  });

  // Prompt PRO → más contexto (igual que Pic2Lab)
  const finalPrompt =
    engine === "pro" || engine === "v3"
      ? `
${prompt}

Ultra high quality.
Professional commercial photography.
Perfect lighting, sharp focus, realistic textures.
No artifacts. No distortions. Clean background.
`.trim()
      : prompt;

  const parts = [{ text: finalPrompt }];

  // refs → inlineData (máx 5)
  for (const r of refs.slice(0, 5)) {
    const base64 = await refToBase64(r);
    parts.push({
      inlineData: {
        data: base64,
        mimeType: "image/jpeg",
      },
    });
  }

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: {
      maxOutputTokens: 2048,
    },
  });

  const img =
    result.response?.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.mimeType.startsWith("image/")
    );

  if (!img) {
    throw new Error("Gemini no devolvió ninguna imagen.");
  }

  return {
    base64: img.inlineData.data,
    mime: img.inlineData.mimeType || "image/jpeg",
  };
}