import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/prompts/folders
 * Lista todas las carpetas
 */
export async function GET(req: Request) {
  try {
    const { data, error } = await supabaseAdmin
      .from("prompt_folders_v2")  // ← CAMBIADO AQUÍ
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      folders: data || [],
    });
  } catch (error: any) {
    console.error("LIST FOLDERS ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Error listando carpetas" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prompts/folders
 * Operaciones CRUD para carpetas
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, folderId, data } = body;

    switch (action) {
      case "create":
        return await createFolder(data);
      case "update":
        return await updateFolder(folderId, data);
      case "delete":
        return await deleteFolder(folderId);
      default:
        return NextResponse.json(
          { error: "Acción no válida" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("FOLDERS CRUD ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Error en operación" },
      { status: 500 }
    );
  }
}

/**
 * Crear nueva carpeta
 */
async function createFolder(data: any) {
  const { name, icon } = data;

  if (!name) {
    return NextResponse.json(
      { error: "Nombre de carpeta requerido" },
      { status: 400 }
    );
  }

  const { data: folder, error } = await supabaseAdmin
    .from("prompt_folders_v2")  // ← CAMBIADO AQUÍ
    .insert({
      name: name.trim(),
      icon: icon || "📁",
    })
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({
    success: true,
    folder,
  });
}

/**
 * Actualizar carpeta existente
 */
async function updateFolder(folderId: string, data: any) {
  if (!folderId) {
    return NextResponse.json(
      { error: "ID de carpeta requerido" },
      { status: 400 }
    );
  }

  const updates: any = {};

  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.icon !== undefined) updates.icon = data.icon;

  const { data: folder, error } = await supabaseAdmin
    .from("prompt_folders_v2")  // ← CAMBIADO AQUÍ
    .update(updates)
    .eq("id", folderId)
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({
    success: true,
    folder,
  });
}

/**
 * Eliminar carpeta
 * Los prompts asociados quedarán sin carpeta (folder_id = null)
 */
async function deleteFolder(folderId: string) {
  if (!folderId) {
    return NextResponse.json(
      { error: "ID de carpeta requerido" },
      { status: 400 }
    );
  }

  // Los prompts quedarán con folder_id = null automáticamente
  // gracias al ON DELETE SET NULL de la foreign key

  const { error } = await supabaseAdmin
    .from("prompt_folders_v2")  // ← CAMBIADO AQUÍ
    .delete()
    .eq("id", folderId);

  if (error) throw error;

  return NextResponse.json({
    success: true,
    message: "Carpeta eliminada correctamente",
  });
}