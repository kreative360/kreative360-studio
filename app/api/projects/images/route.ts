import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * ⛔ DESACTIVAR CACHÉ DE NEXT.JS
 * Necesario para que los cambios se reflejen al instante
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ images: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("project_images")
      .select(`
        id,
        project_id,
        reference,
        asin,
        image_index,
        storage_path,
        validation_status,
        original_image_url,
        prompt_used,
        created_at
      `)
      .eq("project_id", projectId)
      // 🔧 ORDENAR: Primero por referencia, luego por índice
      .order("reference", { ascending: true })
      .order("image_index", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ images: [] }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ images: [] });
    }

    const images = data
      .map((img) => {
        if (!img.storage_path) return null;

        let imageUrl: string;

        // Si es una data URL (comienza con "data:"), usarla directamente
        if (img.storage_path.startsWith('data:')) {
          imageUrl = img.storage_path;
        } 
        // Si es una URL completa (http/https), usarla directamente
        else if (img.storage_path.startsWith('http')) {
          imageUrl = img.storage_path;
        }
        // Si no, asumir que es una ruta de Supabase Storage
        else {
          const { data: urlData } = supabaseAdmin.storage
            .from("project-images")
            .getPublicUrl(img.storage_path);

          if (!urlData?.publicUrl) return null;
          imageUrl = urlData.publicUrl;
        }

        return {
          id: img.id,
          reference: img.reference,
          asin: img.asin,
          index: img.image_index,
          url: imageUrl,
          validation_status: img.validation_status || "pending",
          original_image_url: img.original_image_url || null,
          prompt_used: img.prompt_used || null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ images });
  } catch (err) {
    console.error("Fatal error:", err);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}