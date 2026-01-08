import { supabase } from "./supabaseClient";
import { v4 as uuidv4 } from "uuid";

const BUCKET_NAME = "project-images";

export type AddImageInput = {
  projectId: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  asin?: string | null;
  referencia?: string | null;
};

export async function createProject(
  name: string,
  description?: string
) {
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addImageToProject(input: AddImageInput) {
  const {
    projectId,
    fileBuffer,
    fileName,
    mimeType,
    asin,
    referencia,
  } = input;

  const imageId = uuidv4();

  // Ruta física en storage (NO pierde calidad)
  const storagePath = `${projectId}/${imageId}/${fileName}`;

  // 1️⃣ Subir imagen a Storage (binario puro)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // 2️⃣ Guardar SOLO metadata en BD
  const { data, error } = await supabase
    .from("project_images")
    .insert({
      project_id: projectId,
      asin: asin ?? null,
      referencia: referencia ?? null,
      file_name: fileName,
      mime_type: mimeType,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getProjectImages(projectId: string) {
  const { data, error } = await supabase
    .from("project_images")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function deleteProjectImage(imageId: string, storagePath: string) {
  // 1️⃣ Borrar de storage
  await supabase.storage.from(BUCKET_NAME).remove([storagePath]);

  // 2️⃣ Borrar de BD
  const { error } = await supabase
    .from("project_images")
    .delete()
    .eq("id", imageId);

  if (error) throw error;
}
