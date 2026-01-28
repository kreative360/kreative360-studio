import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/prompts/crud
 * Operaciones CRUD para prompts
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, promptId, data } = body;

    switch (action) {
      case "create":
        return await createPrompt(data);
      case "update":
        return await updatePrompt(promptId, data);
      case "delete":
        return await deletePrompt(promptId);
      case "toggle-favorite":
        return await toggleFavorite(promptId);
      default:
        return NextResponse.json(
          { error: "Acción no válida" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("PROMPTS CRUD ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Error en operación" },
      { status: 500 }
    );
  }
}

/**
 * Crear nuevo prompt
 */
async function createPrompt(data: any) {
  const { title, content, folderId, tags } = data;

  if (!title || !content) {
    return NextResponse.json(
      { error: "Título y contenido requeridos" },
      { status: 400 }
    );
  }

  const { data: prompt, error } = await supabaseAdmin
    .from("user_prompts")
    .insert({
      title: title.trim(),
      content: content.trim(),
      folder_id: folderId || null,
      tags: tags || [],
      is_favorite: false,
    })
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({
    success: true,
    prompt,
  });
}

/**
 * Actualizar prompt existente
 */
async function updatePrompt(promptId: string, data: any) {
  if (!promptId) {
    return NextResponse.json(
      { error: "ID de prompt requerido" },
      { status: 400 }
    );
  }

  const updates: any = {};

  if (data.title !== undefined) updates.title = data.title.trim();
  if (data.content !== undefined) updates.content = data.content.trim();
  if (data.folderId !== undefined) updates.folder_id = data.folderId;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.isFavorite !== undefined) updates.is_favorite = data.isFavorite;

  const { data: prompt, error } = await supabaseAdmin
    .from("user_prompts")
    .update(updates)
    .eq("id", promptId)
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({
    success: true,
    prompt,
  });
}

/**
 * Eliminar prompt
 */
async function deletePrompt(promptId: string) {
  if (!promptId) {
    return NextResponse.json(
      { error: "ID de prompt requerido" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("user_prompts")
    .delete()
    .eq("id", promptId);

  if (error) throw error;

  return NextResponse.json({
    success: true,
    message: "Prompt eliminado correctamente",
  });
}

/**
 * Marcar/desmarcar como favorito
 */
async function toggleFavorite(promptId: string) {
  if (!promptId) {
    return NextResponse.json(
      { error: "ID de prompt requerido" },
      { status: 400 }
    );
  }

  // Obtener estado actual
  const { data: current, error: fetchError } = await supabaseAdmin
    .from("user_prompts")
    .select("is_favorite")
    .eq("id", promptId)
    .single();

  if (fetchError) throw fetchError;

  // Invertir estado
  const { data: prompt, error } = await supabaseAdmin
    .from("user_prompts")
    .update({ is_favorite: !current.is_favorite })
    .eq("id", promptId)
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({
    success: true,
    prompt,
  });
}