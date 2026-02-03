"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Workflow = {
  id: string;
  name: string;
  status: string;
  progress: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  createdAt: string;
  project_id?: string;
  prompt_mode?: string;
  images_per_reference?: number;
  global_params?: string;
  specific_prompts?: string[];
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);

  // Estado del formulario
  const [workflowName, setWorkflowName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [mode, setMode] = useState<"global" | "specific">("global");
  const [imagesPerReference, setImagesPerReference] = useState(5);
  const [globalParams, setGlobalParams] = useState("ambiente de uso hiperrealista, estética minimalista, respeta diseño 100%");
  const [specificPrompts, setSpecificPrompts] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [replaceCsv, setReplaceCsv] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  // 🆕 NUEVOS ESTADOS - Configuración de imagen
  const [imageSize, setImageSize] = useState("1024x1024");
  const [imageFormat, setImageFormat] = useState("jpg");
  const [engine, setEngine] = useState<"standard" | "pro">("standard");

  useEffect(() => {
    loadWorkflows();
  }, []);

  useEffect(() => {
    const hasProcessing = workflows.some(w => w.status === "processing");
    
    if (hasProcessing) {
      const interval = setInterval(() => {
        loadWorkflows();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [workflows]);

  useEffect(() => {
    if (mode === "specific") {
      setSpecificPrompts(
        Array(imagesPerReference).fill("").map((_, i) => specificPrompts[i] || "")
      );
    }
  }, [imagesPerReference, mode]);

  const loadWorkflows = async () => {
    try {
      const res = await fetch("/api/workflows/list");
      const data = await res.json();
      if (data.success) {
        setWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error("Error loading workflows:", error);
    } finally {
      setLoading(false);
    }
  };

  const parseCSV = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        let text = e.target?.result as string;
        
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.substring(1);
        }
        
        console.log("📄 CSV Parser - Kasas Decoración Format");
        
        const lines = text.split("\n").filter((line) => line.trim());
        
        if (lines.length < 2) {
          reject(new Error("CSV debe tener al menos 2 líneas (header + datos)"));
          return;
        }
        
        const dataLines = lines.slice(1);
        
        console.log(`📊 Total líneas de datos: ${dataLines.length}`);
        
        const items = dataLines.map((line, idx) => {
          const cols = line.split(";").map((v) => v.trim());
          
          const reference = cols[0] || "";
          const asin = cols[1] || "";
          const productName = cols[2] || "";
          const url1 = cols[3] || "";
          const url2 = cols[4] || "";
          const url3 = cols[5] || "";
          const url4 = cols[6] || "";
          const url5 = cols[7] || "";
          
          const imageUrls = [url1, url2, url3, url4, url5]
            .filter((url) => url && url.startsWith("http"));
          
          if (!reference) {
            console.warn(`⚠️ Línea ${idx + 2}: Sin referencia (OBLIGATORIO), ignorando`);
            return null;
          }
          
          if (imageUrls.length === 0) {
            console.warn(`⚠️ Línea ${idx + 2} (${reference}): Sin URL 1 válida (OBLIGATORIO), ignorando`);
            return null;
          }
          
          const finalProductName = productName || asin || reference;
          
          const item = {
            reference: reference,
            productName: finalProductName,
            asin: asin || null,
            imageUrls: imageUrls,
          };
          
          console.log(`✅ Item ${idx + 1}:`, {
            ref: item.reference,
            name: item.productName,
            asin: item.asin || "(vacío)",
            urls: item.imageUrls.length,
          });
          
          return item;
        }).filter(Boolean);
        
        console.log(`\n🎯 RESULTADO FINAL: ${items.length} productos válidos`);
        
        if (items.length > 0) {
          console.log("📦 Primer producto:", items[0]);
          console.log("📦 URLs del primer producto:", items[0].imageUrls);
        }
        
        if (items.length === 0) {
          reject(new Error("No se encontraron productos válidos. Verifica que cada línea tenga REFERENCIA y URL 1"));
          return;
        }
        
        resolve(items);
      };
      
      reader.onerror = (error) => {
        console.error("❌ Error leyendo archivo:", error);
        reject(new Error("Error leyendo el archivo CSV"));
      };
      
      reader.readAsText(file, "UTF-8");
    });
  };

  const handleCreateWorkflow = async () => {
    if (!workflowName || !projectId || !csvFile) {
      alert("Por favor completa todos los campos requeridos");
      return;
    }

    if (mode === "specific") {
      const emptyPrompts = specificPrompts.filter((p) => !p.trim());
      if (emptyPrompts.length > 0) {
        alert("Por favor completa todos los prompts específicos");
        return;
      }
    }

    setCreating(true);

    try {
      const items = await parseCSV(csvFile);
      
      if (items.length === 0) {
        throw new Error("El CSV no contiene datos válidos");
      }

      console.log(`📤 Enviando workflow con ${items.length} items`);

      const res = await fetch("/api/workflows/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName,
          projectId,
          mode,
          imagesPerReference,
          globalParams: mode === "global" ? globalParams : null,
          specificPrompts: mode === "specific" ? specificPrompts : null,
          imageSize,        // 🆕 NUEVO
          imageFormat,      // 🆕 NUEVO
          engine,           // 🆕 NUEVO
          items,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Error creando workflow");
      }

      alert(`✅ Workflow "${workflowName}" creado con ${items.length} referencias`);
      setShowCreateModal(false);
      loadWorkflows();
      
      // Reset form
      setWorkflowName("");
      setProjectId("");
      setCsvFile(null);
      setGlobalParams("ambiente de uso hiperrealista, estética minimalista, respeta diseño 100%");
      setSpecificPrompts([]);
      setImageSize("1024x1024");
      setImageFormat("jpg");
      setEngine("standard");
    } catch (error: any) {
      console.error("❌ Error creating workflow:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setWorkflowName(workflow.name);
    setProjectId(workflow.project_id || "");
    setMode((workflow.prompt_mode as "global" | "specific") || "global");
    setImagesPerReference(workflow.images_per_reference || 5);
    setGlobalParams(workflow.global_params || "");
    setSpecificPrompts(workflow.specific_prompts || []);
    setReplaceCsv(false);
    setCsvFile(null);
    setShowEditModal(true);
  };

  const handleUpdateWorkflow = async () => {
    if (!workflowName || !editingWorkflow) {
      alert("Por favor completa el nombre del workflow");
      return;
    }

    if (!projectId) {
      alert("Por favor completa el ID del proyecto");
      return;
    }

    if (mode === "specific") {
      const emptyPrompts = specificPrompts.filter((p) => !p.trim());
      if (emptyPrompts.length > 0) {
        alert("Por favor completa todos los prompts específicos");
        return;
      }
    }

    if (replaceCsv && !csvFile) {
      alert("Por favor selecciona un archivo CSV");
      return;
    }

    setUpdating(true);

    try {
      let newItems = null;

      if (replaceCsv && csvFile) {
        newItems = await parseCSV(csvFile);
        
        if (newItems.length === 0) {
          throw new Error("El CSV no contiene datos válidos");
        }

        console.log(`📤 Nuevo CSV con ${newItems.length} items`);
      }

      const res = await fetch("/api/workflows/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: editingWorkflow.id,
          name: workflowName,
          projectId: projectId,
          mode,
          imagesPerReference,
          globalParams: mode === "global" ? globalParams : null,
          specificPrompts: mode === "specific" ? specificPrompts : null,
          imageSize,        // 🆕 NUEVO
          imageFormat,      // 🆕 NUEVO
          engine,           // 🆕 NUEVO
          items: newItems,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Error actualizando workflow");
      }

      alert(`✅ Workflow "${workflowName}" actualizado correctamente`);
      setShowEditModal(false);
      setEditingWorkflow(null);
      setReplaceCsv(false);
      setCsvFile(null);
      loadWorkflows();
      
      // Reset form
      setWorkflowName("");
      setProjectId("");
      setGlobalParams("ambiente de uso hiperrealista, estética minimalista, respeta diseño 100%");
      setSpecificPrompts([]);
      setImageSize("1024x1024");
      setImageFormat("jpg");
      setEngine("standard");
    } catch (error: any) {
      console.error("❌ Error updating workflow:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const startWorkflow = async (workflowId: string) => {
    if (!confirm("¿Iniciar procesamiento de este workflow? Esto puede tardar varios minutos.")) {
      return;
    }

    try {
      setWorkflows(prev => prev.map(w => 
        w.id === workflowId ? { ...w, status: "processing" } : w
      ));

      const res = await fetch("/api/workflows/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });

      const data = await res.json();

      if (data.success) {
        alert(`✅ Workflow completado: ${data.summary.success} exitosos, ${data.summary.failed} fallidos`);
        loadWorkflows();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      loadWorkflows();
    }
  };

  const deleteWorkflow = async (workflowId: string, workflowName: string) => {
    if (!confirm(`¿Eliminar el workflow "${workflowName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch("/api/workflows/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });

      const data = await res.json();

      if (data.success) {
        alert(`✅ Workflow "${workflowName}" eliminado`);
        loadWorkflows();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const resetWorkflow = async (workflowId: string) => {
    if (!confirm("¿Re-ejecutar este workflow? Esto marcará todos los items como pendientes y volverá a procesarlos.")) {
      return;
    }

    try {
      const res = await fetch("/api/workflows/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ Workflow reseteado. Puedes ejecutarlo nuevamente.");
        loadWorkflows();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // 🆕 NUEVA FUNCIÓN - Retry de items fallidos
  const retryFailedItems = async (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow || workflow.failedItems === 0) return;

    if (!confirm(`¿Re-procesar las ${workflow.failedItems} referencias que fallaron?`)) return;

    try {
      const res = await fetch("/api/workflows/retry-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });

      const data = await res.json();

      if (data.success) {
        alert(
          `✅ ${data.retriedCount} referencias resetadas a "pending".\n\n` +
          `Referencias que se volverán a procesar:\n` +
          data.failedReferences.map((item: any) => `• ${item.reference}`).join('\n') +
          `\n\nAhora puedes ejecutar el workflow de nuevo.`
        );
        loadWorkflows();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error retrying failed items:", error);
      alert("❌ Error al re-procesar referencias fallidas");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#ff6b6b", marginBottom: 8 }}>
              Workflows Automáticos
            </h1>
            <p style={{ fontSize: 16, color: "#6b7280" }}>
              Procesamiento masivo de catálogos con prompts adaptativos
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "12px 24px",
              background: "#ff6b6b",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            + Nuevo Workflow
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#6b7280" }}>
            Cargando workflows...
          </div>
        ) : workflows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80, color: "#6b7280" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🤖</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              No hay workflows creados
            </h3>
            <p style={{ fontSize: 14 }}>
              Crea tu primer workflow para comenzar el procesamiento masivo
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                style={{
                  background: "#fff",
                  border: workflow.status === "processing" ? "2px solid #ff6b6b" : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 20,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {workflow.status === "processing" && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: "linear-gradient(90deg, #ff6b6b, #ffa07a, #ff6b6b)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 2s linear infinite",
                    }}
                  />
                )}
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                        {workflow.name}
                      </h3>
                      {workflow.status === "processing" && (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            border: "3px solid #e5e7eb",
                            borderTop: "3px solid #ff6b6b",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                      )}
                    </div>
                    
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6b7280" }}>
                      <span>📊 {workflow.totalItems} referencias</span>
                      <span>✅ {workflow.processedItems} procesadas</span>
                      {workflow.failedItems > 0 && (
                        <span style={{ color: "#ef4444" }}>❌ {workflow.failedItems} fallidas</span>
                      )}
                    </div>
                    
                    {workflow.status === "processing" && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center", 
                          marginBottom: 6 
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#ff6b6b" }}>
                            🔄 Procesando...
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
                            {workflow.progress}%
                          </span>
                        </div>
                        <div style={{ 
                          height: 8, 
                          background: "#e5e7eb", 
                          borderRadius: 4, 
                          overflow: "hidden" 
                        }}>
                          <div
                            style={{
                              height: "100%",
                              background: "linear-gradient(90deg, #ff6b6b, #ffa07a)",
                              width: `${workflow.progress}%`,
                              transition: "width 0.5s ease-out",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {workflow.status === "pending" && (
                      <button
                        onClick={() => startWorkflow(workflow.id)}
                        style={{
                          padding: "8px 16px",
                          background: "#10b981",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        ▶ Iniciar
                      </button>
                    )}
                    
                    {/* 🆕 NUEVO BOTÓN - Re-procesar Fallidos */}
                    {workflow.failedItems > 0 && workflow.status !== "processing" && (
                      <button
                        onClick={() => retryFailedItems(workflow.id)}
                        style={{
                          padding: "8px 16px",
                          background: "#f59e0b",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        title="Re-procesar solo las referencias que fallaron"
                      >
                        🔄 Re-procesar Fallidos ({workflow.failedItems})
                      </button>
                    )}
                    
                    {workflow.status !== "processing" && (
                      <button
                        onClick={() => openEditModal(workflow)}
                        style={{
                          padding: "8px 16px",
                          background: "#ff6b6b",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        ✏️ Editar
                      </button>
                    )}
                    
                    {(workflow.status === "completed" || workflow.status === "failed") && (
                      <button
                        onClick={() => resetWorkflow(workflow.id)}
                        style={{
                          padding: "8px 16px",
                          background: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        🔄 Re-ejecutar
                      </button>
                    )}
                    
                    {workflow.status !== "processing" && (
                      <button
                        onClick={() => deleteWorkflow(workflow.id, workflow.name)}
                        style={{
                          padding: "8px 16px",
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                    
                    <span
                      style={{
                        padding: "8px 16px",
                        background:
                          workflow.status === "completed"
                            ? "#d1fae5"
                            : workflow.status === "processing"
                            ? "#fef3c7"
                            : workflow.status === "failed"
                            ? "#fee2e2"
                            : "#f3f4f6",
                        color:
                          workflow.status === "completed"
                            ? "#065f46"
                            : workflow.status === "processing"
                            ? "#92400e"
                            : workflow.status === "failed"
                            ? "#991b1b"
                            : "#374151",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {workflow.status === "processing" ? "Procesando" : workflow.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 20,
          }}
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 32,
              maxWidth: 800,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
              Crear Nuevo Workflow
            </h2>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Nombre del Workflow *
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Ej: Catálogo Casas Decoración"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                ID del Proyecto *
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="UUID del proyecto en Supabase"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                💡 Encuentra el ID en Supabase → projects table
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Imágenes por Referencia *
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={imagesPerReference}
                onChange={(e) => setImagesPerReference(parseInt(e.target.value) || 1)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>

            {/* 🆕 NUEVO SELECTOR - Tamaño de imagen */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#111827", fontSize: 14 }}>
                📐 Tamaño de imagen
              </label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <option value="1024x1024">1:1 (cuadrado) · 1024×1024px</option>
                <option value="2000x2000">2:2 (cuadrado) · 2000×2000px</option>
              </select>
            </div>

            {/* 🆕 NUEVO SELECTOR - Formato */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#111827", fontSize: 14 }}>
                📄 Formato de archivo
              </label>
              <select
                value={imageFormat}
                onChange={(e) => setImageFormat(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <option value="jpg">JPG (recomendado)</option>
                <option value="png">PNG (con transparencia)</option>
                <option value="webp">WEBP (más ligero)</option>
              </select>
            </div>

            {/* 🆕 NUEVO SELECTOR - Modelo IA */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#111827", fontSize: 14 }}>
                🤖 Modelo de IA
              </label>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value as "standard" | "pro")}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <option value="standard">⚡ Standard (Rápido - Recomendado)</option>
                <option value="pro">💎 Pro (Máxima calidad)</option>
              </select>
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                {engine === "standard" 
                  ? "Generación rápida con buena calidad"
                  : "Mejor calidad pero más lento (2-3x tiempo)"
                }
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Modo de Prompts *
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setMode("global")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: mode === "global" ? "#ff6b6b" : "#f3f4f6",
                    color: mode === "global" ? "#fff" : "#374151",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Global
                </button>
                <button
                  onClick={() => setMode("specific")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: mode === "specific" ? "#ff6b6b" : "#f3f4f6",
                    color: mode === "specific" ? "#fff" : "#374151",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Específico
                </button>
              </div>
            </div>

            {mode === "global" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Parámetros Globales
                </label>
                <textarea
                  value={globalParams}
                  onChange={(e) => setGlobalParams(e.target.value)}
                  placeholder="Ej: ambiente de uso hiperrealista, estética minimalista..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 14,
                    minHeight: 80,
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>
            )}

            {mode === "specific" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Prompts Específicos (uno por imagen)
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Array(imagesPerReference).fill(0).map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      value={specificPrompts[i] || ""}
                      onChange={(e) => {
                        const newPrompts = [...specificPrompts];
                        newPrompts[i] = e.target.value;
                        setSpecificPrompts(newPrompts);
                      }}
                      placeholder={`Prompt ${i + 1}: Ej: fondo blanco, vista frontal...`}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        fontSize: 14,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Archivo CSV * (Formato Kasas Decoración)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                style={{ fontSize: 14 }}
              />
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                📋 Formato: REFERENCIA;ASIN;NOMBRE;URL 1;URL 2;URL 3;URL 4;URL 5
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                style={{
                  padding: "10px 20px",
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer",
                  opacity: creating ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateWorkflow}
                disabled={creating}
                style={{
                  padding: "10px 20px",
                  background: creating ? "#9ca3af" : "#ff6b6b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer",
                }}
              >
                {creating ? "Creando..." : "Crear Workflow"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingWorkflow && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 20,
          }}
          onClick={() => !updating && setShowEditModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 32,
              maxWidth: 800,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#ff6b6b" }}>
              ✏️ Editar Workflow
            </h2>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Nombre del Workflow *
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Ej: Catálogo Casas Decoración"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                ID del Proyecto *
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="UUID del proyecto en Supabase"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                💡 Proyecto donde se guardarán las imágenes generadas
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Imágenes por Referencia *
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={imagesPerReference}
                onChange={(e) => setImagesPerReference(parseInt(e.target.value) || 1)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>

            {/* 🆕 SELECTORES EN MODAL DE EDICIÓN */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#111827", fontSize: 14 }}>
                📐 Tamaño de imagen
              </label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <option value="1024x1024">1:1 (cuadrado) · 1024×1024px</option>
                <option value="2000x2000">2:2 (cuadrado) · 2000×2000px</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#111827", fontSize: 14 }}>
                📄 Formato de archivo
              </label>
              <select
                value={imageFormat}
                onChange={(e) => setImageFormat(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <option value="jpg">JPG (recomendado)</option>
                <option value="png">PNG (con transparencia)</option>
                <option value="webp">WEBP (más ligero)</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#111827", fontSize: 14 }}>
                🤖 Modelo de IA
              </label>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value as "standard" | "pro")}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <option value="standard">⚡ Standard (Rápido - Recomendado)</option>
                <option value="pro">💎 Pro (Máxima calidad)</option>
              </select>
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                {engine === "standard" 
                  ? "Generación rápida con buena calidad"
                  : "Mejor calidad pero más lento (2-3x tiempo)"
                }
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Modo de Prompts *
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setMode("global")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: mode === "global" ? "#ff6b6b" : "#f3f4f6",
                    color: mode === "global" ? "#fff" : "#374151",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Global
                </button>
                <button
                  onClick={() => setMode("specific")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: mode === "specific" ? "#ff6b6b" : "#f3f4f6",
                    color: mode === "specific" ? "#fff" : "#374151",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Específico
                </button>
              </div>
            </div>

            {mode === "global" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Parámetros Globales
                </label>
                <textarea
                  value={globalParams}
                  onChange={(e) => setGlobalParams(e.target.value)}
                  placeholder="Ej: ambiente de uso hiperrealista, estética minimalista..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 14,
                    minHeight: 80,
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>
            )}

            {mode === "specific" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Prompts Específicos (uno por imagen)
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Array(imagesPerReference).fill(0).map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      value={specificPrompts[i] || ""}
                      onChange={(e) => {
                        const newPrompts = [...specificPrompts];
                        newPrompts[i] = e.target.value;
                        setSpecificPrompts(newPrompts);
                      }}
                      placeholder={`Prompt ${i + 1}: Ej: fondo blanco, vista frontal...`}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        fontSize: 14,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Catálogo CSV
              </label>
              
              <div style={{
                padding: 12,
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>📊</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    CSV Actual: {editingWorkflow.totalItems} referencias
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                  El workflow usa actualmente un catálogo con {editingWorkflow.totalItems} productos
                </p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={replaceCsv}
                    onChange={(e) => {
                      setReplaceCsv(e.target.checked);
                      if (!e.target.checked) {
                        setCsvFile(null);
                      }
                    }}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    Reemplazar CSV por uno nuevo
                  </span>
                </label>
              </div>

              {replaceCsv && (
                <div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 14 }}
                  />
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    📋 Formato: REFERENCIA;ASIN;NOMBRE;URL 1;URL 2;URL 3;URL 4;URL 5
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingWorkflow(null);
                  setReplaceCsv(false);
                  setCsvFile(null);
                }}
                disabled={updating}
                style={{
                  padding: "10px 20px",
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: updating ? "not-allowed" : "pointer",
                  opacity: updating ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateWorkflow}
                disabled={updating}
                style={{
                  padding: "10px 20px",
                  background: updating ? "#9ca3af" : "#ff6b6b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: updating ? "not-allowed" : "pointer",
                }}
              >
                {updating ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}