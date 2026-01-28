import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/prompts/list
 * Lista todos los prompts del usuario actual
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");
    const onlyFavorites = searchParams.get("favorites") === "true";
    const search = searchParams.get("search");

    let query = supabaseAdmin
      .from("user_prompts")
      .select("*")
      .order("created_at", { ascending: false });

    // Filtrar por carpeta
    if (folderId) {
      query = query.eq("folder_id", folderId);
    } else if (folderId === null) {
      query = query.is("folder_id", null);
    }

    // Filtrar solo favoritos
    if (onlyFavorites) {
      query = query.eq("is_favorite", true);
    }

    // Búsqueda por texto
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,content.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      prompts: data || [],
    });
  } catch (error: any) {
    console.error("LIST PROMPTS ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Error listando prompts" },
      { status: 500 }
    );
  }
}