import { NextResponse } from "next/server";
import sharp from "sharp";
import { PRESETS } from "../../../lib/presets";
import { generateImage } from "../../../lib/gemini";

export const runtime = "nodejs";

type ApiImage = { base64: string; mime?: string };

// =========================
// Utils
// =========================
function isBase64(ref: string) {
  return ref.startsWith("data:image/");
}

async function refToBase64(ref: string): Promise<string> {
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

// =========================
// POST – generación masiva
// =========================
export async function POST(req: Request) {
  try {
    // 🔑 VERIFICAR SI ES LLAMADA INTERNA
    const internalSecret = req.headers.get('x-internal-secret');
    const isInternalCall = internalSecret === process.env.INTERNAL_API_SECRET;
    
    // Si NO es llamada interna, aquí iría la verificación de auth
    // Pero como tu auth está en middleware, lo manejamos en el PASO 3
    if (!isInternalCall) {
      // Por ahora, permitimos que el middleware maneje la auth
      // Si el middleware ya bloqueó, nunca llegaríamos aquí
      console.log("⚠️ [GENERATE] No internal secret provided - relying on middleware auth");
    } else {
      console.log("✅ [GENERATE] Internal call authenticated");
    }

    const body = JSON.parse(await req.text());

    const refsRaw: string[] = Array.isArray(body.refs) ? body.refs : [];
    const presetId = String(body.presetId || "");
    const count = Math.max(1, Math.min(Number(body.count) || 1, 6));

    // 🔹 Tamaño y formato
    const width = Number(body.width) || 1024;
    const height = Number(body.height) || 1024;
    const format = String(body.format || "jpg").toLowerCase();

    console.log(`📐 [GENERATE] Requested size: ${width}x${height} (aspect ratio ${(width/height).toFixed(2)}:1)`);

    // 🔹 Motor IA
    // standard → v2 | pro → v3
    const engine =
      body.model === "pro" || body.engine === "pro" ? "v3" : "v2";

    // Prompt
    let prompt = (body.overridePrompt || "").trim();
    if (!prompt) {
      const preset = PRESETS.find((p) => p.id === presetId);
      prompt = preset?.prompt || "";
    }
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "Falta prompt." },
        { status: 400 }
      );
    }

    if (!refsRaw.length) {
      return NextResponse.json(
        { ok: false, error: "Faltan imágenes de referencia." },
        { status: 400 }
      );
    }

    // refs → base64
    const refs: string[] = [];
    for (const r of refsRaw.slice(0, 6)) {
      refs.push(await refToBase64(r));
    }

    // =========================
    // GENERACIÓN + PROCESADO
    // =========================
    const images: ApiImage[] = [];

    for (let i = 0; i < count; i++) {
      // 🆕 PASAR WIDTH Y HEIGHT A GEMINI
      const img = await generateImage(prompt, refs, engine, width, height);
      const processed = await resizeAndFormat300DPI(
        img,
        width,
        height,
        format
      );
      images.push(processed);
    }

    return NextResponse.json(
      {
        ok: true,
        presetId,
        width,
        height,
        format,
        engine,
        images,
        prompt_used: prompt,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}

// =========================
// Resize + formato + 300 DPI
// =========================
async function resizeAndFormat300DPI(
  imgIn: ApiImage,
  width: number,
  height: number,
  format: string
): Promise<ApiImage> {
  const input = Buffer.from(imgIn.base64, "base64");

  // 🆕 CAMBIO CRÍTICO: "contain" en lugar de "cover"
  // "cover" → RECORTA para llenar el área (❌ problema anterior)
  // "contain" → MANTIENE PROPORCIONES sin recortar (✅ solución)
  let img = sharp(input, { limitInputPixels: false })
    .rotate()
    .resize(width, height, { 
      fit: "contain",           // ✅ NO recorta, mantiene proporciones
      background: "#FFFFFF"      // Fondo blanco si hay espacios
    });

  let finalBuf: Buffer;
  let mime = "";

  switch (format) {
    case "png":
      finalBuf = await img
        .png()
        .withMetadata({ density: 300 })
        .toBuffer();
      mime = "image/png";
      break;

    case "webp":
      finalBuf = await img
        .webp({ quality: 95 })
        .withMetadata({ density: 300 })
        .toBuffer();
      mime = "image/webp";
      break;

    case "bmp":
      // BMP no soporta DPI → usamos PNG con density 300
      finalBuf = await img
        .png()
        .withMetadata({ density: 300 })
        .toBuffer();
      mime = "image/bmp";
      break;

    default:
      finalBuf = await img
        .jpeg({ quality: 95 })
        .withMetadata({ density: 300 })
        .toBuffer();
      mime = "image/jpeg";
      break;
  }

  console.log(`✅ [RESIZE] Processed to ${width}x${height} with fit:contain (NO CROP)`);

  return {
    base64: finalBuf.toString("base64"),
    mime,
  };
}