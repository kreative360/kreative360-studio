import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "IDs inválidos" },
        { status: 400 }
      );
    }

    // 1️⃣ Obtener rutas de storage
    const { data: images, error: fetchError } = await supabaseAdmin
      .from("project_images")
      .select("id, storage_path")
      .in("id", ids);

    if (fetchError) throw fetchError;

    // 2️⃣ Borrar archivos de Storage (solo si NO son data URLs)
    // Filtrar solo las rutas que son archivos reales en Storage (no data URLs ni blob URLs)
    const storagePaths = images
      .map((img) => img.storage_path)
      .filter((path) => path && !path.startsWith("data:") && !path.startsWith("blob:"));

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("project-images")
        .remove(storagePaths);

      if (storageError) {
        console.warn("Storage deletion error:", storageError);
        // No lanzar error - continuar con la eliminación de BD
      }
    }

    // 3️⃣ Borrar registros de DB
    const { error: deleteError } = await supabaseAdmin
      .from("project_images")
      .delete()
      .in("id", ids);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE IMAGES ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Error eliminando imágenes" },
      { status: 500 }
    );
  }
}