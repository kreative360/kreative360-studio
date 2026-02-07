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

// 🆕 DETECTAR ASPECT RATIO Y GENERAR INSTRUCCIONES
function getAspectRatioInstruction(width, height) {
  const aspectRatio = width / height;
  
  // Cuadrado (margen de ±5%)
  if (aspectRatio >= 0.95 && aspectRatio <= 1.05) {
    return "Generate in SQUARE format (1:1 aspect ratio). Compose the entire subject within the frame without cropping.";
  }
  
  // Vertical (portrait)
  if (aspectRatio < 0.95) {
    if (aspectRatio <= 0.5) {
      // Muy vertical: 9:16, 21:9 vertical, etc
      return "Generate in VERY TALL VERTICAL format (portrait, 9:16 or taller aspect ratio). Compose the full scene vertically from top to bottom. DO NOT crop the subject. Show the complete subject within the vertical frame.";
    }
    // Vertical normal: 2:3, 3:4, 4:5
    return "Generate in VERTICAL format (portrait, 2:3 or 3:4 aspect ratio). Compose the full scene vertically. DO NOT crop the subject. Show the complete subject within the vertical frame.";
  }
  
  // Horizontal (landscape)
  if (aspectRatio > 1.05) {
    if (aspectRatio >= 2) {
      // Muy horizontal: 16:9, 21:9, etc
      return "Generate in VERY WIDE HORIZONTAL format (landscape, 16:9 or wider aspect ratio). Compose the full scene horizontally from left to right. DO NOT crop the subject. Show the complete subject within the horizontal frame.";
    }
    // Horizontal normal: 4:3, 3:2
    return "Generate in HORIZONTAL format (landscape, 4:3 or 3:2 aspect ratio). Compose the full scene horizontally. DO NOT crop the subject. Show the complete subject within the horizontal frame.";
  }
  
  return "";
}

// ==============================================
// GENERACIÓN UNIFICADA (SDK)
// ==============================================
export async function generateImage(prompt, refs = [], engine = "standard", width = 1024, height = 1024) {
  // 🔧 MAPEO CORRECTO DE MODELOS (basado en Pictulab)
  const modelName = engine === "pro" || engine === "v3"
    ? "gemini-3-pro-image-preview"      // Pro (Gemini 3.0)
    : "gemini-2.5-flash-image";         // Standard (Gemini 2.5 Flash)

  const model = genAI.getGenerativeModel({
    model: modelName,
  });

  // 🆕 AÑADIR INSTRUCCIONES DE ASPECT RATIO
  const aspectRatioInstruction = getAspectRatioInstruction(width, height);
  
  console.log(`🎨 [GEMINI] Generating ${width}x${height} (${(width/height).toFixed(2)}:1) → ${aspectRatioInstruction.substring(0, 50)}...`);

  // Prompt PRO → más contexto (igual que Pic2Lab)
  const finalPrompt =
    engine === "pro" || engine === "v3"
      ? `
${prompt}

${aspectRatioInstruction}

Ultra high quality.
Professional commercial photography.
Perfect lighting, sharp focus, realistic textures.
No artifacts. No distortions. Clean background.
`.trim()
      : `${prompt}\n\n${aspectRatioInstruction}`;

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