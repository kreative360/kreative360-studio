import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      projectId,
      mode,
      imagesPerReference,
      globalParams,
      specificPrompts,
      items,
      imageSize,      // 🆕 NUEVO
      imageFormat,    // 🆕 NUEVO
      engine,         // 🆕 NUEVO
    } = body;

    console.log("📥 Creating workflow:", { name, projectId, mode, imagesPerReference });
    console.log("📦 Items received:", items);

    // 1. VALIDACIONES
    if (!name || !projectId || !imagesPerReference || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (mode === "specific" && (!specificPrompts || specificPrompts.length !== imagesPerReference)) {
      return NextResponse.json(
        { success: false, error: `specificPrompts must have exactly ${imagesPerReference} elements` },
        { status: 400 }
      );
    }

    // VALIDAR QUE CADA ITEM TENGA AL MENOS 1 URL
    const invalidItems = items.filter((item: any) => !item.imageUrls || item.imageUrls.length === 0);
    if (invalidItems.length > 0) {
      console.error("❌ Items without URLs:", invalidItems);
      return NextResponse.json(
        { 
          success: false, 
          error: `${invalidItems.length} items do not have any image URLs. Check your CSV format.` 
        },
        { status: 400 }
      );
    }

    // 2. CREAR WORKFLOW
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .insert({
        name,
        project_id: projectId,
        prompt_mode: mode,
        images_per_reference: imagesPerReference,
        global_params: globalParams || null,
        specific_prompts: specificPrompts ? JSON.stringify(specificPrompts) : null,
        image_size: imageSize || "1024x1024",       // 🆕 NUEVO
        image_format: imageFormat || "jpg",          // 🆕 NUEVO
        engine: engine || "standard",                // 🆕 NUEVO
        status: "pending",
        total_items: items.length,
        processed_items: 0,
        failed_items: 0,
      })
      .select()
      .single();

    if (workflowError || !workflow) {
      console.error("❌ Error creating workflow:", workflowError);
      return NextResponse.json(
        { success: false, error: `Failed to create workflow: ${workflowError?.message}` },
        { status: 500 }
      );
    }

    console.log("✅ Workflow created:", workflow.id);

    // 3. CREAR WORKFLOW ITEMS
    const workflowItems = items.map((item: any) => ({
      workflow_id: workflow.id,
      reference: item.reference,
      asin: item.asin || null,
      product_name: item.productName || null,
      image_urls: JSON.stringify(item.imageUrls), // Asegurar que es string JSON
      status: "pending",
    }));

    console.log("📝 Creating workflow items:", workflowItems.length);

    const { error: itemsError } = await supabase
      .from("workflow_items")
      .insert(workflowItems);

    if (itemsError) {
      console.error("❌ Error creating workflow items:", itemsError);
      // Rollback: eliminar workflow
      await supabase.from("workflows").delete().eq("id", workflow.id);
      return NextResponse.json(
        { success: false, error: `Failed to create workflow items: ${itemsError.message}` },
        { status: 500 }
      );
    }

    console.log("✅ Workflow items created");

    return NextResponse.json({
      success: true,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        totalItems: items.length,
        status: "pending",
      },
    });
  } catch (error: any) {
    console.error("❌ Error in create workflow:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}