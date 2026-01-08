import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select(`
        id,
        name,
        created_at,
        project_images(count)
      `)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ projects: [] }, { status: 500 });
    }

    const projects = (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      imagesCount: p.project_images?.[0]?.count ?? 0,
    }));

    return NextResponse.json({ projects });
  } catch (err) {
    console.error("Fatal error:", err);
    return NextResponse.json({ projects: [] }, { status: 500 });
  }
}
