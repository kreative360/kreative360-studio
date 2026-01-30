import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/workflows/create
 * 
 * Crea un nuevo workflow a partir de un CSV
 * 
 * Body:
 * {
 *   name: "Catálogo Casas Decoración",
 *   projectId: "uuid-del-proyecto",
 *   mode: "global" | "specific",
 *   imagesPerReference: 5,
 *   globalParams?: "ambiente hiperrealista...",
 *   specificPrompts?: ["spec 1", "spec 2", ...],
 *   items: [
 *     {
 *       reference: "GB-10976",
 *       asin: "B0XXXXXXXXX",
 *       productName: "Mueble TV",
 *       imageUrls: ["url1", "url2"]
 *     },
 *     ...
 *   ]
 * }
 */
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
    } = body;

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

    // 2. CREAR WORKFLOW
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .insert({
        name,
        project_id: projectId,
        prompt_mode: mode,
        images_per_reference: imagesPerReference,
        global_params: globalParams || null,
        specific_prompts: specificPrompts || null,
        status: "pending",
        total_items: items.length,
        processed_items: 0,
        failed_items: 0,
      })
      .select()
      .single();

    if (workflowError || !workflow) {
      console.error("Error creating workflow:", workflowError);
      return NextResponse.json(
        { success: false, error: "Failed to create workflow" },
        { status: 500 }
      );
    }

    // 3. CREAR WORKFLOW ITEMS
    const workflowItems = items.map((item: any) => ({
      workflow_id: workflow.id,
      reference: item.reference,
      asin: item.asin || null,
      product_name: item.productName || null,
      image_urls: item.imageUrls,
      status: "pending",
    }));

    const { error: itemsError } = await supabase
      .from("workflow_items")
      .insert(workflowItems);

    if (itemsError) {
      console.error("Error creating workflow items:", itemsError);
      // Rollback: eliminar workflow
      await supabase.from("workflows").delete().eq("id", workflow.id);
      return NextResponse.json(
        { success: false, error: "Failed to create workflow items" },
        { status: 500 }
      );
    }

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
    console.error("Error in create workflow:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}