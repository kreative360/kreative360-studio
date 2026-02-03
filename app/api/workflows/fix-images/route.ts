import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    console.log(`🔧 [FIX-IMAGES] Starting fix for project: ${projectId}`);

    // Obtener todas las imágenes del proyecto
    const { data: images, error: fetchError } = await supabaseAdmin
      .from("project_images")
      .select("id, storage_path")
      .eq("project_id", projectId);

    if (fetchError) {
      console.error("❌ [FIX-IMAGES] Error fetching images:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!images || images.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No images found",
        fixed: 0 
      });
    }

    console.log(`📊 [FIX-IMAGES] Found ${images.length} images to check`);

    let fixed = 0;
    let skipped = 0;
    let failed = 0;

    for (const img of images) {
      try {
        const storagePath = img.storage_path;

        // Si ya es una data URL válida, skip
        if (typeof storagePath === 'string' && storagePath.startsWith('data:')) {
          skipped++;
          continue;
        }

        // Si ya es una URL HTTP, skip
        if (typeof storagePath === 'string' && storagePath.startsWith('http')) {
          skipped++;
          continue;
        }

        // Si es un objeto JSON con base64, convertirlo
        let imageObj: any;
        
        // Si es string, intentar parsearlo como JSON
        if (typeof storagePath === 'string') {
          try {
            imageObj = JSON.parse(storagePath);
          } catch {
            console.warn(`⚠️ [FIX-IMAGES] Cannot parse storage_path for image ${img.id}`);
            failed++;
            continue;
          }
        } else if (typeof storagePath === 'object') {
          imageObj = storagePath;
        } else {
          failed++;
          continue;
        }

        // Si tiene base64 y mime, convertir a data URL
        if (imageObj && imageObj.base64 && imageObj.mime) {
          const dataUrl = `data:${imageObj.mime};base64,${imageObj.base64}`;

          // Actualizar en la base de datos
          const { error: updateError } = await supabaseAdmin
            .from("project_images")
            .update({ storage_path: dataUrl })
            .eq("id", img.id);

          if (updateError) {
            console.error(`❌ [FIX-IMAGES] Error updating image ${img.id}:`, updateError);
            failed++;
          } else {
            console.log(`✅ [FIX-IMAGES] Fixed image ${img.id}`);
            fixed++;
          }
        } else {
          console.warn(`⚠️ [FIX-IMAGES] Image ${img.id} doesn't have base64/mime`);
          failed++;
        }
      } catch (error: any) {
        console.error(`❌ [FIX-IMAGES] Error processing image ${img.id}:`, error.message);
        failed++;
      }
    }

    console.log(`✅ [FIX-IMAGES] Complete - Fixed: ${fixed}, Skipped: ${skipped}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      total: images.length,
      fixed,
      skipped,
      failed
    });

  } catch (error: any) {
    console.error("❌ [FIX-IMAGES] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}