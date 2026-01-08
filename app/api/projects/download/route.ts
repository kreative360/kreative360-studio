import { NextResponse } from "next/server";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { ids, mode } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "IDs inválidos" },
        { status: 400 }
      );
    }

    if (mode !== "reference" && mode !== "asin") {
      return NextResponse.json(
        { error: "Modo inválido" },
        { status: 400 }
      );
    }

    // 1️⃣ Obtener imágenes ORDENADAS correctamente
    const { data: images, error } = await supabaseAdmin
      .from("project_images")
      .select("*")
      .in("id", ids)
      .order("reference", { ascending: true })
      .order("image_index", { ascending: true });

    if (error || !images || images.length === 0) {
      return NextResponse.json(
        { error: "Imágenes no encontradas" },
        { status: 404 }
      );
    }

    const zip = new JSZip();

    // 2️⃣ Descargar y añadir imágenes respetando image_index
    for (const img of images) {
      const { data: fileData, error: downloadError } =
        await supabaseAdmin.storage
          .from("project-images")
          .download(img.storage_path);

      if (downloadError || !fileData) {
        console.error("Error descargando imagen:", img.storage_path);
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();

      const baseName =
        mode === "reference"
          ? img.reference
          : img.asin;

      if (!baseName) continue;

      const extension = img.mime?.split("/")[1] || "jpg";

      // ✅ nombre FINAL correcto
      const filename = `${baseName}_${img.image_index}.${extension}`;

      zip.file(filename, arrayBuffer);
    }

    // 3️⃣ Generar ZIP
    const zipArrayBuffer = await zip.generateAsync({
      type: "arraybuffer",
    });

    return new NextResponse(zipArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=imagenes_${mode}.zip`,
      },
    });
  } catch (err) {
    console.error("DOWNLOAD ZIP ERROR:", err);
    return NextResponse.json(
      { error: "Error generando ZIP" },
      { status: 500 }
    );
  }
}
