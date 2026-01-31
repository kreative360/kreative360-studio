import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const limit = searchParams.get("limit");

    let query = supabaseAdmin
      .from("product_references")
      .select("*")
      .order("created_at", { ascending: false });

    // Filtrar por categoría si se proporciona
    if (category) {
      query = query.eq("category", category);
    }

    // Limitar resultados si se proporciona
    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      references: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error("Error listing product references:", error);
    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    );
  }
}