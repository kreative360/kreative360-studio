// ==========================================
// KREATIVE 360º - TIPOS TYPESCRIPT
// ==========================================

// ==========================================
// TIPOS BÁSICOS
// ==========================================

export type ApiImage = { 
  base64: string; 
  mime?: string;
};

export type Mode = "csv" | "url" | "local";

export type Engine = "standard" | "pro";

export type ImageFormat = "jpg" | "png" | "webp" | "bmp";

// ==========================================
// PRODUCTOS Y REFERENCIAS
// ==========================================

export interface ProductReference {
  id: string;
  reference: string;
  asin?: string;
  category?: string;
  brand?: string;
  original_image_url?: string;
  original_image_storage_path?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ==========================================
// PROYECTOS E IMÁGENES
// ==========================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export type ValidationStatus = 
  | "pending" 
  | "approved" 
  | "rejected" 
  | "needs_review";

export type GenerationMode = "manual" | "automated";

export interface ProjectImage {
  id: string;
  project_id: string;
  reference?: string;
  reference_id?: string;
  asin?: string;
  image_index: number;
  filename: string;
  mime: string;
  storage_path: string;
  workflow_id?: string;
  job_id?: string;
  generation_mode: GenerationMode;
  validation_status: ValidationStatus;
  created_at: string;
  url?: string;
}

export interface ImageVersion {
  id: string;
  image_id: string;
  version_number: number;
  storage_path: string;
  prompt_used?: string;
  preset_id?: string;
  edit_type: "original" | "generated" | "edited" | "upscaled";
  edit_params?: Record<string, any>;
  created_at: string;
}

// ==========================================
// VALIDACIONES
// ==========================================

export type ReviewStatus = 
  | "pending" 
  | "approved" 
  | "rejected" 
  | "needs_edit";

export interface ImageValidation {
  id: string;
  image_id: string;
  reviewer_id?: string;
  status: ReviewStatus;
  notes?: string;
  reviewed_at?: string;
  created_at: string;
}

// ==========================================
// WORKFLOWS Y AUTOMATIZACIÓN
// ==========================================

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  preset_ids: string[];
  settings: {
    image_size?: string;
    image_format?: ImageFormat;
    engine?: Engine;
    count?: number;
    auto_send_to_project?: boolean;
    target_project_id?: string;
  };
  created_at: string;
}

export type JobStatus = 
  | "pending" 
  | "analyzing" 
  | "generating" 
  | "completed" 
  | "failed";

export interface AutomationJob {
  id: string;
  workflow_id?: string;
  project_id?: string;
  reference_id?: string;
  status: JobStatus;
  progress: number;
  total_steps?: number;
  current_step?: string;
  result?: Record<string, any>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// ==========================================
// PROMPTS
// ==========================================

export interface Preset {
  id: string;
  name: string;
  prompt: string;
}

export interface AdaptivePrompt {
  id: string;
  preset_id: string;
  reference_id?: string;
  category?: string;
  adapted_prompt: string;
  rules_applied?: Record<string, any>;
  created_at: string;
}

// ==========================================
// MÉTRICAS
// ==========================================

export interface GenerationMetrics {
  id: string;
  project_id?: string;
  date: string;
  images_generated: number;
  images_approved: number;
  images_rejected: number;
  references_processed: number;
  avg_generation_time_ms?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

// ==========================================
// ESTADOS DE UI
// ==========================================

export interface GenerationState {
  resultsByRef: Record<string, Record<string, ApiImage[]>>;
  orderMap: Record<string, number>;
  activeRef: string;
  activeAsin?: string;
}

export interface ReviewState {
  currentIndex: number;
  images: ProjectImage[];
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
}
