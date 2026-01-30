import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/workflows/delete
 * 
 * Elimina un workflow y todos sus items
 */
export async function POST(request: Request) {
  try {
    const { workflowId } = await request.json();

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "workflowId is required" },
        { status: 400 }
      );
    }

    console.log(`🗑️ [DELETE] Deleting workflow: ${workflowId}`);

    // 1. Eliminar workflow (los items se eliminan en cascada por ON DELETE CASCADE)
    const { error } = await supabase
      .from("workflows")
      .delete()
      .eq("id", workflowId);

    if (error) {
      console.error("❌ [DELETE] Error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ [DELETE] Workflow deleted successfully`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [DELETE] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}