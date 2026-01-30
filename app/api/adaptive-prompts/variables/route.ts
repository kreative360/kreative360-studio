import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const names = searchParams.get("names");

    let query = supabase
      .from("prompt_variables")
      .select("*")
      .order("variable_name", { ascending: true });

    if (names) {
      const nameList = names.split(",").map(n => n.trim());
      query = query.in("variable_name", nameList);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching variables:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      variables: data || [],
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}