import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/prompts/migrate
 * Migra prompts y folders desde localStorage a Supabase
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { folders, prompts } = body;

    if (!folders || !prompts) {
      return NextResponse.json(
        { error: "Datos de migración incompletos" },
        { status: 400 }
      );
    }

    const migratedFolders: Record<string, string> = {}; // old_id -> new_id
    const migratedPrompts: string[] = [];

    // 1. Migrar carpetas
    for (const folder of folders) {
      try {
        const { data, error } = await supabaseAdmin
          .from("prompt_folders")
          .insert({
            name: folder.name,
            icon: folder.icon || "📁",
          })
          .select()
          .single();

        if (error) {
          console.error("Error migrando carpeta:", folder.name, error);
          continue;
        }

        migratedFolders[folder.id] = data.id;
      } catch (error) {
        console.error("Error procesando carpeta:", folder.name, error);
      }
    }

    // 2. Migrar prompts
    for (const prompt of prompts) {
      try {
        // Mapear folder_id antiguo a nuevo
        let newFolderId = null;
        if (prompt.folderId && migratedFolders[prompt.folderId]) {
          newFolderId = migratedFolders[prompt.folderId];
        }

        const { data, error } = await supabaseAdmin
          .from("user_prompts")
          .insert({
            title: prompt.title,
            content: prompt.content,
            folder_id: newFolderId,
            is_favorite: prompt.isFavorite || false,
            tags: prompt.tags || [],
          })
          .select()
          .single();

        if (error) {
          console.error("Error migrando prompt:", prompt.title, error);
          continue;
        }

        migratedPrompts.push(data.id);
      } catch (error) {
        console.error("Error procesando prompt:", prompt.title, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migración completada",
      stats: {
        foldersTotal: folders.length,
        foldersMigrated: Object.keys(migratedFolders).length,
        promptsTotal: prompts.length,
        promptsMigrated: migratedPrompts.length,
      },
    });
  } catch (error: any) {
    console.error("MIGRATION ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Error en migración" },
      { status: 500 }
    );
  }
}