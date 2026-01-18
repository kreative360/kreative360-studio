"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ImageEditor from "@/app/components/ImageEditor";

/* ======================================================
   TIPOS
====================================================== */
type ProjectImage = {
  id: string;
  reference?: string;
  asin?: string;
  index?: number;
  url?: string;
  base64?: string; // 🆕 AÑADIDO: Para almacenar versión editada
  validation_status?: "pending" | "approved" | "rejected";
  original_image_url?: string;
  prompt_used?: string;
};

const CHUNK_SIZE = 100;
const IMAGES_PER_ROW = 6;

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  /* ======================================================
     ESTADO GALERÍA (ORIGINAL)
  ====================================================== */
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [downloading, setDownloading] = useState(false);
  const [downloadPart, setDownloadPart] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);

  const [order, setOrder] = useState<"oldest" | "newest">("oldest");

  const [validationFilter, setValidationFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // 🆕 NUEVO: Estado del modal de revisión
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    currentImage: ProjectImage | null;
    imagesInReference: ProjectImage[];
    currentIndex: number;
  } | null>(null);

  // 🆕 Estado para regeneración
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // 🆕 Estado para prompt editable
  const [editablePrompt, setEditablePrompt] = useState<string>("");

  // 🆕 Estado para zoom/lupa
  const [zoomImage, setZoomImage] = useState<{ src: string; x: number; y: number; xPercent: number; yPercent: number } | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorImageUrl, setEditorImageUrl] = useState("");
  const [editorImageId, setEditorImageId] = useState("");

  /* ======================================================
     CARGA DE IMÁGENES (REAL)
  ====================================================== */
  const loadImages = async () => {
    try {
      const res = await fetch(
        `/api/projects/images?projectId=${projectId}`,
        { cache: "no-store" }
      );

      const data = await res.json();
      setImages(data.images || []);
      setSelected(new Set());
    } catch (err) {
      console.error("Error cargando imágenes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [projectId]);

  /* ======================================================
     🆕 NUEVO: FUNCIONES DE VALIDACIÓN
  ====================================================== */
  const updateValidationStatus = async (
    imageId: string,
    status: "approved" | "rejected" | "pending"
  ) => {
    try {
      const res = await fetch("/api/validations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, status }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert("Error actualizando estado de validación");
        return;
      }

      // Actualizar el estado local
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, validation_status: status } : img
        )
      );
    } catch (error) {
      console.error("Error updating validation:", error);
      alert("Error actualizando estado de validación");
    }
  };

  /* ======================================================
     🔧 CORREGIDO: MODAL DE REVISIÓN COMPARATIVA
  ====================================================== */
  const openReviewModal = (image: ProjectImage) => {
    const sameReference = images.filter(
      (img) => img.reference === image.reference
    );

    const sorted = sameReference.sort((a, b) => {
      const statusOrder = { pending: 0, approved: 1, rejected: 2 };
      const aOrder = statusOrder[a.validation_status || "pending"];
      const bOrder = statusOrder[b.validation_status || "pending"];
      return aOrder - bOrder;
    });

    const reordered = [
      image,
      ...sorted.filter((img) => img.id !== image.id),
    ];

    // 🆕 Inicializar el prompt editable con el prompt guardado o vacío
    setEditablePrompt(image.prompt_used || "");

    setReviewModal({
      open: true,
      currentImage: image,
      imagesInReference: reordered,
      currentIndex: 0,
    });
  };

  const handleReviewAction = async (status: "approved" | "rejected") => {
    if (!reviewModal || !reviewModal.currentImage) return;

    await updateValidationStatus(reviewModal.currentImage.id, status);

    const remaining = reviewModal.imagesInReference.filter(
      (img) => 
        img.id !== reviewModal.currentImage?.id && 
        img.validation_status === "pending"
    );

    if (remaining.length === 0) {
      setReviewModal(null);
      alert("✅ Revisión de imágenes pendientes completada");
      return;
    }

    setReviewModal({
      ...reviewModal,
      currentImage: remaining[0],
      imagesInReference: reviewModal.imagesInReference.filter(
        (img) => img.id !== reviewModal.currentImage?.id
      ),
      currentIndex: 0,
    });
  };

  /* ======================================================
     🆕 FUNCIÓN DE REGENERACIÓN IN-SITU
  ====================================================== */
  const handleRegenerate = async () => {
    if (!reviewModal || !reviewModal.currentImage) return;

    const currentImg = reviewModal.currentImage;
    const promptToUse = editablePrompt.trim();
    
    if (!promptToUse) {
      alert("Escribe un prompt para regenerar la imagen");
      return;
    }

    if (!currentImg.original_image_url) {
      alert("No hay imagen original disponible para regenerar");
      return;
    }

    setIsRegenerating(true);

    try {
      // 🔧 PASO 1: Obtener dimensiones de la imagen original
      let width = 1024;
      let height = 1024;
      
      if (currentImg.url) {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            width = img.naturalWidth;
            height = img.naturalHeight;
            resolve();
          };
          img.onerror = reject;
          img.src = currentImg.url;
        });
      }

      // 🔧 PASO 2: Generar nueva imagen con las MISMAS dimensiones
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refs: [currentImg.original_image_url],
          count: 1,
          overridePrompt: promptToUse,
          width,
          height,
          format: "jpg",
          engine: "v2",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.images || data.images.length === 0) {
        throw new Error("Error generando imagen");
      }

      // 🔧 PASO 3: Actualizar la imagen existente (REEMPLAZAR)
      const newImage = data.images[0];
      const newBase64 = newImage.base64;
      const newDataUrl = `data:${newImage.mime};base64,${newBase64}`;

      const updateRes = await fetch("/api/projects/images/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: currentImg.id,
          newImageBase64: newBase64,
          prompt: promptToUse,
        }),
      });

      const updateData = await updateRes.json();

      if (!updateRes.ok || !updateData.success) {
        throw new Error("Error actualizando imagen");
      }

      // 🔧 PASO 4: Actualizar el estado local
      const updatedImage = {
        ...currentImg,
        url: updateData.url,
        base64: newBase64, // 🆕 Guardar base64
        prompt_used: promptToUse,
      };

      setImages((prev) =>
        prev.map((img) => (img.id === currentImg.id ? updatedImage : img))
      );

      setReviewModal((prev) =>
        prev
          ? {
              ...prev,
              currentImage: updatedImage,
              imagesInReference: prev.imagesInReference.map((img) =>
                img.id === currentImg.id ? updatedImage : img
              ),
            }
          : null
      );

      alert("✅ Imagen regenerada correctamente");
    } catch (error: any) {
      console.error("Error regenerando:", error);
      alert("❌ Error: " + error.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  /* ======================================================
     🆕 FUNCIÓN PARA GUARDAR EDICIÓN
  ====================================================== */
  const handleSaveEdit = async (editedImageBase64: string) => {
    if (!editorImageId) return;

    try {
      const res = await fetch("/api/projects/images/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: editorImageId,
          newImageBase64: editedImageBase64,
          prompt: "Editado con IA",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error("Error guardando imagen editada");
      }

      // 🔧 Actualizar el estado local CON base64
      setImages((prev) =>
        prev.map((img) =>
          img.id === editorImageId
            ? { ...img, url: data.url, base64: editedImageBase64 }
            : img
        )
      );

      // Si el modal de revisión está abierto, actualizarlo también
      if (reviewModal && reviewModal.currentImage?.id === editorImageId) {
        setReviewModal({
          ...reviewModal,
          currentImage: {
            ...reviewModal.currentImage,
            url: data.url,
            base64: editedImageBase64, // 🔧 AÑADIDO
          },
          imagesInReference: reviewModal.imagesInReference.map((img) =>
            img.id === editorImageId ? { ...img, url: data.url, base64: editedImageBase64 } : img
          ),
        });
      }

      setShowEditor(false);
      alert("✅ Imagen editada correctamente");
    } catch (error: any) {
      console.error("Error guardando edición:", error);
      alert("❌ Error: " + error.message);
    }
  };

  /* ======================================================
     SELECCIÓN Y DESCARGA
  ====================================================== */
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(images.map((i) => i.id)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const downloadSelected = async () => {
    const selectedImages = images.filter((img) => selected.has(img.id));
    if (selectedImages.length === 0) {
      alert("Selecciona al menos una imagen");
      return;
    }

    setDownloading(true);
    setDownloadPart(0);
    setDownloadTotal(selectedImages.length);

    try {
      const chunks: ProjectImage[][] = [];
      for (let i = 0; i < selectedImages.length; i += CHUNK_SIZE) {
        chunks.push(selectedImages.slice(i, i + CHUNK_SIZE));
      }

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        const res = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: chunk, projectId }),
        });

        if (!res.ok) {
          throw new Error("Error generando ZIP");
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `images_part${chunkIdx + 1}_of_${chunks.length}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        setDownloadPart(chunkIdx + 1);
      }

      alert("✅ Descarga completada");
    } catch (err) {
      console.error("Error descargando:", err);
      alert("❌ Error al descargar imágenes");
    } finally {
      setDownloading(false);
      setDownloadPart(0);
      setDownloadTotal(0);
    }
  };

  /* ======================================================
     FILTROS Y ORDEN
  ====================================================== */
  const sortedImages = [...images].sort((a, b) => {
    if (order === "newest") {
      return (b.index || 0) - (a.index || 0);
    }
    return (a.index || 0) - (b.index || 0);
  });

  const filteredImages = sortedImages.filter((img) => {
    if (validationFilter === "all") return true;
    return img.validation_status === validationFilter;
  });

  const groupedImages: { [key: string]: ProjectImage[] } = {};
  filteredImages.forEach((img) => {
    const ref = img.reference || "Sin referencia";
    if (!groupedImages[ref]) {
      groupedImages[ref] = [];
    }
    groupedImages[ref].push(img);
  });

  /* ======================================================
     🆕 FUNCIÓN PARA MANEJAR ZOOM/LUPA
  ====================================================== */
  const handleMouseMove = (
    e: React.MouseEvent<HTMLImageElement>,
    imageSrc: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    setZoomImage({
      src: imageSrc,
      x: e.clientX,
      y: e.clientY,
      xPercent,
      yPercent,
    });
  };

  const handleMouseLeave = () => {
    setZoomImage(null);
  };

  /* ======================================================
     RENDER
  ====================================================== */
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "#fff",
        }}
      >
        Cargando proyecto...
      </div>
    );
  }

  return (
    <div style={{ padding: 32, color: "#fff" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 24,
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>Proyecto {projectId}</h1>
        <button
          onClick={() => router.push("/projects")}
          style={{
            background: "#ff6b6b",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Volver
        </button>
      </div>

      {/* CONTROLES */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={selectAll}
          style={{
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Seleccionar todas
        </button>
        <button
          onClick={deselectAll}
          style={{
            background: "#6b7280",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Deseleccionar todas
        </button>
        <button
          onClick={downloadSelected}
          disabled={downloading || selected.size === 0}
          style={{
            background: downloading || selected.size === 0 ? "#4b5563" : "#10b981",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 14,
            cursor: downloading || selected.size === 0 ? "not-allowed" : "pointer",
            opacity: downloading || selected.size === 0 ? 0.5 : 1,
          }}
        >
          {downloading
            ? `Descargando ${downloadPart}/${downloadTotal}...`
            : `Descargar (${selected.size})`}
        </button>

        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as "oldest" | "newest")}
          style={{
            background: "#374151",
            color: "#fff",
            border: "1px solid #4b5563",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <option value="oldest">Más antiguas primero</option>
          <option value="newest">Más recientes primero</option>
        </select>

        <select
          value={validationFilter}
          onChange={(e) => setValidationFilter(e.target.value as any)}
          style={{
            background: "#374151",
            color: "#fff",
            border: "1px solid #4b5563",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <option value="all">Todas</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
        </select>
      </div>

      {/* GALERÍA */}
      {Object.entries(groupedImages).map(([ref, imgs]) => (
        <div key={ref} style={{ marginBottom: 40 }}>
          <h3
            style={{
              fontSize: 16,
              marginBottom: 12,
              color: "#9ca3af",
              fontWeight: 500,
            }}
          >
            {ref} ({imgs.length} imagen{imgs.length !== 1 ? "es" : ""})
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${IMAGES_PER_ROW}, 1fr)`,
              gap: 12,
            }}
          >
            {imgs.map((img) => (
              <div
                key={img.id}
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#1f2937",
                  cursor: "pointer",
                }}
                onClick={() => openReviewModal(img)}
              >
                {img.url && (
                  <img
                    src={img.url}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    alt="Generated"
                  />
                )}

                <input
                  type="checkbox"
                  checked={selected.has(img.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelect(img.id);
                  }}
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    width: 20,
                    height: 20,
                    cursor: "pointer",
                    accentColor: "#ff6b6b",
                  }}
                />

                {img.validation_status !== "pending" && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background:
                        img.validation_status === "approved" ? "#10b981" : "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      color: "#fff",
                      fontWeight: "bold",
                    }}
                  >
                    {img.validation_status === "approved" ? "✓" : "✕"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* PREVIEW SIMPLE */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            cursor: "pointer",
          }}
        >
          <img
            src={preview}
            style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 12 }}
            alt="Preview"
          />
        </div>
      )}

      {/* 🆕 MODAL DE REVISIÓN COMPARATIVA */}
      {reviewModal && reviewModal.currentImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 32px",
              borderBottom: "1px solid rgba(255,255,255,0.2)",
              flexShrink: 0,
            }}
          >
            <h2 style={{ color: "#fff", margin: 0, fontSize: 20 }}>
              Revisando: {reviewModal.currentImage.reference || "Sin referencia"}
            </h2>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ color: "#9ca3af", fontSize: 14 }}>
                Imagen {reviewModal.currentIndex + 1} de{" "}
                {reviewModal.imagesInReference.length}
              </span>
              <button
                onClick={() => setReviewModal(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontSize: 28,
                  cursor: "pointer",
                  padding: "0 8px",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* CONTENIDO PRINCIPAL */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px",
              overflow: "hidden",
            }}
          >
            {/* COLUMNAS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 32,
                width: "100%",
                maxWidth: 1600,
                height: "100%",
              }}
            >
              {/* COLUMNA IZQUIERDA - IMAGEN ORIGINAL */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <h3
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    marginBottom: 12,
                    fontWeight: 500,
                  }}
                >
                  Imagen Original
                </h3>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#1f2937",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {reviewModal.currentImage.original_image_url && (
                    <img
                      src={reviewModal.currentImage.original_image_url}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                        borderRadius: 12,
                        display: "block",
                      }}
                      alt="Original"
                    />
                  )}
                </div>
              </div>

              {/* COLUMNA DERECHA - IMAGEN GENERADA */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <h3
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    marginBottom: 12,
                    fontWeight: 500,
                  }}
                >
                  Imagen Generada
                </h3>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#1f2937",
                    borderRadius: 12,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {reviewModal.currentImage.url && (
                    <img
                      src={reviewModal.currentImage.url}
                      onMouseMove={(e) =>
                        handleMouseMove(e, reviewModal.currentImage.url || "")
                      }
                      onMouseLeave={handleMouseLeave}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                        borderRadius: 12,
                        cursor: "crosshair",
                        display: "block",
                      }}
                      alt="Generada"
                    />
                  )}
                  {zoomImage && zoomImage.src === reviewModal.currentImage.url && (
                    <div
                      style={{
                        position: "fixed",
                        left: zoomImage.x + 20,
                        top: zoomImage.y + 20,
                        width: 200,
                        height: 200,
                        border: "3px solid #fff",
                        borderRadius: 8,
                        overflow: "hidden",
                        pointerEvents: "none",
                        background: "#000",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.8)",
                        zIndex: 10000,
                        backgroundImage: `url(${zoomImage.src})`,
                        backgroundSize: "400%",
                        backgroundPosition: `${zoomImage.xPercent}% ${zoomImage.yPercent}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BOTONES */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              padding: "16px 0",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => handleReviewAction("approved")}
              style={{
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 28px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✓ Aprobar
            </button>
            <button
              onClick={() => handleReviewAction("rejected")}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 28px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕ Rechazar
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating || !editablePrompt.trim()}
              style={{
                background: isRegenerating ? "#666" : "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 28px",
                fontSize: 15,
                fontWeight: 600,
                cursor: isRegenerating || !editablePrompt.trim() ? "not-allowed" : "pointer",
                opacity: isRegenerating || !editablePrompt.trim() ? 0.5 : 1,
              }}
            >
              {isRegenerating ? "⏳ Regenerando..." : "🔄 Regenerar"}
            </button>
            <button
              onClick={() => {
                if (reviewModal?.currentImage) {
                  setEditorImageUrl(reviewModal.currentImage.url || "");
                  setEditorImageId(reviewModal.currentImage.id);
                  setShowEditor(true);
                }
              }}
              style={{
                background: "#8b5cf6",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 28px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✏️ Editar
            </button>
          </div>

          {/* MINIATURAS (IZQUIERDA) + PROMPT (DERECHA) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 550px",
              gap: 20,
              padding: "20px 20px 32px",
              borderTop: "2px solid rgba(255,255,255,0.2)",
              flexShrink: 0,
              minHeight: "180px",
            }}
          >
            {/* MINIATURAS */}
            <div
              style={{
                display: "flex",
                gap: 10,
                overflowX: "auto",
                paddingBottom: 8,
              }}
            >
              {reviewModal.imagesInReference.map((img, idx) => (
                <div
                  key={img.id}
                  onClick={() =>
                    setReviewModal({
                      ...reviewModal,
                      currentImage: img,
                      currentIndex: idx,
                    })
                  }
                  style={{
                    minWidth: 80,
                    height: 80,
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                    position: "relative",
                    border:
                      img.id === reviewModal.currentImage?.id
                        ? "3px solid #ff6b6b"
                        : "3px solid transparent",
                    opacity: img.id === reviewModal.currentImage?.id ? 1 : 0.6,
                  }}
                >
                  {img.url && (
                    <img
                      src={img.url}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      alt={`Miniatura ${idx + 1}`}
                    />
                  )}
                  {img.validation_status !== "pending" && (
                    <div
                      style={{
                        position: "absolute",
                        top: 3,
                        right: 3,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background:
                          img.validation_status === "approved" ? "#10b981" : "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: "#fff",
                      }}
                    >
                      {img.validation_status === "approved" ? "✓" : "✕"}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* PROMPT EDITABLE (DERECHA) */}
            <div style={{ display: "flex", flexDirection: "column", height: "140px" }}>
              <p
                style={{
                  color: "#fff",
                  fontSize: 11,
                  opacity: 0.7,
                  marginBottom: 4,
                }}
              >
                Prompt {editablePrompt ? "(editable)" : "(escribe para regenerar)"}:
              </p>
              <textarea
                value={editablePrompt}
                onChange={(e) => setEditablePrompt(e.target.value)}
                placeholder="Escribe el prompt aquí para regenerar..."
                style={{
                  flex: 1,
                  color: "#fff",
                  fontSize: 13,
                  background: "rgba(255,255,255,0.1)",
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.3)",
                  fontFamily: "inherit",
                  resize: "vertical",
                  lineHeight: "1.4",
                  minHeight: "110px",
                  maxHeight: "110px",
                  overflowY: "auto",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 🔧 EDITOR DE IMÁGENES - CORREGIDO */}
      {showEditor && (
        <ImageEditor
          imageUrl={
            images.find(img => img.id === editorImageId)?.base64
              ? `data:image/jpeg;base64,${images.find(img => img.id === editorImageId)?.base64}`
              : editorImageUrl
          }
          onSave={handleSaveEdit}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}