"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/* ======================================================
   TIPOS
====================================================== */
type ProjectImage = {
  id: string;
  reference?: string;
  asin?: string;
  index?: number;
  url?: string;
  validation_status?: "pending" | "approved" | "rejected";
  original_image_url?: string;
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

  // 🔧 CORREGIDO: Por defecto mostrar solo pendientes
  const [validationFilter, setValidationFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // 🆕 NUEVO: Estado del modal de revisión
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    currentImage: ProjectImage | null;
    imagesInReference: ProjectImage[];
    currentIndex: number;
  } | null>(null);

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
    // 🔧 CORREGIDO: Filtrar TODAS las imágenes de la misma referencia (sin importar estado)
    const sameReference = images.filter(
      (img) => img.reference === image.reference
    );

    // Ordenar: pendientes primero, luego aprobadas, luego rechazadas
    const sorted = sameReference.sort((a, b) => {
      const statusOrder = { pending: 0, approved: 1, rejected: 2 };
      const aOrder = statusOrder[a.validation_status || "pending"];
      const bOrder = statusOrder[b.validation_status || "pending"];
      return aOrder - bOrder;
    });

    // Asegurar que la imagen clickeada sea la primera
    const reordered = [
      image,
      ...sorted.filter((img) => img.id !== image.id),
    ];

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

    // Buscar la siguiente imagen PENDIENTE de la misma referencia
    const remaining = reviewModal.imagesInReference.filter(
      (img) => 
        img.id !== reviewModal.currentImage?.id && 
        img.validation_status === "pending"
    );

    if (remaining.length === 0) {
      // No quedan más imágenes pendientes de esta referencia
      setReviewModal(null);
      alert("✅ Revisión de imágenes pendientes completada");
      return;
    }

    // Cargar la siguiente imagen pendiente
    setReviewModal({
      ...reviewModal,
      currentImage: remaining[0],
      imagesInReference: reviewModal.imagesInReference.filter(
        (img) => img.id !== reviewModal.currentImage?.id
      ),
      currentIndex: 0,
    });
  };

  // 🆕 Listener de ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && reviewModal?.open) {
        setReviewModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reviewModal]);

  /* ======================================================
     FILTRADO POR VALIDACIÓN
  ====================================================== */
  const filteredImages = images.filter((img) => {
    if (validationFilter === "all") return true;
    return img.validation_status === validationFilter;
  });

  const displayedImages =
    order === "oldest" ? filteredImages : [...filteredImages].reverse();

  /* ======================================================
     SELECCIÓN (ORIGINAL)
  ====================================================== */
  const selectAll = () =>
    setSelected(new Set(displayedImages.map((img) => img.id)));

  const deselectAll = () => setSelected(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleRowSelect = (rowIndex: number) => {
    const start = rowIndex * IMAGES_PER_ROW;
    const rowImages = displayedImages.slice(start, start + IMAGES_PER_ROW);

    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = rowImages.every((img) => next.has(img.id));
      rowImages.forEach((img) =>
        allSelected ? next.delete(img.id) : next.add(img.id)
      );
      return next;
    });
  };

  const toggleTwoRowsSelect = (rowIndex: number) => {
    const start = rowIndex * IMAGES_PER_ROW;
    const twoRowsImages = displayedImages.slice(
      start,
      start + IMAGES_PER_ROW * 2
    );

    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = twoRowsImages.every((img) => next.has(img.id));
      twoRowsImages.forEach((img) =>
        allSelected ? next.delete(img.id) : next.add(img.id)
      );
      return next;
    });
  };

  /* ======================================================
     DESCARGA ZIP (ORIGINAL)
  ====================================================== */
  const downloadZip = async (mode: "reference" | "asin") => {
    if (selected.size === 0) {
      alert("Selecciona al menos una imagen");
      return;
    }

    const ids = Array.from(selected);
    const totalParts = Math.ceil(ids.length / CHUNK_SIZE);

    setDownloading(true);
    setDownloadTotal(totalParts);

    for (let part = 0; part < totalParts; part++) {
      setDownloadPart(part + 1);

      const chunk = ids.slice(
        part * CHUNK_SIZE,
        (part + 1) * CHUNK_SIZE
      );

      const res = await fetch("/api/projects/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: chunk, mode }),
      });

      if (!res.ok) {
        alert(`Error generando ZIP (parte ${part + 1})`);
        setDownloading(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `imagenes_${mode}_part${part + 1}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
      await new Promise((r) => setTimeout(r, 300));
    }

    setDownloading(false);
    setDownloadPart(0);
    setDownloadTotal(0);
  };

  const deleteImages = async () => {
    if (selected.size === 0) return;

    const ok = confirm(
      "¿Estás seguro que deseas eliminar las imágenes seleccionadas?"
    );
    if (!ok) return;

    const res = await fetch("/api/projects/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });

    if (!res.ok) {
      alert("Error eliminando imágenes");
      return;
    }

    await loadImages();
  };

  /* ======================================================
     ESTADÍSTICAS DE VALIDACIÓN
  ====================================================== */
  const stats = {
    total: images.length,
    pending: images.filter((img) => img.validation_status === "pending").length,
    approved: images.filter((img) => img.validation_status === "approved").length,
    rejected: images.filter((img) => img.validation_status === "rejected").length,
  };

  /* ======================================================
     UI
  ====================================================== */
  return (
    <div style={{ height: "100vh", background: "#fff", display: "flex" }}>
      <div style={{ width: 22, background: "#ff6b6b" }} />

      <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
        <button
          onClick={() => router.push("/projects")}
          style={{
            marginBottom: 16,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            opacity: 0.7,
          }}
        >
          ← Volver a proyectos
        </button>

        <h1
          style={{
            fontFamily: "DM Serif Display",
            fontSize: 34,
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          Proyectos
        </h1>

        <p style={{ textAlign: "center", marginBottom: 12, opacity: 0.7 }}>
          Imágenes en proyecto: {images.length}
        </p>

        {/* Estadísticas de validación */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            marginBottom: 18,
            fontSize: 13,
          }}
        >
          <span style={{ color: "#666" }}>
            ⏳ Pendientes: <strong>{stats.pending}</strong>
          </span>
          <span style={{ color: "#10b981" }}>
            ✅ Aprobadas: <strong>{stats.approved}</strong>
          </span>
          <span style={{ color: "#ef4444" }}>
            ❌ Rechazadas: <strong>{stats.rejected}</strong>
          </span>
        </div>

        {downloading && (
          <div style={{ maxWidth: 420, margin: "0 auto 20px" }}>
            <p style={{ textAlign: "center", fontSize: 14 }}>
              Descargando ZIP {downloadPart} de {downloadTotal}
            </p>
            <div
              style={{
                height: 8,
                background: "#e0e0e0",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(downloadPart / downloadTotal) * 100}%`,
                  background: "#ff6b6b",
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}

        {/* Filtros de validación */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {(["pending", "approved", "rejected", "all"] as const).map((filter) => (
            <button
              key={filter}
              className="btn-zoom"
              onClick={() => setValidationFilter(filter)}
              style={{
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 13,
                background: validationFilter === filter ? "#ff6b6b" : "#f0f0f0",
                color: validationFilter === filter ? "#fff" : "#333",
                border: "none",
              }}
            >
              {filter === "all" && "Todas"}
              {filter === "pending" && "⏳ Pendientes"}
              {filter === "approved" && "✅ Aprobadas"}
              {filter === "rejected" && "❌ Rechazadas"}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginBottom: 28,
            flexWrap: "wrap",
          }}
        >
          <button className="btn-zoom" onClick={selectAll}
            style={{ background: "#ff6b6b", color: "#fff", borderRadius: 999 }}>
            Seleccionar todo
          </button>

          <button className="btn-zoom" onClick={deselectAll}
            style={{ borderRadius: 999 }}>
            Deseleccionar todo
          </button>

          <button className="btn-zoom"
            onClick={() => downloadZip("reference")}
            style={{ background: "#000", color: "#fff", borderRadius: 999 }}>
            Descargar ZIP (Referencia)
          </button>

          <button className="btn-zoom"
            onClick={() => downloadZip("asin")}
            style={{ background: "#ff6b6b", color: "#fff", borderRadius: 999 }}>
            Descargar ZIP (ASIN)
          </button>

          <button className="btn-zoom"
            onClick={() => setOrder(order === "oldest" ? "newest" : "oldest")}
            style={{ borderRadius: 999 }}>
            Ordenar: {order === "oldest" ? "nuevas → viejas" : "viejas → nuevas"}
          </button>

          <button className="btn-zoom"
            onClick={deleteImages}
            disabled={selected.size === 0}
            style={{
              background: "#6b1d1d",
              color: "#fff",
              borderRadius: 999,
              opacity: selected.size === 0 ? 0.5 : 1,
            }}>
            Eliminar
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 18,
          }}
        >
          {displayedImages.map((img, idx) => {
            const rowIndex = Math.floor(idx / IMAGES_PER_ROW);
            const isRowStart = idx % IMAGES_PER_ROW === 0;
            const isTwoRowDivider = idx % (IMAGES_PER_ROW * 2) === 0;

            return (
              <div
                key={img.id}
                style={{
                  background: "#f2f2f2",
                  borderRadius: 16,
                  height: 240,
                  position: "relative",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                  border: img.validation_status === "approved" 
                    ? "3px solid #10b981" 
                    : img.validation_status === "rejected"
                    ? "3px solid #ef4444"
                    : "3px solid transparent",
                }}
                onClick={() => openReviewModal(img)}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: 
                      img.validation_status === "approved"
                        ? "#10b981"
                        : img.validation_status === "rejected"
                        ? "#ef4444"
                        : "#fbbf24",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    zIndex: 4,
                  }}
                >
                  {img.validation_status === "approved" && "✓"}
                  {img.validation_status === "rejected" && "✕"}
                  {img.validation_status === "pending" && "⏳"}
                </div>

                {isRowStart && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRowSelect(rowIndex);
                    }}
                    style={{
                      position: "absolute",
                      top: 40,
                      left: 10,
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: "#fff",
                      border: "1px solid #ccc",
                      zIndex: 3,
                    }}
                  />
                )}

                {isTwoRowDivider && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTwoRowsSelect(rowIndex);
                    }}
                    style={{
                      position: "absolute",
                      top: 70,
                      left: 10,
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: "#fff",
                      border: "1px solid #ccc",
                      zIndex: 3,
                    }}
                  />
                )}

                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(img.id);
                  }}
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: selected.has(img.id)
                      ? "#ff6b6b"
                      : "#fff",
                    border: "1px solid #ccc",
                    zIndex: 2,
                  }}
                />

                {img.url && (
                  <img
                    src={img.url}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}

                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 32,
                    background: "#6b6b6b",
                    color: "#fff",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <span>{img.reference || "REF"}</span>
                  <span>|</span>
                  <span>{img.asin || "ASIN"}</span>
                  <span>| #{img.index ?? idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ width: 22, background: "#ff6b6b" }} />

      {/* 🔧 CORREGIDO: MODAL DE REVISIÓN COMPARATIVA */}
      {reviewModal?.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            display: "flex",
            flexDirection: "column",
            zIndex: 9999,
          }}
        >
          {/* Cabecera con contador y botón cerrar */}
          <div
            style={{
              padding: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#fff",
            }}
          >
            <h3 style={{ margin: 0 }}>
              Revisando: {reviewModal.currentImage?.reference || "Sin referencia"}
            </h3>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span>
                Imagen {reviewModal.currentIndex + 1} de {reviewModal.imagesInReference.length}
              </span>
              <button
                onClick={() => setReviewModal(null)}
                style={{
                  background: "transparent",
                  border: "2px solid #fff",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ✕ Cerrar
              </button>
            </div>
          </div>

          {/* Contenedor principal con split 50/50 */}
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
              padding: "0 20px",
              alignItems: "center",
            }}
          >
            {/* LADO IZQUIERDO: Imagen original */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                borderRight: "2px solid rgba(255,255,255,0.2)",
                paddingRight: 20,
              }}
            >
              <p
                style={{
                  color: "#fff",
                  marginBottom: 10,
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                Imagen Original
              </p>
              {reviewModal.currentImage?.original_image_url ? (
                <img
                  src={reviewModal.currentImage.original_image_url}
                  style={{
                    maxWidth: "90%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    borderRadius: 12,
                  }}
                  alt="Original"
                />
              ) : (
                <div
                  style={{
                    width: "80%",
                    height: "60vh",
                    background: "#333",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                  }}
                >
                  Sin imagen original
                </div>
              )}
            </div>

            {/* LADO DERECHO: Imagen generada */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                paddingLeft: 20,
              }}
            >
              <p
                style={{
                  color: "#fff",
                  marginBottom: 10,
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                Imagen Generada
              </p>
              {reviewModal.currentImage?.url && (
                <img
                  src={reviewModal.currentImage.url}
                  style={{
                    maxWidth: "90%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    borderRadius: 12,
                  }}
                  alt="Generada"
                />
              )}
            </div>
          </div>

          {/* Botones de acción centrados */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 20,
              padding: "20px 0",
            }}
          >
            <button
              onClick={() => handleReviewAction("approved")}
              style={{
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "12px 32px",
                fontSize: 16,
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
                borderRadius: 12,
                padding: "12px 32px",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕ Rechazar
            </button>
          </div>

          {/* 🔧 CORREGIDO: Carrusel de miniaturas - Muestra TODAS las de la referencia */}
          <div
            style={{
              padding: "20px",
              borderTop: "2px solid rgba(255,255,255,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                paddingBottom: 10,
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
                  {/* Indicador de estado en miniatura */}
                  {img.validation_status !== "pending" && (
                    <div
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: 
                          img.validation_status === "approved"
                            ? "#10b981"
                            : "#ef4444",
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
          </div>
        </div>
      )}
    </div>
  );
}