import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // 🚀 OPTIMIZACIÓN: Una sola query con COUNT
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select(`
        id,
        name,
        project_images(count)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LIST PROJECTS ERROR:", error);
      return NextResponse.json(
        { projects: [] },
        { status: 500 }
      );
    }

    // Transformar el resultado para incluir imagesCount
    const projectsWithCount = (data ?? []).map((project: any) => ({
      id: project.id,
      name: project.name,
      imagesCount: project.project_images?.[0]?.count || 0,
    }));

    return NextResponse.json({
      projects: projectsWithCount,
    });
  } catch (err) {
    console.error("LIST PROJECTS FATAL:", err);
    return NextResponse.json(
      { projects: [] },
      { status: 500 }
    );
  }
}