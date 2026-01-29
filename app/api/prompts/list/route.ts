import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    console.log("LIST PROMPTS:", { folderId, onlyFavorites, search }); // Debug

    let query = supabaseAdmin
      .from("user_prompts_v2")
      .select("*")
      .order("created_at", { ascending: false });

    // Filtrar por carpeta
    if (folderId) {
      query = query.eq("folder_id", folderId);
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

    if (error) {
      console.error("Error listando prompts:", error);
      throw error;
    }

    console.log("Prompts encontrados:", data?.length || 0); // Debug

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