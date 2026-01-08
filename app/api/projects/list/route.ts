import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LIST PROJECTS ERROR:", error);
      return NextResponse.json(
        { projects: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      projects: data ?? [],
    });
  } catch (err) {
    console.error("LIST PROJECTS FATAL:", err);
    return NextResponse.json(
      { projects: [] },
      { status: 500 }
    );
  }
}
