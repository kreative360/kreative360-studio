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

    // Subir nueva imagen (reemplazar)
    const buffer = Buffer.from(base64, "base64");
    
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("project-images")
      .upload(img.storage_path, buffer, {
        contentType: mime || "image/jpeg",
        upsert: true,
      });

    if (uploadErr) {
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

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}