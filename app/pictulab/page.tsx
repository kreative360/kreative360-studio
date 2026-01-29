"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import PromptSelector from "@/app/components/PromptSelector";

const LS_SELECTED_PROJECT = "selectedProject:v1";

export default function PictuLabPage() {
  const [selectedSize, setSelectedSize] = useState("1:1 (cuadrado)");
  const [modeList, setModeList] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  const [selectedFormat, setSelectedFormat] = useState("jpg");

  // ⭐ Motor IA REAL (v2 - Standard, v3 - PRO)
  const [engine, setEngine] = useState<"v2" | "v3">("v2");

  const [generated, setGenerated] = useState<{
    base64: string;
    mime: string;
    width: number;
    height: number;
  } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);

  // 🆕 ESTADO PARA PROYECTOS
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // 🆕 CAMPOS ZIP (Referencia se llena automáticamente con nombre de archivo)
  const [zipNameRef, setZipNameRef] = useState<string>("");
  const [zipNameAsin, setZipNameAsin] = useState<string>("");
  const [zipInputKey, setZipInputKey] = useState(0);

  // 🆕 Guardar el nombre original del primer archivo subido
  const [firstFileName, setFirstFileName] = useState<string>("");

  // 🎯 ESTADO PARA GALERÍA DE PROMPTS
  const [showPromptGallery, setShowPromptGallery] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sizes = [
    { label: "1:1 (cuadrado)", size: "1024×1024", ratio: 1, w: 1024, h: 1024 },
    { label: "2:2 (cuadrado)", size: "2000×2000", ratio: 1, w: 2000, h: 2000 },
    { label: "2:3 (vertical)", size: "832×1248", ratio: 0.66, w: 832, h: 1248 },
    { label: "3:4 (vertical)", size: "864×1184", ratio: 0.73, w: 864, h: 1184 },
    { label: "4:5 (vertical)", size: "896×1152", ratio: 0.78, w: 896, h: 1152 },
    { label: "9:16 (vertical)", size: "768×1344", ratio: 0.56, w: 768, h: 1344 },
    { label: "21:9 (vertical)", size: "672×1536", ratio: 0.43, w: 672, h: 1536 },
    { label: "3:2 (horizontal)", size: "1248×832", ratio: 1.5, w: 1248, h: 832 },
    { label: "4:3 (horizontal)", size: "1184×864", ratio: 1.37, w: 1184, h: 864 },
    { label: "5:4 (horizontal)", size: "1152×896", ratio: 1.28, w: 1152, h: 896 },
    { label: "16:9 (horizontal)", size: "1344×768", ratio: 1.77, w: 1344, h: 768 },
    { label: "21:9 (horizontal)", size: "1536×672", ratio: 2.28, w: 1536, h: 672 },
    { label: "A5 vertical", size: "1748×2480", ratio: 0.7, w: 1748, h: 2480 },
    { label: "A5 horizontal", size: "2480×1748", ratio: 1.42, w: 2480, h: 1748 },
    { label: "A4 vertical", size: "2480×3508", ratio: 0.7, w: 2480, h: 3508 },
    { label: "A4 horizontal", size: "3508×2480", ratio: 1.41, w: 3508, h: 2480 },
    { label: "A3 vertical", size: "3508×4961", ratio: 0.7, w: 3508, h: 4961 },
    { label: "A3 horizontal", size: "4961×3508", ratio: 1.41, w: 4961, h: 3508 },
  ];

  const selectedObj = sizes.find((s) => s.label === selectedSize);
  const selectedRatio = selectedObj?.ratio ?? 1;

  const [previewDims, setPreviewDims] = useState({ w: 0, h: 0 });

  // 🆕 CARGAR PROYECTOS AL MONTAR
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoadingProjects(true);
        const res = await fetch("/api/projects/list");
        if (!res.ok) throw new Error("Error cargando proyectos");
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error("Error cargando proyectos:", error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  // 🆕 CARGAR PROYECTO SELECCIONADO DE LOCALSTORAGE
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_SELECTED_PROJECT);
      if (saved) {
        setSelectedProjectId(saved);
      }
    } catch (e) {
      console.warn("No se pudo cargar proyecto seleccionado de localStorage", e);
    }
  }, []);

  // 🆕 GUARDAR PROYECTO SELECCIONADO EN LOCALSTORAGE
  useEffect(() => {
    if (selectedProjectId) {
      try {
        localStorage.setItem(LS_SELECTED_PROJECT, selectedProjectId);
      } catch (e) {
        console.warn("No se pudo guardar proyecto seleccionado en localStorage", e);
      }
    }
  }, [selectedProjectId]);

  useEffect(() => {
    function update() {
      if (!containerRef.current) return;

      const maxW = containerRef.current.clientWidth * 0.7;
      const maxH = containerRef.current.clientHeight * 0.82;

      let w = maxW;
      let h = w / selectedRatio;

      if (h > maxH) {
        h = maxH;
        w = h * selectedRatio;
      }

      setPreviewDims({ w, h });
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [selectedRatio, zoom]);

  const handleFiles = (e: any) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const existing = [...uploadedImages];

    files.forEach((file: any, index: number) => {
      if (existing.length < 5) {
        const reader = new FileReader();
        reader.onload = () => {
          existing.push(reader.result as string);
          setUploadedImages([...existing]);

          // 🆕 GUARDAR NOMBRE DEL PRIMER ARCHIVO (sin extensión)
          if (index === 0 && !firstFileName) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            setFirstFileName(nameWithoutExt);
            
            // 🆕 LLENAR AUTOMÁTICAMENTE EL CAMPO DE REFERENCIA
            if (!zipNameRef) {
              setZipNameRef(nameWithoutExt);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (i: number) => {
    const arr = [...uploadedImages];
    arr.splice(i, 1);
    setUploadedImages(arr);
  };

  // 🎯 MANEJAR SELECCIÓN DE PROMPT DESDE LA GALERÍA
  const handlePromptSelect = (data: { title: string; content: string }) => {
    if (textareaRef.current) {
      textareaRef.current.value = data.content;
      setCurrentPrompt(data.content);
    }
    setShowPromptGallery(false);
  };

  // ========= GENERACIÓN ==========
  async function generateImage() {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerated(null);

    const prompt = textareaRef.current?.value || "";

    const payload = {
      prompt,
      refs: uploadedImages,
      width: selectedObj?.w,
      height: selectedObj?.h,
      format: selectedFormat.toLowerCase(),
      engine, // ⭐ AHORA SÍ ENVÍA v2/v3 al backend
    };

    try {
      const res = await fetch("/pictulab/api/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.ok) {
        alert("Error: " + json.error);
        setIsGenerating(false);
        return;
      }

      const img = json.image;
      setGenerated(img);
    } catch (e: any) {
      alert("Error inesperado al generar la imagen.");
    }

    setIsGenerating(false);
  }

  // ========= EXPORTAR ==========
  function exportImage() {
    if (!generated) return;

    const ext = selectedFormat.toLowerCase();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "");

    const filename = `pictulab_${timestamp}.${ext}`;

    const link = document.createElement("a");
    link.href = `data:${generated.mime};base64,${generated.base64}`;
    link.download = filename;
    link.click();
  }

  // 🆕 ENVIAR A PROYECTO
  const handleSendToProject = async () => {
    if (!selectedProjectId) {
      alert("Selecciona un proyecto antes de enviar la imagen.");
      return;
    }

    if (!generated) {
      alert("Primero genera una imagen antes de enviarla al proyecto.");
      return;
    }

    const reference = zipNameRef.trim();
    const asin = zipNameAsin.trim() || null;

    if (!reference) {
      alert("Debes especificar una referencia en el campo correspondiente.");
      return;
    }

    const mime = generated.mime || "image/jpeg";
    const ext =
      mime.includes("png") ? "png" :
      mime.includes("webp") ? "webp" :
      mime.includes("gif") ? "gif" :
      "jpg";

    const images = [
      {
        base64: generated.base64,
        mime,
        filename: `${reference}_0.${ext}`,
        reference,
        asin,
        image_index: 0
      }
    ];

    // Capturar URL original (primera imagen de referencia si existe)
    const originalImageUrl = uploadedImages.length > 0 ? uploadedImages[0] : null;

    // Capturar prompt usado
    const promptUsed = textareaRef.current?.value || null;

    setIsSending(true);

    try {
      const res = await fetch("/api/projects/add-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          images,
          originalImageUrl,
          promptUsed,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error("Error enviando imagen:", data);
        alert(`Error enviando la imagen al proyecto: ${data.error || 'Error desconocido'}`);
        return;
      }

      alert(`✅ Imagen enviada correctamente al proyecto`);
    } catch (error) {
      console.error("Error completo:", error);
      alert(`❌ Error enviando la imagen al proyecto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* TOP BAR */}
      <div className="topbar">
        <div className="zoom-controls">
          <button className="btn-zoom" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}>-</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button className="btn-zoom" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>+</button>
          <button className="btn-zoom" onClick={() => setZoom(1)}>Reset</button>
        </div>

        <button className="btn-zoom">Importar</button>

        <button
          className="btn-zoom"
          style={{ background: "#FF6D6D", color: "#fff" }}
          onClick={exportImage}
          disabled={!generated}
        >
          Exportar
        </button>
      </div>

      <main className="flex min-h-screen">
        <aside className="sidebar">

          {/* PROMPT */}
          <div className="sidebar-box">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Prompt</h2>
              <button
                onClick={() => {
                  setCurrentPrompt(textareaRef.current?.value || "");
                  setShowPromptGallery(true);
                }}
                style={{
                  background: "#ff6b6b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                title="Abrir galería de prompts"
              >
                📋 Galería
              </button>
            </div>
            <textarea 
              ref={textareaRef}
              placeholder="Describe brevemente la imagen que quieres generar..."
            ></textarea>
          </div>

          {/* REFERENCIAS */}
          <div className="sidebar-box">
            <h2>Imágenes de referencia ({uploadedImages.length}/5)</h2>

            <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
              <span>Sube o arrastra imágenes</span>
            </div>

            <input ref={fileInputRef} type="file" multiple className="hidden-input" onChange={handleFiles} />

            <div className="image-grid mt-2 grid grid-cols-2 gap-2">
              {uploadedImages.map((img, i) => (
                <div
                  key={i}
                  className="relative cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewerImage(img);
                    setIsViewerOpen(true);
                    setIsZoomed(false);
                  }}
                >
                  <Image src={img} width={300} height={300} alt="ref" className="rounded-md object-cover h-20 w-full" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(i);
                    }}
                    className="absolute top-1 right-1 bg-black/70 text-white w-5 h-5 rounded text-xs"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* RELACIÓN DE ASPECTO */}
          <div className="sidebar-box">
            <h2>Relación de aspecto</h2>

            <div className="toggle-wrap">
              <span>Modo lista</span>
              <div className="toggle" onClick={() => setModeList(!modeList)}>
                <div className={`toggle-thumb ${modeList ? "active" : ""}`}></div>
              </div>
            </div>

            {modeList ? (
              <div className="aspect-list">
                {sizes.map((s) => (
                  <div
                    key={s.label}
                    className={`aspect-item ${selectedSize === s.label ? "active" : ""}`}
                    onClick={() => setSelectedSize(s.label)}
                  >
                    <div
                      className="mini-rect"
                      style={{
                        width: s.ratio >= 1 ? "36px" : `${36 * s.ratio}px`,
                        height: s.ratio <= 1 ? "36px" : `${36 / s.ratio}px`,
                      }}
                    ></div>

                    <p className="ratio">{s.label}</p>
                    <p className="px">{s.size} px</p>
                  </div>
                ))}
              </div>
            ) : (
              <select className="aspect-select" value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)}>
                {sizes.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label} — {s.size} px
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* FORMATO */}
          <div className="sidebar-box">
            <h2>Selecciona el formato</h2>
            <div className="format-buttons">
              {["JPG", "PNG", "WEBP", "BMP"].map((f) => (
                <button
                  key={f}
                  className={`format-btn ${selectedFormat === f.toLowerCase() ? "active-format" : ""}`}
                  onClick={() => setSelectedFormat(f.toLowerCase())}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* ⭐ MOTOR IA (ESTO YA FUNCIONA 100%) */}
          <div className="sidebar-box">
            <h2>Motor IA</h2>
            <div className="format-buttons">

              <button
                className={`format-btn engine-btn ${engine === "v2" ? "active" : ""}`}
                onClick={() => setEngine("v2")}
              >
                Standard
              </button>

              <button
                className={`format-btn engine-btn ${engine === "v3" ? "active" : ""}`}
                onClick={() => setEngine("v3")}
              >
                Pro
              </button>

            </div>
          </div>

          {/* 🆕 SELECTOR DE PROYECTO + CAMPOS ZIP */}
          <div className="sidebar-box">
            <h2>Enviar a proyecto</h2>
            
            {/* Selector de proyecto */}
            <div style={{ position: "relative", marginBottom: 10 }}>
              <select
                value={selectedProjectId || ""}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                disabled={isLoadingProjects}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "8px 30px 8px 12px",
                  width: "100%",
                  background: "#fff",
                  color: selectedProjectId ? "#111" : "#9ca3af",
                  fontWeight: 600,
                  cursor: "pointer",
                  appearance: "none",
                  fontSize: 14,
                }}
                title={
                  selectedProjectId 
                    ? `Proyecto seleccionado: ${projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId}`
                    : "Selecciona un proyecto para enviar imágenes"
                }
              >
                <option value="">{isLoadingProjects ? "Cargando..." : "Seleccionar proyecto"}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <div
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "#6b7280",
                }}
              >
                ▼
              </div>
            </div>

            {/* Campo Referencia */}
            <div style={{ position: "relative", marginBottom: 10 }}>
              <input
                key={`ref-${zipInputKey}`}
                value={zipNameRef}
                onChange={(e) => setZipNameRef(e.target.value)}
                placeholder="Nombre ZIP (Referencia)"
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "8px 36px 8px 12px",
                  width: "100%",
                  fontSize: 14,
                }}
              />
              {zipNameRef.trim() !== "" && (
                <button
                  onClick={() => { setZipNameRef(""); setZipInputKey((k) => k + 1); }}
                  title="Borrar nombre"
                  aria-label="Borrar nombre"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    color: "#111",
                    cursor: "pointer",
                    lineHeight: "20px",
                    fontWeight: 800,
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Campo ASIN */}
            <div style={{ position: "relative", marginBottom: 10 }}>
              <input
                key={`asin-${zipInputKey}`}
                value={zipNameAsin}
                onChange={(e) => setZipNameAsin(e.target.value)}
                placeholder="Nombre ZIP (ASIN)"
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "8px 36px 8px 12px",
                  width: "100%",
                  fontSize: 14,
                }}
              />
              {zipNameAsin.trim() !== "" && (
                <button
                  onClick={() => { setZipNameAsin(""); setZipInputKey((k) => k + 1); }}
                  title="Borrar nombre"
                  aria-label="Borrar nombre"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    color: "#111",
                    cursor: "pointer",
                    lineHeight: "20px",
                    fontWeight: 800,
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Botón Enviar */}
            <button
              onClick={handleSendToProject}
              disabled={isSending || !selectedProjectId || !generated}
              style={{
                borderRadius: 8,
                padding: "10px 12px",
                width: "100%",
                background: (selectedProjectId && generated) ? "#10b981" : "#e5e7eb",
                color: (selectedProjectId && generated) ? "#ffffff" : "#9ca3af",
                fontWeight: 700,
                cursor: (isSending || !selectedProjectId || !generated) ? "not-allowed" : "pointer",
                border: "1px solid rgba(0,0,0,.1)",
                opacity: isSending ? 0.7 : 1,
                fontSize: 14,
              }}
              title={
                !selectedProjectId 
                  ? "Selecciona un proyecto primero" 
                  : !generated
                    ? "Genera una imagen primero"
                    : isSending 
                      ? "Enviando imagen..." 
                      : `Enviar imagen al proyecto`
              }
            >
              {isSending ? "Enviando..." : "Enviar a proyecto"}
            </button>
          </div>

          {/* GENERAR */}
          <button className="generate-btn" onClick={generateImage} disabled={isGenerating}>
            {isGenerating ? (
              <div className="spinner"></div>
            ) : (
              "Generar imagen"
            )}
          </button>

          <p className="text-xs text-white text-center mt-auto">
            © 2025 Kreative 360º — Panel PicTULAB
          </p>
        </aside>

        {/* PREVIEW */}
        <section className="preview-zone" ref={containerRef}>
          <div
            className="preview-inner"
            style={{
              width: previewDims.w * zoom,
              height: previewDims.h * zoom,
              position: "relative",
              overflow: "hidden",
              background: "#fff2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {generated ? (
              <img
                src={`data:${generated.mime};base64,${generated.base64}`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <span style={{ color: "#fff9" }}>
                Vista previa ({selectedObj?.size})
              </span>
            )}
          </div>
        </section>
      </main>

      {/* VISOR COMPLETO */}
      {isViewerOpen && viewerImage && (
        <div
          className="viewer-overlay"
          onClick={() => {
            if (isZoomed) setIsZoomed(false);
            else setIsViewerOpen(false);
          }}
        >
          <img
            src={viewerImage}
            className={`viewer-image ${isZoomed ? "zoomed" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed((z) => !z);
            }}
          />
        </div>
      )}

      {/* MODAL GALERÍA DE PROMPTS */}
      {showPromptGallery && (
        <PromptSelector
          onSelect={handlePromptSelect}
          onClose={() => setShowPromptGallery(false)}
          currentPrompt={currentPrompt}
        />
      )}
    </>
  );
}