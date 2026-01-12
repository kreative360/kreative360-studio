import { NextResponse } from "next/server";
import { createProductReference } from "@/lib/services/supabase.service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reference, asin, category, brand, original_image_url } = body;

    if (!reference) {
      return NextResponse.json(
        { error: "reference es requerido" },
        { status: 400 }
      );
    }

    // Crear la referencia del producto
    const productRef = await createProductReference({
      reference,
      asin: asin || null,
      category: category || null,
      brand: brand || null,
      original_image_url: original_image_url || null,
    });

    return NextResponse.json({
      success: true,
      productReference: productRef,
    });
  } catch (error: any) {
    console.error("Error creating product reference:", error);
    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    );
  }
}