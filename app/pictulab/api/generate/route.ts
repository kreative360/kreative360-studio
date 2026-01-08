// app/pictulab/api/generate/route.ts
import { NextResponse } from "next/server";
import sharp from "sharp";
import { generateImage } from "../../../../lib/gemini";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const body = JSON.parse(raw || "{}");

    const prompt = body.prompt || "";
    const refs = Array.isArray(body.refs) ? body.refs : [];
    const width = Number(body.width) || 1024;
    const height = Number(body.height) || 1024;
    const format = String(body.format || "jpg").toLowerCase();

    // =====================================================
    // MOTOR IA
    // standard → v2 | pro → v3 (NanoBanana Pro)
    // =====================================================
    const engine = body.model === "pro" ? "v3" : "v2";

    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "Falta prompt." },
        { status: 400 }
      );
    }

    // =====================================================
    // GENERACIÓN IA
    // =====================================================
    const imgObj = await generateImage(prompt, refs, engine);

    if (!imgObj?.base64) {
      throw new Error("La IA no devolvió imagen.");
    }

    const input = Buffer.from(imgObj.base64, "base64");

    // =====================================================
    // PROCESADO: tamaño exacto + 300 DPI
    // =====================================================
    let img = sharp(input, { limitInputPixels: false })
      .rotate()
      .resize(width, height, { fit: "cover" });

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
          .webp()
          .withMetadata({ density: 300 })
          .toBuffer();
        mime = "image/webp";
        break;

      case "bmp":
        // BMP no soportado → PNG con DPI 300
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

    return NextResponse.json(
      {
        ok: true,
        image: {
          base64: finalBuf.toString("base64"),
          mime,
          width,
          height,
          dpi: 300,
        },
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


