import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createImageValidation } from "@/lib/services/supabase.service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageId, status, notes, validatedBy } = body;

    // Validaciones
    if (!imageId) {
      return NextResponse.json(
        { success: false, error: "imageId es requerido" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "status debe ser: approved, rejected o pending" },
        { status: 400 }
      );
    }

    // Actualizar el estado de validación en project_images
    const { error: updateError } = await supabaseAdmin
      .from("project_images")
      .update({ validation_status: status })
      .eq("id", imageId);

    if (updateError) {
      console.error("Error updating validation status:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Crear registro en image_validations
    try {
      await createImageValidation(
        imageId,
        status as "pending" | "approved" | "rejected" | "needs_edit",
        notes || undefined
      );
    } catch (validationError) {
      console.warn("Error creating validation record:", validationError);
      // No fallar si esto falla, el estado ya se actualizó
    }

    // Obtener la imagen actualizada
    const { data: updatedImage } = await supabaseAdmin
      .from("project_images")
      .select("*")
      .eq("id", imageId)
      .single();

    return NextResponse.json({
      success: true,
      image: updatedImage,
      message: `Imagen ${status === "approved" ? "aprobada" : status === "rejected" ? "rechazada" : "marcada como pendiente"}`,
    });
  } catch (error: any) {
    console.error("Error in validations/update:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}