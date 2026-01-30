import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const startTime = Date.now();
  let itemReference = "unknown";

  try {
    const { workflowId, itemId } = await request.json();

    console.log(`\n🚀 [PROCESS-ITEM] Starting - workflowId: ${workflowId}, itemId: ${itemId}`);

    if (!workflowId || !itemId) {
      return NextResponse.json(
        { success: false, error: "workflowId and itemId are required" },
        { status: 400 }
      );
    }

    // 1. OBTENER WORKFLOW Y ITEM
    console.log("📦 [PROCESS-ITEM] Fetching workflow and item from DB...");
    
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError) {
      console.error("❌ [PROCESS-ITEM] Error fetching workflow:", workflowError);
      throw new Error(`Workflow fetch failed: ${workflowError.message}`);
    }

    const { data: item, error: itemError } = await supabase
      .from("workflow_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (itemError) {
      console.error("❌ [PROCESS-ITEM] Error fetching item:", itemError);
      throw new Error(`Item fetch failed: ${itemError.message}`);
    }

    if (!workflow || !item) {
      console.error("❌ [PROCESS-ITEM] Workflow or item not found");
      return NextResponse.json(
        { success: false, error: "Workflow or item not found" },
        { status: 404 }
      );
    }

    itemReference = item.reference;
    console.log(`✅ [PROCESS-ITEM] Found item: ${itemReference}`);

    // 2. MARCAR COMO PROCESSING
    console.log("🔄 [PROCESS-ITEM] Marking as processing...");
    await supabase
      .from("workflow_items")
      .update({ status: "processing" })
      .eq("id", itemId);

    // 3. ANALIZAR Y GENERAR PROMPTS
    console.log("🧠 [PROCESS-ITEM] Starting AI analysis...");
    
    const imageUrls = typeof item.image_urls === 'string' 
      ? JSON.parse(item.image_urls) 
      : item.image_urls;
    
    const firstImageUrl = imageUrls[0];
    console.log(`📸 [PROCESS-ITEM] Using reference image: ${firstImageUrl}`);

    const analyzePayload = {
      productName: item.product_name,
      imageUrl: firstImageUrl,
      mode: workflow.prompt_mode,
      imagesCount: workflow.images_per_reference,
      globalParams: workflow.global_params,
      specificPrompts: typeof workflow.specific_prompts === 'string'
        ? JSON.parse(workflow.specific_prompts)
        : workflow.specific_prompts,
    };

    console.log("📤 [PROCESS-ITEM] Analyze payload:", JSON.stringify(analyzePayload, null, 2));

    const analyzeRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/workflows/analyze-and-generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyzePayload),
      }
    );

    const analyzeData = await analyzeRes.json();
    console.log(`📥 [PROCESS-ITEM] Analyze response status: ${analyzeRes.status}`);

    if (!analyzeData.success) {
      console.error("❌ [PROCESS-ITEM] Analysis failed:", analyzeData.error);
      throw new Error(`Analysis failed: ${analyzeData.error}`);
    }

    console.log(`✅ [PROCESS-ITEM] Analysis successful - Product type: ${analyzeData.product_type}`);
    console.log(`📝 [PROCESS-ITEM] Generated ${analyzeData.prompts.length} prompts`);

    // 4. GUARDAR PROMPTS GENERADOS
    console.log("💾 [PROCESS-ITEM] Saving generated prompts to DB...");
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

    for (let i = 0; i < analyzeData.prompts.length; i++) {
      const prompt = analyzeData.prompts[i];
      console.log(`🖼️ [PROCESS-ITEM] Generating image ${i + 1}/${analyzeData.prompts.length}...`);

      try {
        const generateRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/generate`,
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

        const generateData = await generateRes.json();

        if (generateData.images && generateData.images.length > 0) {
          generatedImages.push({
            url: generateData.images[0],
            prompt: prompt,
            index: i + 1,
          });
          console.log(`✅ [PROCESS-ITEM] Image ${i + 1} generated successfully`);
        } else {
          console.warn(`⚠️ [PROCESS-ITEM] No image returned for prompt ${i + 1}`);
        }
      } catch (imgError: any) {
        console.error(`❌ [PROCESS-ITEM] Error generating image ${i + 1}:`, imgError.message);
      }
    }

    console.log(`🎯 [PROCESS-ITEM] Generated ${generatedImages.length}/${analyzeData.prompts.length} images`);

    // 6. GUARDAR IMÁGENES Y ENVIAR A PROYECTO
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
    console.log("✅ [PROCESS-ITEM] Marking as completed...");
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
    console.log(`✅ [PROCESS-ITEM] COMPLETED - ${itemReference} - ${duration}ms - ${generatedImages.length} images\n`);

    return NextResponse.json({
      success: true,
      item: {
        id: itemId,
        reference: item.reference,
        productType: analyzeData.product_type,
        promptsGenerated: analyzeData.prompts.length,
        imagesGenerated: generatedImages.length,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [PROCESS-ITEM] FAILED - ${itemReference} - ${duration}ms`);
    console.error(`❌ [PROCESS-ITEM] Error details:`, error);
    console.error(`❌ [PROCESS-ITEM] Error stack:`, error.stack);

    // Marcar como fallido
    try {
      const { itemId } = await request.json();
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

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}