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

function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return "http://localhost:3000";
}

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    baseUrl: getBaseUrl(),
    tests: [],
  };

  // TEST 1: Environment Variables
  console.log("🔍 Testing environment variables...");
  results.tests.push({
    test: "Environment Variables",
    passed: !!(
      process.env.GEMINI_API_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    details: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `✅ Set (${process.env.GEMINI_API_KEY.substring(0, 10)}...)` : "❌ Missing",
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing",
      SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing",
      VERCEL_URL: process.env.VERCEL_URL || "Not set (local)",
    },
  });

  // TEST 2: Supabase Connection
  console.log("🔍 Testing Supabase connection...");
  try {
    const { data, error } = await supabase
      .from("workflows")
      .select("id, name")
      .limit(1);
    
    results.tests.push({
      test: "Supabase Connection",
      passed: !error,
      details: {
        status: error ? "Failed" : "Connected",
        error: error?.message || null,
        sampleData: data?.[0] || "No workflows found",
      },
    });
  } catch (error: any) {
    results.tests.push({
      test: "Supabase Connection",
      passed: false,
      error: error.message,
    });
  }

  // TEST 3: Fetch Test Image
  console.log("🔍 Testing image fetch...");
  const testImageUrl = "https://kasasdecoracion.com/153083-large_default/mueble-tv-frey-chapada-fresno-puertas-en-natural.jpg";
  try {
    const imageRes = await fetch(testImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Kreative360Bot/1.0)',
      },
    });
    
    const contentType = imageRes.headers.get("content-type");
    const contentLength = imageRes.headers.get("content-length");
    
    results.tests.push({
      test: "Fetch Test Image",
      passed: imageRes.ok,
      details: {
        url: testImageUrl,
        status: imageRes.status,
        statusText: imageRes.statusText,
        contentType: contentType,
        contentLengthKB: contentLength ? (parseInt(contentLength) / 1024).toFixed(2) : "Unknown",
      },
    });

    // If image fetch succeeded, try to convert to base64
    if (imageRes.ok) {
      const imageBuffer = await imageRes.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      
      results.tests.push({
        test: "Convert Image to Base64",
        passed: true,
        details: {
          imageSizeKB: (imageBuffer.byteLength / 1024).toFixed(2),
          base64Length: base64Image.length,
        },
      });
    }
  } catch (error: any) {
    results.tests.push({
      test: "Fetch Test Image",
      passed: false,
      error: error.message,
    });
  }

  // TEST 4: Gemini API
  console.log("🔍 Testing Gemini API...");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent("Say 'API test successful' in JSON format with a field called 'status'");
    const text = result.response.text();
    
    results.tests.push({
      test: "Gemini API",
      passed: true,
      details: {
        response: text.substring(0, 200),
        responseLength: text.length,
      },
    });
  } catch (error: any) {
    results.tests.push({
      test: "Gemini API",
      passed: false,
      error: error.message,
    });
  }

  // TEST 5: Analyze-and-Generate API
  console.log("🔍 Testing analyze-and-generate API...");
  try {
    const baseUrl = getBaseUrl();
    const testRes = await fetch(
      `${baseUrl}/api/workflows/analyze-and-generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: "Test Product",
          imageUrl: testImageUrl,
          mode: "global",
          imagesCount: 2,
          globalParams: "test parameters",
        }),
      }
    );

    if (!testRes.ok) {
      const errorText = await testRes.text();
      throw new Error(`API returned ${testRes.status}: ${errorText.substring(0, 200)}`);
    }

    const testData = await testRes.json();
    
    results.tests.push({
      test: "Analyze-and-Generate API",
      passed: testData.success,
      details: {
        status: testRes.status,
        success: testData.success,
        productType: testData.product_type,
        promptsGenerated: testData.prompts?.length || 0,
        error: testData.error || null,
      },
    });
  } catch (error: any) {
    results.tests.push({
      test: "Analyze-and-Generate API",
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

  return NextResponse.json(results, {
    status: results.summary.allPassed ? 200 : 500,
  });
}