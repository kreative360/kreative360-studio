import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    console.log("🧹 Iniciando limpieza de archivos huérfanos...");

    // PASO 1: Obtener todos los storage_paths de la base de datos
    const { data: dbImages, error: dbError } = await supabaseAdmin
      .from("project_images")
      .select("storage_path");

    if (dbError) {
      throw new Error("Error obteniendo imágenes de BD: " + dbError.message);
    }

    const validPaths = new Set(dbImages.map((img) => img.storage_path));
    console.log(`✅ ${validPaths.size} imágenes válidas en BD`);

    // PASO 2: Listar todos los archivos en Storage
    const { data: storageFiles, error: storageError } = await supabaseAdmin.storage
      .from("project-images")
      .list("projects", {
        limit: 10000,
        offset: 0,
      });

    if (storageError) {
      throw new Error("Error listando Storage: " + storageError.message);
    }

    console.log(`📦 ${storageFiles.length} carpetas de proyectos en Storage`);

    // PASO 3: Recorrer cada carpeta de proyecto
    let totalOrphans = 0;
    const orphanedFiles: string[] = [];

    for (const projectFolder of storageFiles) {
      if (!projectFolder.name) continue;

      // Listar archivos dentro de cada proyecto
      const { data: projectFiles, error: listError } = await supabaseAdmin.storage
        .from("project-images")
        .list(`projects/${projectFolder.name}`, {
          limit: 10000,
          offset: 0,
        });

      if (listError) {
        console.error(`❌ Error listando proyecto ${projectFolder.name}:`, listError);
        continue;
      }

      console.log(`📂 Proyecto ${projectFolder.name}: ${projectFiles.length} archivos`);

      // Verificar cada archivo
      for (const file of projectFiles) {
        const fullPath = `projects/${projectFolder.name}/${file.name}`;
        
        if (!validPaths.has(fullPath)) {
          orphanedFiles.push(fullPath);
          totalOrphans++;
          console.log(`🗑️  Huérfano encontrado: ${fullPath}`);
        }
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   - Imágenes en BD: ${validPaths.size}`);
    console.log(`   - Archivos huérfanos: ${totalOrphans}`);

    // PASO 4: Eliminar archivos huérfanos
    if (orphanedFiles.length > 0) {
      console.log(`\n🗑️  Eliminando ${orphanedFiles.length} archivos huérfanos...`);

      const { data: deleteData, error: deleteError } = await supabaseAdmin.storage
        .from("project-images")
        .remove(orphanedFiles);

      if (deleteError) {
        throw new Error("Error eliminando archivos: " + deleteError.message);
      }

      console.log(`✅ ${orphanedFiles.length} archivos eliminados correctamente`);

      return NextResponse.json({
        success: true,
        message: `Limpieza completada: ${orphanedFiles.length} archivos huérfanos eliminados`,
        stats: {
          validImages: validPaths.size,
          orphanedFiles: totalOrphans,
          deletedFiles: orphanedFiles.length,
        },
        deletedFiles: orphanedFiles,
      });
    } else {
      console.log(`✅ No hay archivos huérfanos para eliminar`);

      return NextResponse.json({
        success: true,
        message: "No se encontraron archivos huérfanos",
        stats: {
          validImages: validPaths.size,
          orphanedFiles: 0,
          deletedFiles: 0,
        },
      });
    }
  } catch (error: any) {
    console.error("❌ Error en limpieza:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}