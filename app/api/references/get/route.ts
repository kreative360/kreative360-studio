import { NextResponse } from "next/server";
import { 
  getProductReference, 
  getOrCreateProductReference 
} from "@/lib/services/supabase.service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference");
    const autoCreate = searchParams.get("autoCreate") === "true";

    if (!reference) {
      return NextResponse.json(
        { error: "reference es requerido" },
        { status: 400 }
      );
    }

    let productRef;

    if (autoCreate) {
      // Crear automáticamente si no existe
      productRef = await getOrCreateProductReference(reference);
    } else {
      // Solo buscar
      productRef = await getProductReference(reference);
    }

    if (!productRef && !autoCreate) {
      return NextResponse.json(
        { error: "Referencia no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      productReference: productRef,
    });
  } catch (error: any) {
    console.error("Error getting product reference:", error);
    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    );
  }
}