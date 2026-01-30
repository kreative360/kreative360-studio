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
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Estado del formulario
  const [workflowName, setWorkflowName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [mode, setMode] = useState<"global" | "specific">("global");
  const [imagesPerReference, setImagesPerReference] = useState(5);
  const [globalParams, setGlobalParams] = useState("ambiente de uso hiperrealista, estética minimalista, respeta diseño 100%");
  const [specificPrompts, setSpecificPrompts] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, []);

  // Actualizar array de prompts específicos cuando cambia el número
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
        const text = e.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());
        
        // Primera línea = headers
        const headers = lines[0].split(",").map((h) => h.trim());
        
        // Resto = datos
        const items = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim());
          const item: any = {};
          
          headers.forEach((header, index) => {
            item[header] = values[index] || "";
          });
          
          return item;
        });
        
        resolve(items);
      };
      reader.onerror = reject;
      reader.readAsText(file);
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
      // 1. Parsear CSV
      const csvData = await parseCSV(csvFile);
      
      // 2. Transformar a formato requerido
      const items = csvData.map((row) => ({
        reference: row.reference || row.Reference || row.REFERENCE,
        asin: row.asin || row.ASIN,
        productName: row.name || row.productName || row.Name,
        imageUrls: [
          row.url1 || row.URL1,
          row.url2 || row.URL2,
          row.url3 || row.URL3,
        ].filter(Boolean),
      }));

      if (items.length === 0) {
        throw new Error("El CSV no contiene datos válidos");
      }

      // 3. Crear workflow
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
    } catch (error: any) {
      console.error("Error creating workflow:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const startWorkflow = async (workflowId: string) => {
    if (!confirm("¿Iniciar procesamiento de este workflow? Esto puede tardar varios minutos.")) {
      return;
    }

    try {
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
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: 24 }}>
      {/* Header */}
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

      {/* Lista de Workflows */}
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
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                      {workflow.name}
                    </h3>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6b7280" }}>
                      <span>📊 {workflow.totalItems} referencias</span>
                      <span>✅ {workflow.processedItems} procesadas</span>
                      {workflow.failedItems > 0 && (
                        <span style={{ color: "#ef4444" }}>❌ {workflow.failedItems} fallidas</span>
                      )}
                    </div>
                    
                    {/* Barra de progreso */}
                    {workflow.status === "processing" && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              background: "#ff6b6b",
                              width: `${workflow.progress}%`,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "block" }}>
                          {workflow.progress}% completado
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
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
                      {workflow.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear Workflow */}
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

            {/* Nombre */}
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

            {/* Project ID */}
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
            </div>

            {/* Número de imágenes */}
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

            {/* Modo */}
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

            {/* Parámetros Globales */}
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

            {/* Prompts Específicos */}
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

            {/* CSV File */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Archivo CSV *
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                style={{ fontSize: 14 }}
              />
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Formato: reference, name, asin, url1, url2, url3
              </p>
            </div>

            {/* Botones */}
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
    </div>
  );
}