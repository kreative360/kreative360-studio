import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
    console.log('📷 Imagen original:', imageUrl.substring(0, 100));
    console.log('🖌️ Máscara recibida (base64)');
    console.log('📝 Prompt:', prompt);
    console.log('🖼️ Imagen de referencia:', referenceImage ? 'SÍ adjuntada' : 'NO adjuntada');

    // Fetch de la imagen original
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('No se pudo obtener la imagen');
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Extraer base64 de la máscara
    const maskBase64 = maskDataUrl.split(',')[1];

    // Preparar las partes del contenido para Gemini
    const parts: any[] = [];

    // Construir el prompt mejorado
    let enhancedPrompt = `Edita ÚNICAMENTE el área marcada en blanco en la máscara. ${prompt}`;

    if (referenceImage) {
      enhancedPrompt = `INSTRUCCIONES IMPORTANTES:
1. Observa la TERCERA IMAGEN adjunta (la imagen de referencia)
2. IDENTIFICA el objeto principal en la imagen de referencia
3. En la PRIMERA IMAGEN (la imagen a editar), localiza el área marcada en BLANCO en la SEGUNDA IMAGEN (la máscara)
4. REEMPLAZA el objeto en esa área por el objeto de la imagen de referencia
5. Mantén el estilo, iluminación y perspectiva de la imagen original
6. El objeto reemplazado debe verse natural e integrado en la escena
7. NO modifiques las áreas en NEGRO de la máscara

PROMPT DEL USUARIO: ${prompt}

IMPORTANTE: Debes CAMBIAR físicamente el objeto en la imagen, no solo ajustar colores o estilos.`;

      console.log('✨ Prompt mejorado con imagen de referencia');
    }

    // Añadir el prompt
    parts.push({ text: enhancedPrompt });

    // Añadir la imagen original (PRIMERA IMAGEN)
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Image,
      },
    });

    // Añadir la máscara (SEGUNDA IMAGEN)
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: maskBase64,
      },
    });

    // Añadir la imagen de referencia si existe (TERCERA IMAGEN)
    if (referenceImage) {
      const base64Data = referenceImage.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data,
        },
      });
      console.log('🖼️ Imagen de referencia añadida al request');
    }

    // Llamar a Gemini con imagen + máscara + referencia
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    console.log('🤖 Enviando a Gemini Flash 2.0...');
    const result = await model.generateContent(parts);
    const response = result.response;
    const generatedText = response.text();

    console.log('✅ Respuesta de Gemini recibida');

    // Extraer URL de la imagen generada
    const imageUrlMatch = generatedText.match(/https:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp)/i);
    
    if (!imageUrlMatch) {
      console.error('❌ No se encontró URL de imagen en la respuesta');
      console.log('Respuesta completa:', generatedText);
      return NextResponse.json(
        { error: 'No se generó una imagen válida' },
        { status: 500 }
      );
    }

    const editedImageUrl = imageUrlMatch[0];
    console.log('🎨 Imagen editada:', editedImageUrl.substring(0, 100));

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