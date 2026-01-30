import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/workflows/process-item
 * 
 * Procesa UNA referencia completa del workflow:
 * 1. Analiza el producto
 * 2. Genera N prompts
 * 3. Genera N imágenes
 * 4. Envía al proyecto
 */
export async function POST(request: Request) {
  try {
    const { workflowId, itemId } = await request.json();

    if (!workflowId || !itemId) {
      return NextResponse.json(
        { success: false, error: "workflowId and itemId are required" },
        { status: 400 }
      );
    }

    // 1. OBTENER WORKFLOW Y ITEM
    const { data: workflow } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    const { data: item } = await supabase
      .from("workflow_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (!workflow || !item) {
      return NextResponse.json(
        { success: false, error: "Workflow or item not found" },
        { status: 404 }
      );
    }

    // 2. MARCAR COMO PROCESSING
    await supabase
      .from("workflow_items")
      .update({ status: "processing" })
      .eq("id", itemId);

    // 3. ANALIZAR Y GENERAR PROMPTS
    const imageUrls = item.image_urls as string[];
    const firstImageUrl = imageUrls[0];

    const analyzeRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/workflows/analyze-and-generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: item.product_name,
          imageUrl: firstImageUrl,
          mode: workflow.prompt_mode,
          imagesCount: workflow.images_per_reference,
          globalParams: workflow.global_params,
          specificPrompts: workflow.specific_prompts,
        }),
      }
    );

    const analyzeData = await analyzeRes.json();

    if (!analyzeData.success) {
      throw new Error(`Analysis failed: ${analyzeData.error}`);
    }

    // 4. GUARDAR PROMPTS GENERADOS
    await supabase
      .from("workflow_items")
      .update({
        detected_product_type: analyzeData.product_type,
        detection_description: analyzeData.description,
        detection_confidence: analyzeData.confidence,
        generated_prompts: analyzeData.prompts,
      })
      .eq("id", itemId);

    // 5. GENERAR IMÁGENES
    const generatedImages = [];

    for (let i = 0; i < analyzeData.prompts.length; i++) {
      const prompt = analyzeData.prompts[i];

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
      }
    }

    // 6. GUARDAR IMÁGENES Y ENVIAR A PROYECTO
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
      console.error("Error inserting images:", insertError);
    }

    // 7. MARCAR COMO COMPLETADO
    await supabase
      .from("workflow_items")
      .update({
        status: "completed",
        generated_images: generatedImages,
        processed_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    // 8. ACTUALIZAR CONTADOR DEL WORKFLOW
    await supabase.rpc("increment_workflow_processed", { workflow_id: workflowId });

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
    console.error("Error processing item:", error);

    // Marcar como fallido
    if (request.body) {
      const { itemId } = await request.json();
      await supabase
        .from("workflow_items")
        .update({
          status: "failed",
          error_message: error.message,
        })
        .eq("id", itemId);
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}