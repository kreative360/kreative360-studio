import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) throw new Error('Falta GOOGLE_API_KEY o GEMINI_API_KEY');

const genAI = new GoogleGenerativeAI(API_KEY);

// =========================
// Utils
// =========================
function isBase64(ref: string) {
  return ref.startsWith('data:image/') || /^[A-Za-z0-9+/=]+$/.test(ref.slice(0, 40));
}

async function refToBase64(ref: string): Promise<string> {
  if (isBase64(ref)) {
    return ref.replace(/^data:image\/\w+;base64,/, '');
  }

  const res = await fetch(ref);
  if (!res.ok) {
    throw new Error(`No se pudo descargar la imagen: ${ref}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, maskDataUrl, prompt, referenceImage } = await request.json();

    if (!imageUrl || !maskDataUrl || !prompt) {
      return NextResponse.json(
        { error: 'Se requiere imageUrl, maskDataUrl y prompt' },
        { status: 400 }
      );
    }

    console.log('🎨 [LOCAL EDIT] Iniciando edición local con máscara');
    console.log('📝 Prompt:', prompt);
    console.log('🖼️ Imagen de referencia:', referenceImage ? 'SÍ adjuntada' : 'NO adjuntada');

    // Convertir imagen original a base64
    const imageBase64 = await refToBase64(imageUrl);
    
    // Convertir máscara a base64
    const maskBase64 = await refToBase64(maskDataUrl);

    // Construir el prompt mejorado para edición local
    let finalPrompt = `INSTRUCCIONES DE EDICIÓN LOCAL:
Vas a editar SOLO el área específica marcada en una imagen.

LA PRIMERA IMAGEN es la imagen original completa.
LA SEGUNDA IMAGEN es una máscara que muestra en ROJO el área exacta que debes editar.
${referenceImage ? 'LA TERCERA IMAGEN es la imagen de referencia para el reemplazo.' : ''}

ÁREA A EDITAR:
- Solo modifica las áreas marcadas en ROJO en la máscara
- El resto de la imagen NO debe cambiar en absoluto

INSTRUCCIONES DEL USUARIO:
${prompt}

IMPORTANTE:
1. Identifica el área roja en la máscara (SEGUNDA IMAGEN)
2. ${referenceImage ? 'Reemplaza el objeto en esa área por el objeto de la imagen de referencia (TERCERA IMAGEN)' : 'Modifica solo esa área según las instrucciones'}
3. NO toques ninguna otra parte de la imagen
4. Mantén las áreas NO marcadas exactamente iguales
5. Integra el cambio naturalmente con iluminación, perspectiva y estilo
6. El resultado debe verse profesional y sin artefactos
7. Mantén la misma resolución que la imagen original

GENERA LA IMAGEN EDITADA AHORA, editando SOLO el área roja de la máscara.`;

    console.log('✨ Prompt construido para edición local');

    // Preparar las partes para Gemini
    const parts: any[] = [{ text: finalPrompt }];

    // Añadir imagen original (PRIMERA IMAGEN)
    parts.push({
      inlineData: {
        data: imageBase64,
        mimeType: 'image/jpeg',
      },
    });

    // Añadir máscara (SEGUNDA IMAGEN)
    parts.push({
      inlineData: {
        data: maskBase64,
        mimeType: 'image/png',
      },
    });

    // Añadir imagen de referencia si existe (TERCERA IMAGEN)
    if (referenceImage) {
      const refBase64 = await refToBase64(referenceImage);
      parts.push({
        inlineData: {
          data: refBase64,
          mimeType: 'image/jpeg',
        },
      });
      console.log('🖼️ Imagen de referencia añadida al request');
    }

    // Llamar a Gemini con el modelo correcto
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
    });

    console.log('🤖 Enviando a Gemini 2.5 Flash Image...');
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: 2048,
      },
    });

    console.log('✅ Respuesta de Gemini recibida');

    // Extraer la imagen generada
    const img = result.response?.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData && p.inlineData.mimeType.startsWith('image/')
    );

    if (!img) {
      console.error('❌ Gemini no devolvió ninguna imagen');
      return NextResponse.json(
        { error: 'Gemini no generó una imagen válida' },
        { status: 500 }
      );
    }

    console.log('🎨 Imagen editada generada correctamente');

    // Convertir a data URL para el frontend
    const editedImageUrl = `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`;

    return NextResponse.json({
      success: true,
      editedImageUrl,
      message: 'Edición local completada con éxito',
    });

  } catch (error: any) {
    console.error('❌ Error en edición local:', error);
    return NextResponse.json(
      { error: error.message || 'Error al editar la imagen' },
      { status: 500 }
    );
  }
}