import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/workflows/test
 * 
 * Prueba cada componente del sistema
 */
export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  // TEST 1: Variables de entorno
  results.tests.push({
    name: "Environment Variables",
    passed: !!(
      process.env.GEMINI_API_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    details: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "✅ Set" : "❌ Missing",
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing",
      SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing",
    },
  });

  // TEST 2: Supabase Connection
  try {
    const { data, error } = await supabase.from("workflows").select("count").limit(1);
    results.tests.push({
      name: "Supabase Connection",
      passed: !error,
      error: error?.message || null,
    });
  } catch (error: any) {
    results.tests.push({
      name: "Supabase Connection",
      passed: false,
      error: error.message,
    });
  }

  // TEST 3: Fetch test image
  const testImageUrl = "https://kasasdecoracion.com/153083-large_default/mueble-tv-frey-chapada-fresno-puertas-en-natural.jpg";
  try {
    const imageRes = await fetch(testImageUrl);
    results.tests.push({
      name: "Fetch Test Image",
      passed: imageRes.ok,
      url: testImageUrl,
      status: imageRes.status,
      statusText: imageRes.statusText,
      headers: {
        contentType: imageRes.headers.get("content-type"),
        contentLength: imageRes.headers.get("content-length"),
      },
    });
  } catch (error: any) {
    results.tests.push({
      name: "Fetch Test Image",
      passed: false,
      error: error.message,
    });
  }

  // TEST 4: Gemini API
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent("Say 'test successful' in JSON format");
    const text = result.response.text();
    
    results.tests.push({
      name: "Gemini API",
      passed: true,
      response: text.substring(0, 100),
    });
  } catch (error: any) {
    results.tests.push({
      name: "Gemini API",
      passed: false,
      error: error.message,
    });
  }

  // Summary
  const passedTests = results.tests.filter((t: any) => t.passed).length;
  const totalTests = results.tests.length;
  results.summary = {
    passed: passedTests,
    failed: totalTests - passedTests,
    total: totalTests,
    allPassed: passedTests === totalTests,
  };

  return NextResponse.json(results);
}