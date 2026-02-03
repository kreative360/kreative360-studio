import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/workflows/retry-failed
 * 
 * Re-procesa los items que fallaron en un workflow.
 * Resetea su status a "pending" para que puedan ser procesados de nuevo.
 */
export async function POST(request: Request) {
  try {
    const { workflowId } = await request.json();

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "workflowId required" },
        { status: 400 }
      );
    }

    console.log(`🔄 [RETRY-FAILED] Starting retry for workflow: ${workflowId}`);

    // 1. Obtener items fallidos
    const { data: failedItems, error: fetchError } = await supabase
      .from("workflow_items")
      .select("id, reference, product_name, error_message")
      .eq("workflow_id", workflowId)
      .eq("status", "failed");

    if (fetchError) {
      console.error("❌ [RETRY-FAILED] Error fetching failed items:", fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!failedItems || failedItems.length === 0) {
      console.log("ℹ️ [RETRY-FAILED] No failed items found");
      return NextResponse.json({
        success: true,
        message: "No failed items to retry",
        retriedCount: 0,
        failedReferences: []
      });
    }

    console.log(`📊 [RETRY-FAILED] Found ${failedItems.length} failed items`);

    // 2. Resetear status a pending y limpiar error
    const { error: resetError } = await supabase
      .from("workflow_items")
      .update({
        status: "pending",
        error_message: null,
        generated_prompts: null,
        generated_images: null,
      })
      .eq("workflow_id", workflowId)
      .eq("status", "failed");

    if (resetError) {
      console.error("❌ [RETRY-FAILED] Error resetting items:", resetError);
      return NextResponse.json(
        { success: false, error: resetError.message },
        { status: 500 }
      );
    }

    // 3. Obtener contadores actualizados
    const { count: completedCount } = await supabase
      .from("workflow_items")
      .select("*", { count: "exact", head: true })
      .eq("workflow_id", workflowId)
      .eq("status", "completed");

    // 4. Actualizar workflow
    const { error: updateError } = await supabase
      .from("workflows")
      .update({
        failed_items: 0,
        processed_items: completedCount || 0,
      })
      .eq("id", workflowId);

    if (updateError) {
      console.error("❌ [RETRY-FAILED] Error updating workflow:", updateError);
    }

    console.log(`✅ [RETRY-FAILED] Reset ${failedItems.length} items to pending`);

    return NextResponse.json({
      success: true,
      retriedCount: failedItems.length,
      failedReferences: failedItems.map(item => ({
        reference: item.reference,
        productName: item.product_name,
        error: item.error_message
      }))
    });

  } catch (error: any) {
    console.error("❌ [RETRY-FAILED] Fatal error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workflows/retry-failed?workflowId=xxx
 * 
 * Lista los items fallidos sin resetearlos
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "workflowId required" },
        { status: 400 }
      );
    }

    const { data: failedItems, error } = await supabase
      .from("workflow_items")
      .select("id, reference, product_name, error_message, image_urls")
      .eq("workflow_id", workflowId)
      .eq("status", "failed")
      .order("reference", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      failedItems: failedItems || [],
      count: (failedItems || []).length
    });

  } catch (error: any) {
    console.error("❌ [RETRY-FAILED-GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}