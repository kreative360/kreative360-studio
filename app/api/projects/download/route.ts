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
      let arrayBuffer: ArrayBuffer;

      // 🆕 DETECTAR SI ES DATA URL O ARCHIVO DE STORAGE
      if (img.storage_path && img.storage_path.startsWith("data:")) {
        // 🆕 Es data URL (base64) - convertir directamente
        try {
          const base64Data = img.storage_path.split(",")[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
          console.log(`✅ Converted data URL for ${img.reference}`);
        } catch (conversionError) {
          console.error("Error converting data URL:", img.storage_path.substring(0, 50), conversionError);
          continue;
        }
      } else {
        // ✅ Es archivo en Storage - descargar normalmente
        const { data: fileData, error: downloadError } =
          await supabaseAdmin.storage
            .from("project-images")
            .download(img.storage_path);

        if (downloadError || !fileData) {
          console.error("Error descargando imagen:", img.storage_path);
          continue;
        }

        arrayBuffer = await fileData.arrayBuffer();
      }

      const baseName =
        mode === "reference"
          ? img.reference
          : img.asin;

      if (!baseName) continue;

      // 🆕 Detectar extensión desde data URL o mime type
      let extension = "jpg";
      if (img.storage_path && img.storage_path.startsWith("data:")) {
        const mimeMatch = img.storage_path.match(/data:image\/([a-zA-Z]+);/);
        if (mimeMatch) {
          extension = mimeMatch[1];
        }
      } else if (img.mime) {
        extension = img.mime.split("/")[1] || "jpg";
      }

      // ✅ nombre FINAL correcto con image_index
      const filename = `${baseName}_${img.image_index}.${extension}`;

      zip.file(filename, arrayBuffer);
      console.log(`📦 Added to ZIP: ${filename}`);
    }

    // 3️⃣ Generar ZIP
    const zipArrayBuffer = await zip.generateAsync({
      type: "arraybuffer",
    });

    console.log(`✅ ZIP generated with ${Object.keys(zip.files).length} files`);

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