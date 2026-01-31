import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { 
      workflowId, 
      name, 
      mode, 
      imagesPerReference, 
      globalParams, 
      specificPrompts 
    } = await req.json();

    // Validaciones
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

    // Preparar datos de actualización
    const updateData: any = {
      name,
      prompt_mode: mode,
      images_per_reference: imagesPerReference,
      updated_at: new Date().toISOString(),
    };

    // Añadir prompts según el modo
    if (mode === "global") {
      updateData.global_params = globalParams;
      updateData.specific_prompts = null;
    } else {
      updateData.global_params = null;
      updateData.specific_prompts = specificPrompts;
    }

    // Actualizar en Supabase
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