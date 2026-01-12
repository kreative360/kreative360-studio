// ==========================================
// KREATIVE 360º - SERVICIOS SUPABASE
// ==========================================

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ProductReference,
  ProjectImage,
  ImageVersion,
  ImageValidation,
  Workflow,
  AutomationJob,
  AdaptivePrompt,
  GenerationMetrics,
  JobStatus,
} from "@/lib/types";

// ==========================================
// PRODUCT REFERENCES
// ==========================================

export async function createProductReference(
  data: Partial<ProductReference>
): Promise<ProductReference> {
  const { data: ref, error } = await supabaseAdmin
    .from("product_references")
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  return ref;
}

export async function getProductReference(
  reference: string
): Promise<ProductReference | null> {
  const { data, error } = await supabaseAdmin
    .from("product_references")
    .select("*")
    .eq("reference", reference)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getProductReferenceById(
  id: string
): Promise<ProductReference | null> {
  const { data, error } = await supabaseAdmin
    .from("product_references")
    .select("*")
    .eq("id", id)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function updateProductReference(
  id: string,
  data: Partial<ProductReference>
): Promise<ProductReference> {
  const { data: ref, error } = await supabaseAdmin
    .from("product_references")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  return ref;
}

export async function getOrCreateProductReference(
  reference: string,
  additionalData?: Partial<ProductReference>
): Promise<ProductReference> {
  const existing = await getProductReference(reference);
  if (existing) return existing;
  
  return await createProductReference({
    reference,
    ...additionalData,
  });
}

// ==========================================
// IMAGE VERSIONS
// ==========================================

export async function createImageVersion(
  data: Partial<ImageVersion>
): Promise<ImageVersion> {
  const { data: version, error } = await supabaseAdmin
    .from("image_versions")
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  return version;
}

export async function getImageVersions(
  imageId: string
): Promise<ImageVersion[]> {
  const { data, error } = await supabaseAdmin
    .from("image_versions")
    .select("*")
    .eq("image_id", imageId)
    .order("version_number", { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function getLatestImageVersion(
  imageId: string
): Promise<ImageVersion | null> {
  const { data, error } = await supabaseAdmin
    .from("image_versions")
    .select("*")
    .eq("image_id", imageId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// ==========================================
// IMAGE VALIDATIONS
// ==========================================

export async function createImageValidation(
  imageId: string,
  status: "pending" | "approved" | "rejected" | "needs_edit",
  notes?: string
): Promise<ImageValidation> {
  const { data: validation, error } = await supabaseAdmin
    .from("image_validations")
    .insert({
      image_id: imageId,
      status,
      notes,
      reviewed_at: status !== "pending" ? new Date().toISOString() : null,
    })
    .select()
    .single();
  
  if (error) throw error;
  return validation;
}

export async function updateImageValidation(
  id: string,
  status: "approved" | "rejected" | "needs_edit",
  notes?: string
): Promise<ImageValidation> {
  const { data: validation, error } = await supabaseAdmin
    .from("image_validations")
    .update({
      status,
      notes,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  return validation;
}

export async function getImageValidation(
  imageId: string
): Promise<ImageValidation | null> {
  const { data, error } = await supabaseAdmin
    .from("image_validations")
    .select("*")
    .eq("image_id", imageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getPendingValidations(
  projectId?: string
): Promise<ProjectImage[]> {
  let query = supabaseAdmin
    .from("project_images")
    .select("*")
    .eq("validation_status", "pending");
  
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  
  const { data, error } = await query.order("created_at", { ascending: true });
  
  if (error) throw error;
  return data || [];
}

// ==========================================
// WORKFLOWS
// ==========================================

export async function createWorkflow(
  data: Partial<Workflow>
): Promise<Workflow> {
  const { data: workflow, error } = await supabaseAdmin
    .from("workflows")
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  return workflow;
}

export async function getWorkflows(): Promise<Workflow[]> {
  const { data, error } = await supabaseAdmin
    .from("workflows")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const { data, error } = await supabaseAdmin
    .from("workflows")
    .select("*")
    .eq("id", id)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function updateWorkflow(
  id: string,
  data: Partial<Workflow>
): Promise<Workflow> {
  const { data: workflow, error } = await supabaseAdmin
    .from("workflows")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  return workflow;
}

export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("workflows")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
}
// ==========================================
// AUTOMATION JOBS
// ==========================================

export async function createAutomationJob(
  data: Partial<AutomationJob>
): Promise<AutomationJob> {
  const { data: job, error } = await supabaseAdmin
    .from("automation_jobs")
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  return job;
}

export async function updateAutomationJob(
  id: string,
  data: Partial<AutomationJob>
): Promise<AutomationJob> {
  const { data: job, error } = await supabaseAdmin
    .from("automation_jobs")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  return job;
}

export async function getAutomationJob(
  id: string
): Promise<AutomationJob | null> {
  const { data, error } = await supabaseAdmin
    .from("automation_jobs")
    .select("*")
    .eq("id", id)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getProjectJobs(
  projectId: string,
  status?: JobStatus
): Promise<AutomationJob[]> {
  let query = supabaseAdmin
    .from("automation_jobs")
    .select("*")
    .eq("project_id", projectId);
  
  if (status) {
    query = query.eq("status", status);
  }
  
  const { data, error } = await query
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getActiveJobs(): Promise<AutomationJob[]> {
  const { data, error } = await supabaseAdmin
    .from("automation_jobs")
    .select("*")
    .in("status", ["pending", "analyzing", "generating"])
    .order("created_at", { ascending: true });
  
  if (error) throw error;
  return data || [];
}

// ==========================================
// ADAPTIVE PROMPTS
// ==========================================

export async function createAdaptivePrompt(
  data: Partial<AdaptivePrompt>
): Promise<AdaptivePrompt> {
  const { data: prompt, error } = await supabaseAdmin
    .from("adaptive_prompts")
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  return prompt;
}

export async function getAdaptivePrompt(
  presetId: string,
  referenceId: string
): Promise<AdaptivePrompt | null> {
  const { data, error } = await supabaseAdmin
    .from("adaptive_prompts")
    .select("*")
    .eq("preset_id", presetId)
    .eq("reference_id", referenceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// ==========================================
// METRICS
// ==========================================

export async function updateMetrics(
  projectId: string,
  updates: {
    images_generated?: number;
    images_approved?: number;
    images_rejected?: number;
    references_processed?: number;
  }
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  
  const { data: existing } = await supabaseAdmin
    .from("generation_metrics")
    .select("*")
    .eq("project_id", projectId)
    .eq("date", today)
    .single();
  
  if (existing) {
    const { error } = await supabaseAdmin
      .from("generation_metrics")
      .update({
        images_generated: 
          (existing.images_generated || 0) + (updates.images_generated || 0),
        images_approved: 
          (existing.images_approved || 0) + (updates.images_approved || 0),
        images_rejected: 
          (existing.images_rejected || 0) + (updates.images_rejected || 0),
        references_processed: 
          (existing.references_processed || 0) + (updates.references_processed || 0),
      })
      .eq("id", existing.id);
    
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from("generation_metrics")
      .insert({
        project_id: projectId,
        date: today,
        ...updates,
      });
    
    if (error) throw error;
  }
}

export async function getProjectMetrics(
  projectId: string,
  days: number = 30
): Promise<GenerationMetrics[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data, error } = await supabaseAdmin
    .from("generation_metrics")
    .select("*")
    .eq("project_id", projectId)
    .gte("date", startDate.toISOString().split("T")[0])
    .order("date", { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function getTodayMetrics(
  projectId?: string
): Promise<GenerationMetrics | null> {
  const today = new Date().toISOString().split("T")[0];
  
  let query = supabaseAdmin
    .from("generation_metrics")
    .select("*")
    .eq("date", today);
  
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  
  const { data, error } = await query.single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}