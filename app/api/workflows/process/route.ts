import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔧 FUNCIÓN PARA OBTENER BASE URL
function getBaseUrl() {
  // En Vercel, usa VERCEL_URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Fallback a variable manual
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // Local development
  return "http://localhost:3000";
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { workflowId } = await request.json();

    console.log(`\n🤖 [PROCESS] Starting workflow: ${workflowId}`);

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "workflowId is required" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();
    console.log(`🌐 [PROCESS] Base URL: ${baseUrl}`);

    // 1. OBTENER WORKFLOW
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error("❌ [PROCESS] Workflow not found:", workflowError);
      return NextResponse.json(
        { success: false, error: "Workflow not found" },
        { status: 404 }
      );
    }

    console.log(`✅ [PROCESS] Found workflow: ${workflow.name}`);

    // 2. MARCAR WORKFLOW COMO PROCESSING
    await supabase
      .from("workflows")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    // 3. OBTENER TODOS LOS ITEMS PENDIENTES
    const { data: items, error: itemsError } = await supabase
      .from("workflow_items")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("status", "pending");

    if (itemsError) {
      console.error("❌ [PROCESS] Error fetching items:", itemsError);
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    console.log(`📊 [PROCESS] Found ${items?.length || 0} pending items`);

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // 4. PROCESAR CADA ITEM SECUENCIALMENTE
    for (let i = 0; i < (items?.length || 0); i++) {
      const item = items![i];
      console.log(`\n📦 [PROCESS] Processing item ${i + 1}/${items!.length}: ${item.reference}`);

      try {
        const processRes = await fetch(
          `${baseUrl}/api/workflows/process-item`,
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
            imagesGenerated: processData.item?.imagesGenerated || 0,
          });
          console.log(`✅ [PROCESS] Item ${item.reference} completed successfully`);
        } else {
          failedCount++;
          results.push({
            reference: item.reference,
            status: "failed",
            error: processData.error,
          });
          console.error(`❌ [PROCESS] Item ${item.reference} failed:`, processData.error);
          
          // Actualizar contador de fallidos
          await supabase
            .from("workflows")
            .update({
              failed_items: failedCount,
            })
            .eq("id", workflowId);
        }
      } catch (error: any) {
        failedCount++;
        results.push({
          reference: item.reference,
          status: "failed",
          error: error.message,
        });
        console.error(`❌ [PROCESS] Error processing item ${item.reference}:`, error.message);
        
        // Actualizar contador de fallidos
        await supabase
          .from("workflows")
          .update({
            failed_items: failedCount,
          })
          .eq("id", workflowId);
      }
    }

    // 5. MARCAR WORKFLOW COMO COMPLETADO
    await supabase
      .from("workflows")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    const duration = Date.now() - startTime;
    console.log(`\n✅ [PROCESS] WORKFLOW COMPLETED - ${duration}ms`);
    console.log(`📊 [PROCESS] Success: ${successCount}, Failed: ${failedCount}\n`);

    return NextResponse.json({
      success: true,
      summary: {
        total: items?.length || 0,
        success: successCount,
        failed: failedCount,
      },
      results,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [PROCESS] WORKFLOW FAILED - ${duration}ms`);
    console.error(`❌ [PROCESS] Error:`, error);

    // Marcar workflow como fallido
    try {
      const { workflowId } = await request.json();
      await supabase
        .from("workflows")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", workflowId);
    } catch (updateError) {
      console.error("❌ [PROCESS] Could not mark workflow as failed:", updateError);
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}