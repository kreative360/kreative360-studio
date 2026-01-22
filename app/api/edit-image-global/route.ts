import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
    console.log('📷 Imagen original:', imageUrl.substring(0, 100));
    console.log('📝 Prompt:', prompt);
    console.log('🖼️ Imagen de referencia:', referenceImage ? 'SÍ adjuntada' : 'NO adjuntada');

    // Fetch de la imagen original
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('No se pudo obtener la imagen');
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Preparar las partes del contenido para Gemini
    const parts: any[] = [];

    // Construir el prompt mejorado
    let enhancedPrompt = prompt;

    if (referenceImage) {
      enhancedPrompt = `INSTRUCCIONES IMPORTANTES:
1. Observa la SEGUNDA IMAGEN adjunta (la imagen de referencia)
2. IDENTIFICA el objeto principal en la imagen de referencia
3. En la PRIMERA IMAGEN (la imagen a editar), REEMPLAZA completamente el objeto mencionado en el prompt por el objeto de la imagen de referencia
4. Mantén el estilo, iluminación y perspectiva de la imagen original
5. El objeto reemplazado debe verse natural e integrado en la escena

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

    // Añadir la imagen de referencia si existe (SEGUNDA IMAGEN)
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

    // Llamar a Gemini con imagen original + referencia
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-latest',
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