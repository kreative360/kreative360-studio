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

    // 🆕 PASO 1: Obtener la imagen actual ANTES de actualizar
    const { data: currentImage } = await supabaseAdmin
      .from("project_images")
      .select("id, validation_status, image_index, reference, project_id, filename, storage_path")
      .eq("id", imageId)
      .single();

    if (!currentImage) {
      return NextResponse.json(
        { success: false, error: "Imagen no encontrada" },
        { status: 404 }
      );
    }

    // 🆕 PASO 2: Detectar si estamos aprobando una rechazada
    const wasRejected = currentImage.validation_status === "rejected";
    const isBeingApproved = status === "approved" || status === "pending";

    let newIndex = currentImage.image_index;
    let newFilename = currentImage.filename;

    if (wasRejected && isBeingApproved && currentImage.reference) {
      // 🔧 PRIMERO: Cambiar temporalmente a "pending" para que sea considerada "activa"
      await supabaseAdmin
        .from("project_images")
        .update({ validation_status: "pending" })
        .eq("id", imageId);

      // 🔧 VERIFICAR CONFLICTO DE NUMERACIÓN (ahora sí se detectará)
      const { data: conflictImage } = await supabaseAdmin
        .from("project_images")
        .select("id, image_index")
        .eq("project_id", currentImage.project_id)
        .eq("reference", currentImage.reference)
        .eq("image_index", currentImage.image_index)
        .neq("id", imageId) // Excluir la imagen actual
        .neq("validation_status", "rejected") // Solo imágenes activas
        .single();

      if (conflictImage) {
        // 🔧 HAY CONFLICTO: Renumerar al final de la cola
        const { data: allImages } = await supabaseAdmin
          .from("project_images")
          .select("image_index")
          .eq("project_id", currentImage.project_id)
          .eq("reference", currentImage.reference)
          .neq("validation_status", "rejected")
          .order("image_index", { ascending: true });

        if (allImages && allImages.length > 0) {
          const maxIndex = Math.max(...allImages.map(img => img.image_index));
          newIndex = maxIndex + 1;

          // Actualizar el filename con el nuevo índice
          const extension = currentImage.filename.split('.').pop();
          newFilename = `${currentImage.reference}_${newIndex}.${extension}`;

          console.log(`🔧 CONFLICTO DETECTADO: Renumerando ${currentImage.filename} → ${newFilename}`);
        }
      }
    }

    // 🔧 ACTUALIZAR: índice, filename Y status definitivo
    const { error: updateError } = await supabaseAdmin
      .from("project_images")
      .update({ 
        validation_status: status,
        image_index: newIndex,
        filename: newFilename
      })
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
      message: `Imagen ${status === "approved" ? "aprobada" : status === "rejected" ? "rechazada" : "marcada como pendiente"}${newIndex !== currentImage.image_index ? ` y renumerada a #${newIndex}` : ""}`,
    });
  } catch (error: any) {
    console.error("Error in validations/update:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}