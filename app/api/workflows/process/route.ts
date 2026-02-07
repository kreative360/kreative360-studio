import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageId, base64, mime, promptUsed } = body;

    if (!imageId || !base64) {
      return NextResponse.json(
        { success: false, error: "Faltan datos requeridos" },
        { status: 400 }
      );
    }

    // Obtener imagen actual
    const { data: img, error: fetchErr } = await supabaseAdmin
      .from("project_images")
      .select("storage_path")
      .eq("id", imageId)
      .single();

    if (fetchErr || !img) {
      return NextResponse.json(
        { success: false, error: "Imagen no encontrada" },
        { status: 404 }
      );
    }

    // 🆕 DETECTAR SI ES DATA URL O ARCHIVO DE STORAGE
    const isDataUrl = img.storage_path && img.storage_path.startsWith("data:");

    let newStoragePath = img.storage_path;
    let publicUrl = img.storage_path;

    if (isDataUrl) {
      // 🆕 ES DATA URL - Actualizar directamente el campo con nueva data URL
      console.log("📝 [UPDATE-IMAGE] Updating data URL image");
      
      const newDataUrl = `data:${mime || 'image/jpeg'};base64,${base64}`;
      newStoragePath = newDataUrl;
      publicUrl = newDataUrl;

      // Actualizar storage_path con la nueva data URL
      const { error: updateErr } = await supabaseAdmin
        .from("project_images")
        .update({ 
          storage_path: newDataUrl,
          prompt_used: promptUsed,
          mime: mime || 'image/jpeg'
        })
        .eq("id", imageId);

      if (updateErr) {
        console.error("❌ [UPDATE-IMAGE] Error updating data URL:", updateErr);
        return NextResponse.json(
          { success: false, error: "Error al actualizar: " + updateErr.message },
          { status: 500 }
        );
      }

      console.log("✅ [UPDATE-IMAGE] Data URL image updated successfully");

    } else {
      // ✅ ES ARCHIVO DE STORAGE - Subir a Storage como antes
      console.log("📤 [UPDATE-IMAGE] Uploading to Storage:", img.storage_path);

      const buffer = Buffer.from(base64, "base64");
      
      const { error: uploadErr } = await supabaseAdmin.storage
        .from("project-images")
        .upload(img.storage_path, buffer, {
          contentType: mime || "image/jpeg",
          upsert: true,
        });

      if (uploadErr) {
        console.error("❌ [UPDATE-IMAGE] Storage upload error:", uploadErr);
        return NextResponse.json(
          { success: false, error: "Error al subir: " + uploadErr.message },
          { status: 500 }
        );
      }

      // Actualizar prompt
      await supabaseAdmin
        .from("project_images")
        .update({ prompt_used: promptUsed })
        .eq("id", imageId);

      // URL pública
      const { data: urlData } = supabaseAdmin.storage
        .from("project-images")
        .getPublicUrl(img.storage_path);

      publicUrl = urlData.publicUrl;

      console.log("✅ [UPDATE-IMAGE] Storage image updated successfully");
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });

  } catch (error: any) {
    console.error("❌ [UPDATE-IMAGE] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}