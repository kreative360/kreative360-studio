import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId requerido" },
        { status: 400 }
      );
    }

    /* =========================================
       1️⃣ OBTENER IMÁGENES DEL PROYECTO
    ========================================= */
    const { data: images, error: fetchError } = await supabaseAdmin
      .from("project_images")
      .select("storage_path")
      .eq("project_id", projectId);

    if (fetchError) {
      console.error(fetchError);
      return NextResponse.json(
        { error: "Error obteniendo imágenes" },
        { status: 500 }
      );
    }

    /* =========================================
       2️⃣ BORRAR IMÁGENES DE STORAGE
    ========================================= */
    if (images && images.length > 0) {
      const paths = images
        .map((img) => img.storage_path)
        .filter(Boolean);

      if (paths.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from("project-images")
          .remove(paths);

        if (storageError) {
          console.error(storageError);
          return NextResponse.json(
            { error: "Error eliminando archivos de storage" },
            { status: 500 }
          );
        }
      }
    }

    /* =========================================
       3️⃣ BORRAR IMÁGENES DE LA DB
    ========================================= */
    const { error: imagesError } = await supabaseAdmin
      .from("project_images")
      .delete()
      .eq("project_id", projectId);

    if (imagesError) {
      console.error(imagesError);
      return NextResponse.json(
        { error: "Error eliminando imágenes de DB" },
        { status: 500 }
      );
    }

    /* =========================================
       4️⃣ BORRAR PROYECTO
    ========================================= */
    const { error: projectError } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (projectError) {
      console.error(projectError);
      return NextResponse.json(
        { error: "Error eliminando proyecto" },
        { status: 500 }
      );
    }

    /* =========================================
       5️⃣ RESPUESTA LIMPIA
    ========================================= */
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE PROJECT ERROR:", err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
