import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/workflows/process
 * 
 * Motor principal: Procesa TODO el workflow secuencialmente
 * 
 * Body:
 * {
 *   workflowId: "uuid"
 * }
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

    // 2. MARCAR WORKFLOW COMO PROCESSING
    await supabase
      .from("workflows")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    // 3. OBTENER ITEMS PENDIENTES
    const { data: items, error: itemsError } = await supabase
      .from("workflow_items")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (itemsError || !items || items.length === 0) {
      await supabase
        .from("workflows")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", workflowId);

      return NextResponse.json({
        success: true,
        message: "No pending items to process",
      });
    }

    // 4. PROCESAR CADA ITEM SECUENCIALMENTE
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const item of items) {
      try {
        console.log(`Processing item ${item.reference}...`);

        const processRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/workflows/process-item`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workflowId,
              itemId: item.id,
            }),
          }
        );

        const processData = await processRes.json();

        if (processData.success) {
          successCount++;
          results.push({
            reference: item.reference,
            status: "success",
            data: processData.item,
          });
        } else {
          failedCount++;
          results.push({
            reference: item.reference,
            status: "failed",
            error: processData.error,
          });

          // Actualizar contador de fallidos
          await supabase
            .from("workflows")
            .update({ failed_items: failedCount })
            .eq("id", workflowId);
        }
      } catch (error: any) {
        console.error(`Error processing item ${item.reference}:`, error);
        failedCount++;
        results.push({
          reference: item.reference,
          status: "failed",
          error: error.message,
        });
      }
    }

    // 5. MARCAR WORKFLOW COMO COMPLETADO
    await supabase
      .from("workflows")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        failed_items: failedCount,
      })
      .eq("id", workflowId);

    return NextResponse.json({
      success: true,
      summary: {
        total: items.length,
        success: successCount,
        failed: failedCount,
      },
      results,
    });
  } catch (error: any) {
    console.error("Error in process workflow:", error);

    // Marcar workflow como fallado
    if (request.body) {
      const { workflowId } = await request.json();
      await supabase
        .from("workflows")
        .update({ status: "failed" })
        .eq("id", workflowId);
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}