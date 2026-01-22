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
    const { imageUrl, prompt, referenceImage } = await request.json();

    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { error: 'Se requiere imageUrl y prompt' },
        { status: 400 }
      );
    }

    console.log('🌐 [GLOBAL EDIT] Iniciando edición global');
    console.log('📝 Prompt:', prompt);
    console.log('🖼️ Imagen de referencia:', referenceImage ? 'SÍ adjuntada' : 'NO adjuntada');

    // Convertir imagen original a base64
    const imageBase64 = await refToBase64(imageUrl);

    // Construir el prompt mejorado para edición
    let finalPrompt = prompt;

    if (referenceImage) {
      finalPrompt = `INSTRUCCIONES DE EDICIÓN:
Vas a editar una imagen según estas instrucciones específicas.

LA PRIMERA IMAGEN es la imagen original que debes editar.
${referenceImage ? 'LA SEGUNDA IMAGEN es la imagen de referencia que debes usar para el reemplazo.' : ''}

INSTRUCCIONES DEL USUARIO:
${prompt}

IMPORTANTE:
1. Identifica el objeto/elemento mencionado en las instrucciones en la imagen original
2. ${referenceImage ? 'Reemplázalo exactamente por el objeto de la imagen de referencia' : 'Modifícalo según las instrucciones'}
3. Mantén el resto de la imagen sin cambios
4. Integra el cambio de forma natural con la iluminación, perspectiva y estilo de la imagen original
5. El resultado debe verse profesional y sin artefactos
6. Mantén la misma resolución y calidad que la imagen original

GENERA LA IMAGEN EDITADA AHORA.`;

      console.log('✨ Prompt mejorado con imagen de referencia');
    }

    // Preparar las partes para Gemini
    const parts: any[] = [{ text: finalPrompt }];

    // Añadir imagen original (PRIMERA IMAGEN)
    parts.push({
      inlineData: {
        data: imageBase64,
        mimeType: 'image/jpeg',
      },
    });

    // Añadir imagen de referencia si existe (SEGUNDA IMAGEN)
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
      message: 'Imagen editada globalmente con éxito',
    });

  } catch (error: any) {
    console.error('❌ Error en edición global:', error);
    return NextResponse.json(
      { error: error.message || 'Error al editar la imagen' },
      { status: 500 }
    );
  }
}