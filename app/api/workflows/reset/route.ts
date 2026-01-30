import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/workflows/reset
 * 
 * Resetea un workflow a estado "pending" para re-ejecutarlo
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

    console.log(`🔄 [RESET] Resetting workflow: ${workflowId}`);

    // 1. Resetear workflow a estado pending
    const { error: workflowError } = await supabase
      .from("workflows")
      .update({
        status: "pending",
        processed_items: 0,
        failed_items: 0,
        started_at: null,
        completed_at: null,
      })
      .eq("id", workflowId);

    if (workflowError) {
      console.error("❌ [RESET] Error updating workflow:", workflowError);
      return NextResponse.json(
        { success: false, error: workflowError.message },
        { status: 500 }
      );
    }

    // 2. Resetear todos los items a pending
    const { error: itemsError } = await supabase
      .from("workflow_items")
      .update({
        status: "pending",
        detected_product_type: null,
        detection_description: null,
        detection_confidence: null,
        generated_prompts: null,
        generated_images: null,
        error_message: null,
        processed_at: null,
      })
      .eq("workflow_id", workflowId);

    if (itemsError) {
      console.error("❌ [RESET] Error updating items:", itemsError);
      return NextResponse.json(
        { success: false, error: itemsError.message },
        { status: 500 }
      );
    }

    console.log(`✅ [RESET] Workflow reset successfully`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [RESET] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}