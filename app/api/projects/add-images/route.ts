import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateProductReference } from "@/lib/services/supabase.service";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, images, originalImageUrl, promptUsed } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "projectId requerido o inválido" },
        { status: 400 }
      );
    }

    if (!images || !Array.isArray(images)) {
      return NextResponse.json(
        { error: "Datos de imágenes inválidos" },
        { status: 400 }
      );
    }

    const uploadedImages = [];

    for (const image of images) {
      const {
        base64,
        mime,
        filename,
        asin,
        reference,
        image_index,
      } = image;

      if (typeof image_index !== "number") {
        return NextResponse.json(
          { error: "image_index inválido o ausente" },
          { status: 400 }
        );
      }

      if (!base64 || !filename || !mime) {
        return NextResponse.json(
          { error: "Datos de imagen incompletos" },
          { status: 400 }
        );
      }

      // 🆕 AUTO-REPARAR NUMERACIÓN: Buscar índices faltantes (IGNORANDO RECHAZADAS)
      let finalIndex = image_index;

      if (reference) {
        try {
          // 🔧 CAMBIO: Obtener image_index Y validation_status
          const { data: existingImages } = await supabaseAdmin
            .from("project_images")
            .select("image_index, validation_status")
            .eq("project_id", projectId)
            .eq("reference", reference)
            .order("image_index", { ascending: true });

          if (existingImages && existingImages.length > 0) {
            // 🔧 CAMBIO: Filtrar solo imágenes NO rechazadas
            const activeImages = existingImages.filter(
              (img) => img.validation_status !== "rejected"
            );
            
            // Extraer los índices que ya existen (excluyendo rechazadas)
            const usedIndexes = activeImages.map((img) => img.image_index);
            
            // Encontrar el primer hueco en la secuencia (0, 1, 2, ...)
            let foundGap = false;
            for (let i = 0; i < Math.max(...usedIndexes) + 1; i++) {
              if (!usedIndexes.includes(i)) {
                finalIndex = i;
                foundGap = true;
                break;
              }
            }
            
            // Si no hay huecos, usar el siguiente número disponible
            if (!foundGap) {
              finalIndex = Math.max(...usedIndexes) + 1;
            }
          } else {
            // Si no hay imágenes previas, empezar en 0
            finalIndex = 0;
          }
        } catch (error) {
          console.error("Error calculando índice:", error);
          // Si falla, usar el índice original
          finalIndex = image_index;
        }
      }

      // 🆕 CREAR O BUSCAR PRODUCT REFERENCE
      let productReferenceId = null;
      
      if (reference) {
        try {
          const productRef = await getOrCreateProductReference(reference, {
            asin: asin || null,
            original_image_url: originalImageUrl || null,
          });
          productReferenceId = productRef.id;
        } catch (error) {
          console.error("Error creando product reference:", error);
        }
      }

      const buffer = Buffer.from(
        base64.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );

      // Storage path con el índice corregido
      const correctedFilename = reference 
        ? `${reference}_${finalIndex}.${mime.split('/')[1]}`
        : filename;

      const storagePath = `projects/${projectId}/${uuidv4()}-${correctedFilename}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("project-images")
        .upload(storagePath, buffer, {
          contentType: mime,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 🆕 GUARDAR CON EL ÍNDICE CORREGIDO + PROMPT + VERSION
      const { data, error: dbError } = await supabaseAdmin
        .from("project_images")
        .insert({
          project_id: projectId,
          reference: reference ?? null,
          reference_id: productReferenceId,
          asin: asin ?? null,
          image_index: finalIndex,
          filename: correctedFilename,
          mime,
          storage_path: storagePath,
          generation_mode: "manual",
          validation_status: "pending",
          original_image_url: originalImageUrl || null,
          prompt_used: promptUsed || null,
          version_number: 1,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      uploadedImages.push(data);
    }

    return NextResponse.json({
      success: true,
      images: uploadedImages,
    });
  } catch (error: any) {
    console.error("ADD IMAGES ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    );
  }
}