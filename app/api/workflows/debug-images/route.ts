import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { workflowId } = await req.json();

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "workflowId requerido" },
        { status: 400 }
      );
    }

    console.log("🔍 [DEBUG] Buscando imágenes para workflow:", workflowId);

    // 1. Obtener datos del workflow
    const { data: workflow, error: workflowError } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError) throw workflowError;

    console.log("📋 [DEBUG] Workflow encontrado:", {
      name: workflow.name,
      project_id: workflow.project_id,
      total_items: workflow.total_items,
      processed_items: workflow.processed_items,
    });

    // 2. Buscar items del workflow
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("workflow_items")
      .select("*")
      .eq("workflow_id", workflowId);

    if (itemsError) throw itemsError;

    console.log("📦 [DEBUG] Items encontrados:", items?.length || 0);

    // 3. Buscar imágenes en project_images del proyecto correcto
    const { data: imagesInProject, error: imagesError } = await supabaseAdmin
      .from("project_images")
      .select("*")
      .eq("project_id", workflow.project_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (imagesError) throw imagesError;

    console.log("🖼️ [DEBUG] Imágenes en proyecto correcto:", imagesInProject?.length || 0);

    // 4. Buscar imágenes huérfanas (todas las recientes)
    const { data: allRecentImages, error: allImagesError } = await supabaseAdmin
      .from("project_images")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (allImagesError) throw allImagesError;

    // Filtrar imágenes del día de hoy
    const today = new Date().toISOString().split('T')[0];
    const todayImages = allRecentImages?.filter(img => 
      img.created_at?.startsWith(today)
    ) || [];

    console.log("📅 [DEBUG] Imágenes generadas hoy:", todayImages.length);

    // 5. Buscar imágenes que podrían ser del workflow (por referencia en prompt)
    const references = items?.map(item => item.reference) || [];
    const possibleImages = todayImages.filter(img => 
      references.some(ref => img.prompt?.includes(ref))
    );

    console.log("🎯 [DEBUG] Posibles imágenes del workflow:", possibleImages.length);

    // 6. Agrupar imágenes por project_id
    const imagesByProject: any = {};
    todayImages.forEach(img => {
      const pid = img.project_id || 'sin_proyecto';
      if (!imagesByProject[pid]) {
        imagesByProject[pid] = [];
      }
      imagesByProject[pid].push(img);
    });

    return NextResponse.json({
      success: true,
      debug: {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          project_id: workflow.project_id,
          total_items: workflow.total_items,
          processed_items: workflow.processed_items,
          failed_items: workflow.failed_items,
        },
        items: items?.length || 0,
        imagesInCorrectProject: imagesInProject?.length || 0,
        imagesToday: todayImages.length,
        possibleWorkflowImages: possibleImages.length,
        imagesByProject: Object.keys(imagesByProject).map(pid => ({
          project_id: pid,
          count: imagesByProject[pid].length,
        })),
        possibleImages: possibleImages.slice(0, 10).map(img => ({
          id: img.id,
          project_id: img.project_id,
          prompt: img.prompt?.substring(0, 100) + '...',
          created_at: img.created_at,
        })),
      },
    });

  } catch (error: any) {
    console.error("❌ [DEBUG] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}