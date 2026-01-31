import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// 🔧 FUNCIÓN PARA OBTENER BASE URL
function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return "http://localhost:3000";
}

// 🧠 FUNCIÓN INLINE: ANALIZAR Y GENERAR PROMPTS
async function analyzeAndGeneratePrompts(
  productName: string,
  imageUrl: string,
  mode: string,
  imagesCount: number,
  globalParams?: string,
  specificPrompts?: string[]
) {
  try {
    console.log("🧠 [ANALYZE] Starting analysis inline...");
    
    // 1. FETCH IMAGE
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch image: ${imageRes.status} ${imageRes.statusText}`);
    }
    
    const imageBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    console.log(`✅ [ANALYZE] Image fetched (${(imageBuffer.byteLength / 1024).toFixed(2)} KB)`);

    // 2. CONSTRUIR PROMPT SEGÚN MODO
    let masterPrompt = "";

    if (mode === "global") {
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
      const specificList = specificPrompts!
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

CRITICAL: Generate EXACTLY ${imagesCount} prompts.`;
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

    // 4. PARSEAR JSON
    let jsonText = responseText;
    if (jsonText.includes("```json")) {
      jsonText = jsonText.split("```json")[1].split("```")[0].trim();
    } else if (jsonText.includes("```")) {
      jsonText = jsonText.split("```")[1].split("```")[0].trim();
    }

    const analysis = JSON.parse(jsonText);

    // 5. VALIDAR
    if (!analysis.prompts || analysis.prompts.length !== imagesCount) {
      throw new Error(`Generated ${analysis.prompts?.length || 0} prompts but expected ${imagesCount}`);
    }

    console.log(`✅ [ANALYZE] SUCCESS - Product: ${analysis.product_type}, Prompts: ${analysis.prompts.length}`);

    return {
      success: true,
      product_type: analysis.product_type,
      description: analysis.description,
      confidence: analysis.confidence || 0.9,
      prompts: analysis.prompts,
    };
  } catch (error: any) {
    console.error(`❌ [ANALYZE] Error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// 🔧 FUNCIÓN INLINE: PROCESAR UN ITEM COMPLETO
async function processItemInline(workflowId: string, itemId: string, baseUrl: string) {
  const startTime = Date.now();
  let itemReference = "unknown";

  try {
    // 1. OBTENER WORKFLOW Y ITEM
    console.log(`📦 [PROCESS-ITEM] Fetching workflow and item...`);
    
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError) {
      throw new Error(`Workflow fetch failed: ${workflowError.message}`);
    }

    const { data: item, error: itemError } = await supabase
      .from("workflow_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (itemError) {
      throw new Error(`Item fetch failed: ${itemError.message}`);
    }

    if (!workflow || !item) {
      throw new Error("Workflow or item not found");
    }

    itemReference = item.reference;
    console.log(`✅ [PROCESS-ITEM] Found item: ${itemReference}`);

    // 2. MARCAR COMO PROCESSING
    await supabase
      .from("workflow_items")
      .update({ status: "processing" })
      .eq("id", itemId);

    // 3. ANALIZAR Y GENERAR PROMPTS (INLINE)
    console.log("🧠 [PROCESS-ITEM] Starting AI analysis...");
    
    const imageUrls = typeof item.image_urls === 'string' 
      ? JSON.parse(item.image_urls) 
      : item.image_urls;
    
    const firstImageUrl = imageUrls[0];
    console.log(`📸 [PROCESS-ITEM] Using reference image: ${firstImageUrl}`);

    const analyzeData = await analyzeAndGeneratePrompts(
      item.product_name,
      firstImageUrl,
      workflow.prompt_mode,
      workflow.images_per_reference,
      workflow.global_params,
      typeof workflow.specific_prompts === 'string'
        ? JSON.parse(workflow.specific_prompts)
        : workflow.specific_prompts
    );

    if (!analyzeData.success) {
      throw new Error(`Analysis failed: ${analyzeData.error}`);
    }

    console.log(`✅ [PROCESS-ITEM] Analysis successful - Product type: ${analyzeData.product_type}`);

    // 4. GUARDAR PROMPTS GENERADOS
    await supabase
      .from("workflow_items")
      .update({
        detected_product_type: analyzeData.product_type,
        detection_description: analyzeData.description,
        detection_confidence: analyzeData.confidence,
        generated_prompts: JSON.stringify(analyzeData.prompts),
      })
      .eq("id", itemId);

    // 5. GENERAR IMÁGENES
    console.log("🎨 [PROCESS-ITEM] Starting image generation...");
    const generatedImages = [];

    for (let i = 0; i < analyzeData.prompts!.length; i++) {
      const prompt = analyzeData.prompts![i];
      console.log(`🖼️ [PROCESS-ITEM] Generating image ${i + 1}/${analyzeData.prompts!.length}...`);

      try {
        const generateRes = await fetch(
          `${baseUrl}/api/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              refs: [firstImageUrl],
              count: 1,
              overridePrompt: prompt,
              engine: "v2",
            }),
          }
        );

        if (!generateRes.ok) {
          console.warn(`⚠️ [PROCESS-ITEM] Generate API returned ${generateRes.status} for image ${i + 1}`);
          continue;
        }

        const generateData = await generateRes.json();

        if (generateData.images && generateData.images.length > 0) {
          generatedImages.push({
            url: generateData.images[0],
            prompt: prompt,
            index: i + 1,
          });
          console.log(`✅ [PROCESS-ITEM] Image ${i + 1} generated successfully`);
        }
      } catch (imgError: any) {
        console.error(`❌ [PROCESS-ITEM] Error generating image ${i + 1}:`, imgError.message);
      }
    }

    console.log(`🎯 [PROCESS-ITEM] Generated ${generatedImages.length}/${analyzeData.prompts!.length} images`);

    // 6. GUARDAR IMÁGENES EN PROYECTO
    if (generatedImages.length > 0) {
      console.log("📦 [PROCESS-ITEM] Saving images to project...");
      
      const { error: insertError } = await supabase.from("project_images").insert(
        generatedImages.map((img) => ({
          project_id: workflow.project_id,
          reference: item.reference,
          asin: item.asin,
          url: img.url,
          original_image_url: firstImageUrl,
          prompt_used: img.prompt,
          index: img.index,
          validation_status: "pending",
        }))
      );

      if (insertError) {
        console.error("❌ [PROCESS-ITEM] Error inserting images:", insertError);
      } else {
        console.log(`✅ [PROCESS-ITEM] ${generatedImages.length} images saved to project`);
      }
    }

    // 7. MARCAR COMO COMPLETADO
    await supabase
      .from("workflow_items")
      .update({
        status: "completed",
        generated_images: JSON.stringify(generatedImages),
        processed_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    // 8. ACTUALIZAR CONTADOR DEL WORKFLOW
    await supabase.rpc("increment_workflow_processed", { workflow_id: workflowId });

    const duration = Date.now() - startTime;
    console.log(`✅ [PROCESS-ITEM] COMPLETED - ${itemReference} - ${duration}ms - ${generatedImages.length} images`);

    return {
      success: true,
      reference: item.reference,
      imagesGenerated: generatedImages.length,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [PROCESS-ITEM] FAILED - ${itemReference} - ${duration}ms`);
    console.error(`❌ [PROCESS-ITEM] Error:`, error.message);

    // Marcar como fallido
    try {
      await supabase
        .from("workflow_items")
        .update({
          status: "failed",
          error_message: error.message,
        })
        .eq("id", itemId);
    } catch (updateError) {
      console.error("❌ [PROCESS-ITEM] Could not mark item as failed:", updateError);
    }

    return {
      success: false,
      reference: itemReference,
      error: error.message,
    };
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { workflowId } = await request.json();

    console.log(`\n🤖 [PROCESS] Starting workflow: ${workflowId}`);

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "workflowId is required" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();
    console.log(`🌐 [PROCESS] Base URL: ${baseUrl}`);

    // 1. OBTENER WORKFLOW
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error("❌ [PROCESS] Workflow not found:", workflowError);
      return NextResponse.json(
        { success: false, error: "Workflow not found" },
        { status: 404 }
      );
    }

    console.log(`✅ [PROCESS] Found workflow: ${workflow.name}`);

    // 2. MARCAR WORKFLOW COMO PROCESSING
    await supabase
      .from("workflows")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    // 3. OBTENER TODOS LOS ITEMS PENDIENTES
    const { data: items, error: itemsError } = await supabase
      .from("workflow_items")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("status", "pending");

    if (itemsError) {
      console.error("❌ [PROCESS] Error fetching items:", itemsError);
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    console.log(`📊 [PROCESS] Found ${items?.length || 0} pending items`);

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // 4. PROCESAR CADA ITEM SECUENCIALMENTE (INLINE)
    for (let i = 0; i < (items?.length || 0); i++) {
      const item = items![i];
      console.log(`\n📦 [PROCESS] Processing item ${i + 1}/${items!.length}: ${item.reference}`);

      const result = await processItemInline(workflowId, item.id, baseUrl);

      if (result.success) {
        successCount++;
        results.push({
          reference: item.reference,
          status: "success",
          imagesGenerated: result.imagesGenerated,
        });
      } else {
        failedCount++;
        results.push({
          reference: item.reference,
          status: "failed",
          error: result.error,
        });
        
        // Actualizar contador de fallidos
        await supabase
          .from("workflows")
          .update({
            failed_items: failedCount,
          })
          .eq("id", workflowId);
      }
    }

    // 5. MARCAR WORKFLOW COMO COMPLETADO
    await supabase
      .from("workflows")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    const duration = Date.now() - startTime;
    console.log(`\n✅ [PROCESS] WORKFLOW COMPLETED - ${duration}ms`);
    console.log(`📊 [PROCESS] Success: ${successCount}, Failed: ${failedCount}\n`);

    return NextResponse.json({
      success: true,
      summary: {
        total: items?.length || 0,
        success: successCount,
        failed: failedCount,
      },
      results,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [PROCESS] WORKFLOW FAILED - ${duration}ms`);
    console.error(`❌ [PROCESS] Error:`, error);

    // Marcar workflow como fallido
    try {
      const { workflowId } = await request.json();
      await supabase
        .from("workflows")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", workflowId);
    } catch (updateError) {
      console.error("❌ [PROCESS] Could not mark workflow as failed:", updateError);
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}