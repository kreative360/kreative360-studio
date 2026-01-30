import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: workflows, error } = await supabase
      .from("workflows")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching workflows:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Calcular progreso para cada workflow
    const workflowsWithProgress = workflows.map((w) => ({
      ...w,
      progress: w.total_items > 0 ? Math.round((w.processed_items / w.total_items) * 100) : 0,
    }));

    return NextResponse.json({
      success: true,
      workflows: workflowsWithProgress,
    });
  } catch (error: any) {
    console.error("Error in list workflows:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}