import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/workflows/status?workflowId=uuid
 * 
 * Obtiene el estado actual de un workflow y sus items
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "workflowId is required" },
        { status: 400 }
      );
    }

    // 1. OBTENER WORKFLOW
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { success: false, error: "Workflow not found" },
        { status: 404 }
      );
    }

    // 2. OBTENER ITEMS CON CONTADORES POR ESTADO
    const { data: items } = await supabase
      .from("workflow_items")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: true });

    const itemsByStatus = {
      pending: items?.filter((i) => i.status === "pending").length || 0,
      processing: items?.filter((i) => i.status === "processing").length || 0,
      completed: items?.filter((i) => i.status === "completed").length || 0,
      failed: items?.filter((i) => i.status === "failed").length || 0,
    };

    // 3. CALCULAR PROGRESO
    const progress = workflow.total_items > 0
      ? Math.round((workflow.processed_items / workflow.total_items) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        progress,
        totalItems: workflow.total_items,
        processedItems: workflow.processed_items,
        failedItems: workflow.failed_items,
        createdAt: workflow.created_at,
        startedAt: workflow.started_at,
        completedAt: workflow.completed_at,
      },
      itemsByStatus,
      items: items || [],
    });
  } catch (error: any) {
    console.error("Error getting workflow status:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}