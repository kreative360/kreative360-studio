import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateProductReference } from "@/lib/services/supabase.service";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, images, originalImageUrl } = body; // 🆕 Nueva propiedad

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

      // 🆕 CREAR O BUSCAR PRODUCT REFERENCE
      let productReferenceId = null;
      
      if (reference) {
        try {
          const productRef = await getOrCreateProductReference(reference, {
            asin: asin || null,
            original_image_url: originalImageUrl || null, // 🆕 Guardar URL original
          });
          productReferenceId = productRef.id;
        } catch (error) {
          console.error("Error creando product reference:", error);
          // Continuar sin vincular si falla
        }
      }

      const buffer = Buffer.from(
        base64.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );

      // Storage path
      const storagePath = `projects/${projectId}/${uuidv4()}-${filename}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("project-images")
        .upload(storagePath, buffer, {
          contentType: mime,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 🆕 GUARDAR CON reference_id y original_image_url
      const { data, error: dbError } = await supabaseAdmin
        .from("project_images")
        .insert({
          project_id: projectId,
          reference: reference ?? null,
          reference_id: productReferenceId,
          asin: asin ?? null,
          image_index,
          filename,
          mime,
          storage_path: storagePath,
          generation_mode: "manual",
          validation_status: "pending",
          original_image_url: originalImageUrl || null, // 🆕 Guardar URL original
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