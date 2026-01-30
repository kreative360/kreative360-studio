import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { 
      productName, 
      imageUrl, 
      mode = "global",
      imagesCount,
      globalParams,
      specificPrompts 
    } = await request.json();

    console.log(`\n🧠 [ANALYZE] Starting analysis...`);
    console.log(`📦 [ANALYZE] Product: ${productName || "(sin nombre)"}`);
    console.log(`🖼️ [ANALYZE] Image: ${imageUrl}`);
    console.log(`🎯 [ANALYZE] Mode: ${mode}, Images: ${imagesCount}`);

    // Validaciones
    if (!imageUrl) {
      console.error("❌ [ANALYZE] Missing imageUrl");
      return NextResponse.json(
        { success: false, error: "imageUrl is required" },
        { status: 400 }
      );
    }

    if (!imagesCount || imagesCount < 1) {
      console.error("❌ [ANALYZE] Invalid imagesCount:", imagesCount);
      return NextResponse.json(
        { success: false, error: "imagesCount must be >= 1" },
        { status: 400 }
      );
    }

    if (mode === "specific" && (!specificPrompts || specificPrompts.length !== imagesCount)) {
      console.error("❌ [ANALYZE] Specific prompts mismatch:", { 
        expected: imagesCount, 
        got: specificPrompts?.length 
      });
      return NextResponse.json(
        { success: false, error: `specificPrompts must have exactly ${imagesCount} elements` },
        { status: 400 }
      );
    }

    // 1. OBTENER LA IMAGEN
    console.log("📥 [ANALYZE] Fetching image...");
    const imageRes = await fetch(imageUrl);
    
    if (!imageRes.ok) {
      console.error(`❌ [ANALYZE] Image fetch failed: ${imageRes.status} ${imageRes.statusText}`);
      throw new Error(`Failed to fetch image: ${imageRes.status} ${imageRes.statusText}`);
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    console.log(`✅ [ANALYZE] Image fetched (${(imageBuffer.byteLength / 1024).toFixed(2)} KB)`);

    // 2. CONSTRUIR PROMPT SEGÚN EL MODO
    let masterPrompt = "";

    if (mode === "global") {
      console.log("📝 [ANALYZE] Using GLOBAL mode");
      console.log(`📝 [ANALYZE] Global params: ${globalParams}`);

      masterPrompt = `You are an expert product photographer and prompt engineer.

TASK: Analyze this product and generate ${imagesCount} specialized photography prompts.

PRODUCT INFO:
${productName ? `Name: ${productName}` : "Name: Not provided"}

USER'S GLOBAL REQUIREMENTS (apply to ALL ${imagesCount} images):
${globalParams || "Create hyperrealistic product photography, respecting the original design 100%"}

YOUR JOB:
1. IDENTIFY what type of product this is (be very specific)
2. GENERATE ${imagesCount} UNIQUE prompts that:
   - Are tailored specifically for THIS type of product
   - Incorporate the user's global requirements in ALL prompts
   - Show the product in ${imagesCount} DIFFERENT realistic scenarios
   - Vary in composition, lighting, angle, and context
   - Each prompt MUST be completely DIFFERENT from the others
   - Are professional and detailed

RESPOND IN THIS EXACT JSON FORMAT:
{
  "product_type": "specific product type",
  "description": "brief description",
  "confidence": 0.95,
  "prompts": [
    "Prompt 1: detailed prompt here...",
    "Prompt 2: detailed prompt here...",
    ${Array(Math.max(0, imagesCount - 2)).fill('    "Prompt N: detailed prompt here..."').join(',\n')}
  ]
}

CRITICAL: Generate EXACTLY ${imagesCount} prompts, each one UNIQUE.`;

    } else {
      console.log("📝 [ANALYZE] Using SPECIFIC mode");
      console.log(`📝 [ANALYZE] Specific prompts:`, specificPrompts);

      const specificList = specificPrompts
        .map((spec: string, i: number) => `${i + 1}. ${spec}`)
        .join('\n');

      masterPrompt = `You are an expert product photographer and prompt engineer.

TASK: Analyze this product and adapt ${imagesCount} user-specified requirements into professional prompts.

PRODUCT INFO:
${productName ? `Name: ${productName}` : "Name: Not provided"}

USER'S SPECIFIC REQUIREMENTS (one per image):
${specificList}

YOUR JOB:
1. IDENTIFY what type of product this is (be very specific)
2. For EACH of the ${imagesCount} specifications above:
   - ADAPT it to this specific product type
   - Make it professional and detailed
   - Preserve the user's intent but make it product-appropriate
   - Add technical photography details

EXAMPLES:
- User says: "fondo blanco" 
  → You adapt: "Modern [product] on pure white background, front view, professional studio lighting, commercial photography style"
  
- User says: "lifestyle scene"
  → You adapt: "[Product] in realistic home setting, naturally placed, ambient lighting, lifestyle photography"

RESPOND IN THIS EXACT JSON FORMAT:
{
  "product_type": "specific product type",
  "description": "brief description",
  "confidence": 0.95,
  "prompts": [
    "Adapted prompt 1 based on user spec 1...",
    "Adapted prompt 2 based on user spec 2...",
    ${Array(Math.max(0, imagesCount - 2)).fill('    "Adapted prompt N based on user spec N..."').join(',\n')}
  ]
}

CRITICAL: 
- Generate EXACTLY ${imagesCount} prompts
- Each prompt MUST correspond to its user specification
- Maintain the ORDER of specifications`;
    }

    // 3. LLAMAR A GEMINI
    console.log("🤖 [ANALYZE] Calling Gemini API...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      },
      masterPrompt,
    ]);

    const responseText = result.response.text().trim();
    console.log("📤 [ANALYZE] Gemini response received");

    // 4. PARSEAR RESPUESTA
    let jsonText = responseText;
    if (jsonText.includes("```json")) {
      jsonText = jsonText.split("```json")[1].split("```")[0].trim();
    } else if (jsonText.includes("```")) {
      jsonText = jsonText.split("```")[1].split("```")[0].trim();
    }

    console.log("🔍 [ANALYZE] Parsing JSON response...");
    const analysis = JSON.parse(jsonText);

    // 5. VALIDAR QUE TENGA LA CANTIDAD CORRECTA
    if (!analysis.prompts || analysis.prompts.length !== imagesCount) {
      console.error(`❌ [ANALYZE] Prompt count mismatch:`, {
        expected: imagesCount,
        got: analysis.prompts?.length || 0
      });
      return NextResponse.json(
        { success: false, error: `Generated ${analysis.prompts?.length || 0} prompts but expected ${imagesCount}` },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [ANALYZE] SUCCESS - ${duration}ms`);
    console.log(`📊 [ANALYZE] Product type: ${analysis.product_type}`);
    console.log(`📊 [ANALYZE] Confidence: ${analysis.confidence}`);
    console.log(`📊 [ANALYZE] Prompts generated: ${analysis.prompts.length}\n`);

    return NextResponse.json({
      success: true,
      product_type: analysis.product_type,
      description: analysis.description,
      confidence: analysis.confidence || 0.9,
      prompts: analysis.prompts,
      mode,
      images_count: imagesCount,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [ANALYZE] FAILED - ${duration}ms`);
    console.error(`❌ [ANALYZE] Error:`, error.message);
    console.error(`❌ [ANALYZE] Stack:`, error.stack);
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}