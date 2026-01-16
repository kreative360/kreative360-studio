import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { imageId, base64, mime, promptUsed } = await request.json();

    if (!imageId || !base64) {
      return NextResponse.json(
        { success: false, error: "imageId y base64 son requeridos" },
        { status: 400 }
      );
    }

    // 🔧 PASO 1: Obtener información de la imagen actual
    const { data: currentImage, error: fetchError } = await supabaseAdmin
      .from("project_images")
      .select("storage_path, project_id, reference, image_index")
      .eq("id", imageId)
      .single();

    if (fetchError || !currentImage) {
      console.error("Error obteniendo imagen:", fetchError);
      return NextResponse.json(
        { success: false, error: "Imagen no encontrada" },
        { status: 404 }
      );
    }

    // 🔧 PASO 2: Eliminar la imagen vieja del storage
    if (currentImage.storage_path) {
      const { error: deleteError } = await supabaseAdmin.storage
        .from("project-images")
        .remove([currentImage.storage_path]);

      if (deleteError) {
        console.error("Error eliminando imagen vieja:", deleteError);
      }
    }

    // 🔧 PASO 3: Subir la nueva imagen CON EL MISMO NOMBRE
    const buffer = Buffer.from(base64, "base64");
    const storagePath = currentImage.storage_path; // 🔧 Mantener el mismo path/nombre

    const { error: uploadError } = await supabaseAdmin.storage
      .from("project-images")
      .upload(storagePath, buffer, {
        contentType: mime || "image/jpeg",
        upsert: true, // 🔧 Reemplazar si existe
      });

    if (uploadError) {
      console.error("Error subiendo nueva imagen:", uploadError);
      return NextResponse.json(
        { success: false, error: "Error subiendo imagen" },
        { status: 500 }
      );
    }

    // 🔧 PASO 4: Actualizar prompt_used en BD
    const { error: updateError } = await supabaseAdmin
      .from("project_images")
      .update({
        prompt_used: promptUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", imageId);

    if (updateError) {
      console.error("Error actualizando BD:", updateError);
      return NextResponse.json(
        { success: false, error: "Error actualizando BD" },
        { status: 500 }
      );
    }

    // 🔧 PASO 5: Obtener URL pública de la nueva imagen
    const { data: urlData } = supabaseAdmin.storage
      .from("project-images")
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      message: "Imagen actualizada exitosamente",
    });

  } catch (error: any) {
    console.error("Error en update-image:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}