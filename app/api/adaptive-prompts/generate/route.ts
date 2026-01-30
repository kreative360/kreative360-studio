import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templateId, variables, referenceId, saveToHistory = true } = body;

    if (!templateId || !variables) {
      return NextResponse.json(
        { success: false, error: "templateId and variables are required" },
        { status: 400 }
      );
    }

    const { data: template, error: templateError } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      console.error("Template not found:", templateError);
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    let adaptedPrompt = template.template;
    const rulesApplied: any = {
      template: template.title,
      category: template.category,
      variables_used: {},
    };

    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      adaptedPrompt = adaptedPrompt.replace(pattern, value as string);
      rulesApplied.variables_used[key] = value;
    }

    const unreplacedVars = adaptedPrompt.match(/\{\{[^}]+\}\}/g);
    if (unreplacedVars) {
      console.warn("Unreplaced variables found:", unreplacedVars);
      rulesApplied.unreplaced_variables = unreplacedVars;
    }

    if (saveToHistory) {
      const { error: insertError } = await supabase
        .from("adaptive_prompts")
        .insert({
          preset_id: templateId,
          reference_id: referenceId || null,
          category: template.category,
          adapted_prompt: adaptedPrompt,
          rules_applied: rulesApplied,
        });

      if (insertError) {
        console.error("Error saving to history:", insertError);
      }
    }

    return NextResponse.json({
      success: true,
      prompt: adaptedPrompt,
      template: {
        id: template.id,
        title: template.title,
        category: template.category,
      },
      variables_applied: rulesApplied.variables_used,
      unreplaced_variables: unreplacedVars || [],
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}