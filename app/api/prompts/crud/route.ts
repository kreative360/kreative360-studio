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

    console.log("PROMPTS CRUD:", { action, promptId, data }); // Debug

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
  try {
    const { title, content, folderId, tags } = data;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Título y contenido son requeridos" },
        { status: 400 }
      );
    }

    console.log("Creando prompt:", { title, content, folderId, tags }); // Debug

    const { data: prompt, error } = await supabaseAdmin
      .from("user_prompts_v2")  // ← CAMBIADO AQUÍ
      .insert({
        title: title.trim(),
        content: content.trim(),
        folder_id: folderId || null,
        tags: tags || [],
        is_favorite: false,
        user_id: null, // Para permitir usuarios anónimos
      })
      .select()
      .single();

    if (error) {
      console.error("Error insertando en Supabase:", error);
      throw error;
    }

    console.log("Prompt creado exitosamente:", prompt); // Debug

    return NextResponse.json({
      success: true,
      prompt,
    });
  } catch (error: any) {
    console.error("Error en createPrompt:", error);
    return NextResponse.json(
      { error: error.message || "Error creando prompt" },
      { status: 500 }
    );
  }
}

/**
 * Actualizar prompt existente
 */
async function updatePrompt(promptId: string, data: any) {
  try {
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

    console.log("Actualizando prompt:", promptId, updates); // Debug

    const { data: prompt, error } = await supabaseAdmin
      .from("user_prompts_v2")  // ← CAMBIADO AQUÍ
      .update(updates)
      .eq("id", promptId)
      .select()
      .single();

    if (error) {
      console.error("Error actualizando en Supabase:", error);
      throw error;
    }

    console.log("Prompt actualizado exitosamente:", prompt); // Debug

    return NextResponse.json({
      success: true,
      prompt,
    });
  } catch (error: any) {
    console.error("Error en updatePrompt:", error);
    return NextResponse.json(
      { error: error.message || "Error actualizando prompt" },
      { status: 500 }
    );
  }
}

/**
 * Eliminar prompt
 */
async function deletePrompt(promptId: string) {
  try {
    if (!promptId) {
      return NextResponse.json(
        { error: "ID de prompt requerido" },
        { status: 400 }
      );
    }

    console.log("Eliminando prompt:", promptId); // Debug

    const { error } = await supabaseAdmin
      .from("user_prompts_v2")  // ← CAMBIADO AQUÍ
      .delete()
      .eq("id", promptId);

    if (error) {
      console.error("Error eliminando en Supabase:", error);
      throw error;
    }

    console.log("Prompt eliminado exitosamente"); // Debug

    return NextResponse.json({
      success: true,
      message: "Prompt eliminado correctamente",
    });
  } catch (error: any) {
    console.error("Error en deletePrompt:", error);
    return NextResponse.json(
      { error: error.message || "Error eliminando prompt" },
      { status: 500 }
    );
  }
}

/**
 * Marcar/desmarcar como favorito
 */
async function toggleFavorite(promptId: string) {
  try {
    if (!promptId) {
      return NextResponse.json(
        { error: "ID de prompt requerido" },
        { status: 400 }
      );
    }

    console.log("Toggling favorito:", promptId); // Debug

    // Obtener estado actual
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("user_prompts_v2")  // ← CAMBIADO AQUÍ
      .select("is_favorite")
      .eq("id", promptId)
      .single();

    if (fetchError) {
      console.error("Error obteniendo prompt:", fetchError);
      throw fetchError;
    }

    // Invertir estado
    const { data: prompt, error } = await supabaseAdmin
      .from("user_prompts_v2")  // ← CAMBIADO AQUÍ
      .update({ is_favorite: !current.is_favorite })
      .eq("id", promptId)
      .select()
      .single();

    if (error) {
      console.error("Error actualizando favorito:", error);
      throw error;
    }

    console.log("Favorito actualizado exitosamente:", prompt); // Debug

    return NextResponse.json({
      success: true,
      prompt,
    });
  } catch (error: any) {
    console.error("Error en toggleFavorite:", error);
    return NextResponse.json(
      { error: error.message || "Error actualizando favorito" },
      { status: 500 }
    );
  }
}