import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { 
      workflowId, 
      name,
      projectId,
      mode, 
      imagesPerReference, 
      globalParams, 
      specificPrompts,
      items
    } = await req.json();

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "workflowId es requerido" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: "name es requerido" },
        { status: 400 }
      );
    }

    console.log("📝 [UPDATE] Actualizando workflow:", workflowId);

    const updateData: any = {
      name,
      project_id: projectId,
      prompt_mode: mode,
      images_per_reference: imagesPerReference,
    };

    if (mode === "global") {
      updateData.global_params = globalParams;
      updateData.specific_prompts = null;
    } else {
      updateData.global_params = null;
      updateData.specific_prompts = specificPrompts;
    }

    if (items && Array.isArray(items)) {
      console.log(`📦 [UPDATE] Reemplazando CSV con ${items.length} items`);
      
      const { error: deleteError } = await supabaseAdmin
        .from("workflow_items")
        .delete()
        .eq("workflow_id", workflowId);

      if (deleteError) {
        console.error("❌ [UPDATE] Error eliminando items antiguos:", deleteError);
        throw deleteError;
      }

      const workflowItems = items.map((item: any) => ({
        workflow_id: workflowId,
        reference: item.reference,
        product_name: item.productName,
        asin: item.asin,
        image_urls: item.imageUrls,
        status: "pending",
      }));

      const { error: insertError } = await supabaseAdmin
        .from("workflow_items")
        .insert(workflowItems);

      if (insertError) {
        console.error("❌ [UPDATE] Error insertando nuevos items:", insertError);
        throw insertError;
      }

      updateData.total_items = items.length;
      updateData.processed_items = 0;
      updateData.failed_items = 0;
      updateData.status = "pending";
    }

    const { data, error } = await supabaseAdmin
      .from("workflows")
      .update(updateData)
      .eq("id", workflowId)
      .select()
      .single();

    if (error) {
      console.error("❌ [UPDATE] Error actualizando workflow:", error);
      throw error;
    }

    console.log("✅ [UPDATE] Workflow actualizado exitosamente");

    return NextResponse.json({
      success: true,
      workflow: data,
    });

  } catch (error: any) {
    console.error("❌ [UPDATE] Error en update workflow:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}