"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { PRESETS } from "../../lib/presets";

/* ===========================
   Utils
   =========================== */

// ✅ Soporta comas dentro de la URL sin cortarla
function parseUrls(raw: string): string[] {
  if (!raw) return [];
  const matches =
    raw.match(/https?:\/\/[^\s]+?(?=(?:\s|$|,(?=https?:\/\/)))/g) || [];
  const cleaned = matches.map((u) =>
    u.replace(/[)\]\}\>;]+$/, "").replace(/,+$/, "")
  );
  const valid = cleaned.filter((u) => {
    try {
      const x = new URL(u);
      return x.protocol === "http:" || x.protocol === "https:";
    } catch {
      return false;
    }
  });
  const unique: string[] = [];
  for (const u of valid) {
    if (!unique.includes(u)) unique.push(u);
    if (unique.length === 6) break;
  }
  return unique;
}

function proxify(url: string): string {
  return `/api/img?url=${encodeURIComponent(url)}`;
}

// ✅ Normaliza la URL a mostrar en el lightbox (data/blob directo o proxificado)
function getViewSrc(src: string): string {
  return src.startsWith("data:") || src.startsWith("blob:") ? src : proxify(src);
}

type ApiImage = { base64: string; mime?: string };
type GenMap = Record<string, ApiImage[]>;
type EditMap = Record<string, string>;

/* Cola CSV */
type BatchItem = { ref: string; asin?: string; urls: string[] };
type BatchState = { items: BatchItem[]; index: number; done: Set<string> };

/** CSV helpers */
function splitCSVLine(line: string, delim: "," | ";"): string[] {
  const pattern = new RegExp(`${delim}(?=(?:[^"]*"[^"]*")*[^"]*$)`, "g");
  return line
    .split(pattern)
    .map((f) => f.trim().replace(/^"|"$/g, "").replace(/""/g, `"`));
}
function detectDelimiter(sampleLine: string): "," | ";" {
  const commas = (sampleLine.match(/,/g) || []).length;
  const semis = (sampleLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

/* ===========================
   Thumbs (fuentes de referencia)
   =========================== */

function Thumb({
  url,
  idx,
  onRemove,
  onPreview,
  selectable = false,
  selected = true,
  onToggleSelect,
  name,
}: {
  url: string;
  idx: number;
  onRemove: (index: number) => void;
  onPreview: (src: string, name?: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (index: number) => void;
  name?: string;
}) {
  const initialSrc =
    url.startsWith("data:") || url.startsWith("blob:") ? url : proxify(url);

  const [src, setSrc] = useState<string>(initialSrc);
  const [usedFallback, setUsedFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(url.startsWith("data:") || url.startsWith("blob:") ? url : proxify(url));
    setUsedFallback(false);
    setFailed(false);
  }, [url]);

  const handleImgError = () => {
    if ((url.startsWith("http://") || url.startsWith("https://")) && !usedFallback) {
      setUsedFallback(true);
      setSrc(`https://images.weserv.nl/?url=${encodeURIComponent(url)}`);
    } else {
      setFailed(true);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: 70,
        height: 70,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        background: "#111315",
        cursor: "zoom-in",
      }}
      title={url}
      onClick={() => !failed && onPreview(src, name)}
    >
      {!failed ? (
        <img
          src={src}
          alt=""
          crossOrigin="anonymous"
          onError={handleImgError}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9aa0a6",
            fontSize: 10,
            padding: 6,
            textAlign: "center",
          }}
        >
          IMG
        </div>
      )}

      {/* eliminar */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(idx);
        }}
        title="Eliminar"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 22,
          height: 22,
          borderRadius: 6,
          border: "1px solid #2a2d31",
          background: "rgba(0,0,0,.6)",
          color: "#E7E9EE",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        ×
      </button>

      {/* (de)seleccionar para API */}
      {selectable && (
        <label
          onClick={(e) => e.stopPropagation()}
          title={selected ? "Usar esta imagen" : "No enviar esta imagen a la IA"}
          style={{
            position: "absolute",
            left: 4,
            bottom: 4,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "1px 4px",
            fontSize: 10,
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(idx)}
          />
          usar
        </label>
      )}
    </div>
  );
}

/* ===========================
   Constantes de persistencia
   =========================== */

type Mode = "csv" | "url" | "local";

const LS_PRESET_OVERRIDES = "presetOverrides:v1";
const LS_PRESET_ORDER = "presetOrder:v1";
const LS_CUSTOM_REFS = "customRefs:v1";
const LS_SELECTED_PROJECT = "selectedProject:v1";

/* Instrucción automática para prompts custom con imagen de referencia */
const REFERENCE_INSTRUCTION_EN = `
Imitate the composition, lighting, and style of the reference image,
but use my product exactly as it appears — hyperrealistic, with 100% accurate design, logos, and details.
`.trim();

type Overrides = {
  names: Record<string, string | undefined>;
  prompts: Record<string, string | undefined>;
};

/* ===========================
   Página
   =========================== */

export default function Page() {
  /* ====== Estados para los selectores ====== */
  const [imageSize, setImageSize] = useState<string>("2000x2000");
  const [imageFormat, setImageFormat] = useState<string>("jpg");
  const [engine, setEngine] = useState<"standard" | "pro">("standard");

  /* ====== Modo de carga ====== */
  const [mode, setMode] = useState<Mode>("url");

  /* ====== URL / CSV ====== */
  const [urlInput, setUrlInput] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [urlEnabled, setUrlEnabled] = useState<boolean[]>([]);

  const addUrls = () => {
    const parsed = parseUrls(urlInput);
    setUrls(parsed);
    setUrlEnabled(parsed.map(() => true));
    setUrlInput("");
  };
  const removeUrl = (idx: number) => {
    const u = urls.slice(); u.splice(idx, 1); setUrls(u);
    const en = urlEnabled.slice(); en.splice(idx, 1); setUrlEnabled(en);
  };
  const clearUrls = () => {
    setUrls([]);
    setUrlEnabled([]);
    setUrlInput("");
  };

  /* ====== Local ====== */
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [localEnabled, setLocalEnabled] = useState<boolean[]>([]);
  const [localNames, setLocalNames] = useState<string[]>([]);
  const [firstLocalBase, setFirstLocalBase] = useState<string>("");
  const [zipNameRef, setZipNameRef] = useState<string>("");
  const [zipNameAsin, setZipNameAsin] = useState<string>("");
  const [zipInputKey, setZipInputKey] = useState<number>(0);

  const addLocalFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;

    const spaceLeft = Math.max(0, 6 - localImages.length);
    const toReadFiles = Array.from(files).slice(0, spaceLeft);

    if (!firstLocalBase && toReadFiles.length > 0) {
      const base = toReadFiles[0].name.replace(/\.[^/.]+$/, "");
      setFirstLocalBase(base);
      if (!zipNameRef) setZipNameRef(base);
    }

    const readers = await Promise.all(
      toReadFiles.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = reject;
            fr.readAsDataURL(f);
          })
      )
    );

    setLocalImages((prev) => [...prev, ...readers].slice(0, 6));
    setLocalEnabled((prev) => [...prev, ...readers.map(() => true)].slice(0, 6));
    setLocalNames((prev) => [...prev, ...toReadFiles.map((f) => f.name)].slice(0, 6));
  };

  const removeLocal = (idx: number) => {
    const l = localImages.slice(); l.splice(idx, 1); setLocalImages(l);
    const en = localEnabled.slice(); en.splice(idx, 1); setLocalEnabled(en);
    const n = localNames.slice(); n.splice(idx, 1); setLocalNames(n);
  };

  const clearLocal = () => {
    setLocalImages([]);
    setLocalEnabled([]);
    setLocalNames([]);
    setFirstLocalBase("");
  };

  useEffect(() => {
    if (mode === "url") {
      setZipNameRef("");
      setZipNameAsin("");
      setZipInputKey((k) => k + 1);
    }
  }, [mode]);

  // Cantidad
  const [count, setCount] = useState<number>(1);
  const handleCountChange = (v: string) => {
    let n = Number(v);
    if (Number.isNaN(n) || n < 1) n = 1;
    if (n > 6) n = 6;
    setCount(n);
  };

  /* ====== Batch CSV ====== */
  const [batch, setBatch] = useState<BatchState>({ items: [], index: 0, done: new Set() });

  /* ====== Resultados por REFERENCIA ====== */
  const [resultsByRef, setResultsByRef] = useState<Record<string, GenMap>>({});

  /* ====== ESTADO DE CARGA POR TARJETA ====== */
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());

  /* ====== Overrides persistentes (NOMBRES + PROMPTS) ====== */
  const [nameOverrides, setNameOverrides] = useState<Record<string, string | undefined>>({});
  const [editedPrompts, setEditedPrompts] = useState<EditMap>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_PRESET_OVERRIDES);
      if (raw) {
        const parsed = JSON.parse(raw) as Overrides;
        setNameOverrides(parsed.names || {});
        setEditedPrompts(parsed.prompts || {});
      }
    } catch (e) {
      console.warn("No se pudieron cargar overrides de localStorage.", e);
    }
  }, []);

  useEffect(() => {
    try {
      const toStore: Overrides = { names: nameOverrides, prompts: editedPrompts };
      localStorage.setItem(LS_PRESET_OVERRIDES, JSON.stringify(toStore));
    } catch (e) {
      console.warn("No se pudieron guardar overrides en localStorage.", e);
    }
  }, [nameOverrides, editedPrompts]);

  /* ====== Lightbox ====== */
  const [lightbox, setLightbox] = useState<{ open: boolean; src?: string; name?: string }>({ open: false });
  const openLightbox = (src: string, name?: string) => setLightbox({ open: true, src, name });
  const closeLightbox = () => setLightbox({ open: false, src: undefined, name: undefined });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeLightbox();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!lightbox.open) return;
    const img = document.getElementById("zoom-image") as HTMLImageElement | null;
    const lens = document.getElementById("zoom-lens") as HTMLDivElement | null;
    if (!img || !lens) return;

    const move = (e: MouseEvent) => {
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        lens.style.display = "none";
        return;
      }

      lens.style.display = "block";
      lens.style.left = `${x - lens.offsetWidth / 2}px`;
      lens.style.top = `${y - lens.offsetHeight / 2}px`;
      lens.style.backgroundImage = `url(${img.src})`;
      lens.style.backgroundPosition = `-${x * 2 - lens.offsetWidth / 2}px -${y * 2 - lens.offsetHeight / 2}px`;
      lens.style.backgroundSize = `${img.width * 2}px ${img.height * 2}px`;
    };
    img.addEventListener("mousemove", move);
    img.addEventListener("mouseleave", () => { if (lens) (lens.style.display = "none"); });
    return () => { img.removeEventListener("mousemove", move); };
  }, [lightbox.open]);

  /* ====== 🔧 CORREGIDO: Referencia activa ====== */
  const activeRef = useMemo(() => {
    if (batch.items.length > 0) {
      return batch.items[batch.index]?.ref ?? "manual";
    }
    // 🆕 En modo URL o Local, usar zipNameRef si existe, sino "manual"
    return zipNameRef.trim() || "manual";
  }, [batch.items, batch.index, zipNameRef]);

  const activeAsin = useMemo(() => {
    if (batch.items.length > 0) {
      return batch.items[batch.index]?.asin ?? "";
    }
    // 🆕 En modo URL o Local, usar zipNameAsin
    return zipNameAsin.trim();
  }, [batch.items, batch.index, zipNameAsin]);

  useEffect(() => {
    if (mode === "csv" && batch.items.length > 0) {
      const currentItem = batch.items[batch.index];
      if (currentItem) {
        setZipNameRef(currentItem.ref || "");
        setZipNameAsin(currentItem.asin || "");
        setZipInputKey((k) => k + 1);
      }
    }
  }, [batch.index, batch.items, mode]);

  /* ====== Orden de selección para descarga (0..n) ====== */
  type OrderMap = Record<string, number>;
  const [orderMap, setOrderMap] = useState<OrderMap>({});
  const keyFor = (ref: string, presetId: string, idx: number) => `${ref}::${presetId}::${idx}`;
  const getOrder = (ref: string, presetId: string, idx: number) => orderMap[keyFor(ref, presetId, idx)];
  const isOrdered = (ref: string, presetId: string, idx: number) =>
    typeof getOrder(ref, presetId, idx) === "number";
  const toggleOrder = (ref: string, presetId: string, idx: number) => {
    const k = keyFor(ref, presetId, idx);
    setOrderMap((prev) => {
      const next = { ...prev };
      if (k in next) {
        delete next[k];
        const pairs = Object.entries(next)
          .filter(([key]) => key.startsWith(`${ref}::`))
          .sort((a, b) => a[1] - b[1]);
        pairs.forEach(([key], i) => (next[key] = i));
      } else {
        const currentNums = Object.entries(next)
          .filter(([key]) => key.startsWith(`${ref}::`))
          .map(([, v]) => v);
        const nextNum = currentNums.length ? Math.max(...currentNums) + 1 : 0;
        next[k] = nextNum;
      }
      return next;
    });
  };
  const clearNumberingForActiveRef = () => {
    setOrderMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${activeRef}::`)) delete next[k];
      });
      return next;
    });
  };

  /* ====== CSV upload ====== */
  const handleCSVUpload = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) { alert("El CSV está vacío."); return; }
      const delim = detectDelimiter(lines[0]);
      const headerCells = splitCSVLine(lines[0].toLowerCase(), delim);
      const hasHeader = headerCells[0]?.includes("reference") || headerCells[0]?.includes("referencia");
      const start = hasHeader ? 1 : 0;

      const items: BatchItem[] = [];
      for (let i = start; i < lines.length; i++) {
        const cells = splitCSVLine(lines[i], delim);
        if (!cells.length) continue;
        
        const ref = (cells[0] || "").trim().replace(/\s+/g, " ");
        const asin = (cells[1] || "").trim();
        
        let urlFields = cells.slice(2, 7);
        
        if (cells.length <= 2) {
          urlFields = [cells[1] || ""];
        }
        
        const urls: string[] = [];
        for (const f of urlFields) {
          parseUrls(f || "").forEach((u) => { if (urls.length < 6) urls.push(u); });
        }
        
        if (!ref || !urls.length) continue;
        items.push({ ref, asin: asin || undefined, urls });
      }

      if (!items.length) { alert("No se encontraron filas válidas."); return; }

      setBatch({ items, index: 0, done: new Set() });
      setMode("csv");
      setUrls(items[0].urls);
      setUrlEnabled(items[0].urls.map(() => true));
      setUrlInput(items[0].urls.join(" "));
      
      setZipNameRef(items[0].ref || "");
      setZipNameAsin(items[0].asin || "");
      
      alert(`Cargadas ${items.length} referencias.`);
    } catch (e) {
      console.error(e);
      alert("No se pudo leer el CSV.");
    }
  };

  const goNextRef = () => {
    if (!batch.items.length) return;
    const nextIndex = Math.min(batch.index + 1, batch.items.length - 1);
    const nextItem = batch.items[nextIndex];
    setBatch((b) => ({ ...b, index: nextIndex }));
    setUrls(nextItem.urls);
    setUrlEnabled(nextItem.urls.map(() => true));
    setUrlInput(nextItem.urls.join(" "));
    
    setZipNameRef(nextItem.ref || "");
    setZipNameAsin(nextItem.asin || "");
  };

  const markCurrentAsDone = () => {
    if (!batch.items.length) return;
    setBatch((b) => {
      const done = new Set(b.done);
      done.add(b.items[b.index].ref);
      return { ...b, done };
    });
  };

  /* ====== Descargar seleccionadas a ZIP ====== */
  const handleDownloadSelected = async (useAsin: boolean = false) => {
    const zip = new JSZip();
    let added = 0;

    const targetRef = activeRef;

    let baseName = "";
    if (useAsin) {
      baseName = zipNameAsin.trim();
      if (!baseName) {
        alert("El campo ASIN está vacío. Rellénalo o usa el botón de Referencia.");
        return;
      }
    } else {
      baseName = zipNameRef.trim() || 
        (mode === "local" ? (firstLocalBase.trim() || activeRef) : activeRef);
    }

    if (!baseName) {
      alert("No hay nombre para el ZIP.");
      return;
    }

    const entries = Object.entries(orderMap)
      .filter(([k]) => k.startsWith(`${targetRef}::`))
      .sort((a, b) => a[1] - b[1]);

    const byRef = resultsByRef[targetRef] || {};

    for (const [k, order] of entries) {
      const [, presetId, idxStr] = k.split("::");
      const idx = Number(idxStr);
      const imgs = byRef[presetId] || [];
      const img = imgs[idx];
      if (!img) continue;
      const ext =
        img.mime?.includes("png")
          ? "png"
          : img.mime?.includes("webp")
          ? "webp"
          : img.mime?.includes("gif")
          ? "gif"
          : "jpg";

      const filename = `${baseName}_${order}.${ext}`;
      zip.file(filename, img.base64, { base64: true });
      added++;
    }

    if (!added) {
      alert("No hay imágenes con numeración asignada.");
      return;
    }

    const finalName = `${baseName}_images.zip`;
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, finalName);
  };

  /* ====== NUEVO: Estado para proyectos ====== */
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

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

  useEffect(() => {
    if (selectedProjectId) {
      try {
        localStorage.setItem(LS_SELECTED_PROJECT, selectedProjectId);
      } catch (e) {
        console.warn("No se pudo guardar proyecto seleccionado en localStorage", e);
      }
    }
  }, [selectedProjectId]);

  /* ====== Estado para el envío ====== */
  const [isSending, setIsSending] = useState(false);

  /* ====== 🔧 CORREGIDO: Función para enviar a proyecto ====== */
  const handleSendToProject = async () => {
    if (!selectedProjectId) {
      alert("Selecciona un proyecto antes de enviar imágenes.");
      return;
    }

    // 🆕 Usar activeRef y activeAsin que ya toman en cuenta zipNameRef y zipNameAsin
    const reference = activeRef || null;
    const asin = activeAsin || null;

    if (!reference) {
      alert("Debes especificar una referencia en el campo correspondiente.");
      return;
    }

    const entries = Object.entries(orderMap)
      .filter(([k]) => k.startsWith(`${activeRef}::`))
      .sort((a, b) => a[1] - b[1]);

    if (entries.length === 0) {
      alert("No hay imágenes numeradas para enviar.");
      return;
    }

    const byRef = resultsByRef[activeRef] || {};

    const images = entries
      .map(([k, order]) => {
        const [, presetId, idxStr] = k.split("::");
        const idx = Number(idxStr);
        const img = byRef[presetId]?.[idx];
        if (!img) return null;

        const mime = img.mime || "image/jpeg";
        const ext =
          mime.includes("png") ? "png" :
          mime.includes("webp") ? "webp" :
          mime.includes("gif") ? "gif" :
          "jpg";

        return {
          base64: img.base64,
          mime,
          filename: `${reference}_${order}.${ext}`,
          reference,
          asin,
          image_index: order
        };
      })
      .filter(Boolean);

    if (images.length === 0) {
      alert("No se encontraron imágenes válidas.");
      return;
    }

    setIsSending(true);

    try {
      const res = await fetch("/api/projects/add-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          images,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error("Error enviando imágenes:", data);
        alert("Error enviando imágenes al proyecto.");
        return;
      }

      alert(`✅ ${images.length} imagen(es) enviadas correctamente al proyecto`);
    } catch (error) {
      console.error(error);
      alert("❌ Error enviando las imágenes al proyecto");
    } finally {
      setIsSending(false);
    }
  };

  const clearAllImages = () => {
    if (!Object.keys(resultsByRef).length && urls.length === 0 && localImages.length === 0) return;
    if (confirm("¿Limpiar panel? Esto borra imágenes generadas, numeración y fuentes cargadas (URLs/Local).")) {
      setResultsByRef({});
      setOrderMap({});
      clearUrls();
      clearLocal();
    }
  };

  /* ====== Construcción de presets con 6 extras y orden persistente ====== */

  const baseAndCustom = useMemo(() => {
    const customs = Array.from({ length: 6 }, (_, i) => ({
      id: `custom-${i + 1}`,
      name: `Custom ${i + 1}`,
      prompt: "",
    }));
    return [...PRESETS, ...customs];
  }, []);

  const [presetOrder, setPresetOrder] = useState<string[]>([]);
  
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_PRESET_ORDER);
      const defaultOrder = baseAndCustom.map((p) => p.id);
      if (!raw) {
        setPresetOrder(defaultOrder);
        localStorage.setItem(LS_PRESET_ORDER, JSON.stringify(defaultOrder));
        return;
      }
      const stored = JSON.parse(raw) as string[];
      const existingSet = new Set(baseAndCustom.map((p) => p.id));
      const filtered = stored.filter((id) => existingSet.has(id));
      const missing = baseAndCustom.map((p) => p.id).filter((id) => !filtered.includes(id));
      const finalOrder = [...filtered, ...missing];
      setPresetOrder(finalOrder);
      localStorage.setItem(LS_PRESET_ORDER, JSON.stringify(finalOrder));
    } catch (e) {
      console.warn("No se pudo leer/guardar el orden de presets.", e);
      setPresetOrder(baseAndCustom.map((p) => p.id));
    }
  }, [baseAndCustom]);

  const mapById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; prompt: string }>();
    baseAndCustom.forEach((p) => m.set(p.id, p));
    return m;
  }, [baseAndCustom]);

  const presetsInOrder = useMemo(() => {
    return presetOrder
      .map((id) => mapById.get(id))
      .filter(Boolean) as { id: string; name: string; prompt: string }[];
  }, [presetOrder, mapById]);

  const persistOrder = (order: string[]) => {
    setPresetOrder(order);
    try {
      localStorage.setItem(LS_PRESET_ORDER, JSON.stringify(order));
    } catch {}
  };

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const onDragStart = (id: string) => (e: React.DragEvent) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (overId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!draggingId || draggingId === overId) return;
  };
  const onDrop = (overId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const dragged = draggingId || e.dataTransfer.getData("text/plain");
    if (!dragged || dragged === overId) return;
    setDraggingId(null);
    const idxFrom = presetOrder.indexOf(dragged);
    const idxTo = presetOrder.indexOf(overId);
    if (idxFrom === -1 || idxTo === -1) return;
    const next = presetOrder.slice();
    next.splice(idxFrom, 1);
    next.splice(idxTo, 0, dragged);
    persistOrder(next);
  };
  const onDragEnd = () => setDraggingId(null);

  /* ====== Modal de edición (nombre + prompt) ====== */
  const [showModal, setShowModal] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const currentPreset = useMemo(
    () => (editingPresetId ? (mapById.get(editingPresetId) ?? null) : null),
    [editingPresetId, mapById]
  );
  const [editingName, setEditingName] = useState<string>("");
  const [editingValue, setEditingValue] = useState<string>("");

  const openEditPrompt = (presetId: string) => {
    const preset = mapById.get(presetId);
    if (!preset) return;
    setEditingPresetId(presetId);
    const shownName = (nameOverrides[presetId] ?? preset.name) || "";
    setEditingName(shownName);
    setEditingValue(editedPrompts[presetId] ?? preset.prompt);
    setShowModal(true);
  };
  const closeEditPrompt = () => {
    setShowModal(false);
    setEditingPresetId(null);
  };
  const saveEditedPrompt = () => {
    if (!editingPresetId) return;

    const newNames = { ...nameOverrides };
    const trimmedName = (editingName || "").trim();
    if (trimmedName) newNames[editingPresetId] = trimmedName;
    else delete newNames[editingPresetId];

    const newPrompts = { ...editedPrompts };
    const trimmedPrompt = (editingValue || "").trim();
    if (trimmedPrompt) newPrompts[editingPresetId] = trimmedPrompt;
    else delete newPrompts[editingPresetId];

    setNameOverrides(newNames);
    setEditedPrompts(newPrompts);
    setShowModal(false);
    setEditingPresetId(null);
  };

  /* ====== Activo: fuentes para previsualización según modo ====== */
  const activeSources = mode === "local" ? localImages : urls;
  const activeEnabled = mode === "local" ? localEnabled : urlEnabled;
  const setEnabledAt = (i: number) => {
    if (mode === "local") {
      setLocalEnabled((prev) => {
        const next = [...prev]; next[i] = !next[i]; return next;
      });
    } else {
      setUrlEnabled((prev) => {
        const next = [...prev]; next[i] = !next[i]; return next;
      });
    }
  };

  /* ====== Tabla: exportar & limpiar ====== */
  const exportReferencesCSV = () => {
    if (!batch.items.length) {
      alert("No hay referencias en la tabla.");
      return;
    }
    const rows = [["referencia", "asin", "finalizada"]];
    batch.items.forEach((it) => {
      const done = batch.done.has(it.ref) ? "Sí" : "No";
      rows.push([it.ref, it.asin || "", done]);
    });
    const csv = rows
      .map((r) =>
        r
          .map((v) => {
            const s = String(v ?? "");
            return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(";")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const fileName = "referencias.csv";
    (function download() {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })();
  };

  const clearReferenceTable = () => {
    if (!batch.items.length) {
      alert("La tabla ya está vacía.");
      return;
    }
    const ok = confirm("¿Seguro que quieres vaciar la tabla de referencias? Esta acción no afecta a las imágenes ni a otros datos.");
    if (!ok) return;
    setBatch({ items: [], index: 0, done: new Set() });
  };

  /* ====== NUEVO: Imágenes de referencia por tarjeta custom ====== */

  type RefImageMap = Record<string, string | undefined>;
  const [customRefs, setCustomRefs] = useState<RefImageMap>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_CUSTOM_REFS);
      if (raw) setCustomRefs(JSON.parse(raw));
    } catch (e) {
      console.warn("No se pudieron cargar customRefs.", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CUSTOM_REFS, JSON.stringify(customRefs));
    } catch (e) {
      console.warn("No se pudieron guardar customRefs.", e);
    }
  }, [customRefs]);

  const addCustomRefFromFile = async (presetId: string, file: File | null) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      const base64 = String(fr.result);
      setCustomRefs((prev) => ({ ...prev, [presetId]: base64 }));
    };
    fr.readAsDataURL(file);
  };
  const addCustomRefFromUrl = (presetId: string, url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
      setCustomRefs((prev) => ({ ...prev, [presetId]: trimmed }));
    } catch {
      alert("URL no válida.");
    }
  };
  const removeCustomRef = (presetId: string) => {
    setCustomRefs((prev) => {
      const next = { ...prev };
      delete next[presetId];
      return next;
    });
  };
  const clearAllCustomRefs = () => {
    if (!Object.keys(customRefs).length) return;
    const ok = confirm("¿Eliminar TODAS las imágenes de referencia de las tarjetas Custom? No afectará a prompts ni resultados.");
    if (!ok) return;
    localStorage.removeItem(LS_CUSTOM_REFS);
    setCustomRefs({});
  };

  /* ====== Generar (declaración de función HOISTED) ====== */
  async function handleGenerate(presetId: string) {
    const usingLocal = mode === "local";
    const sources = usingLocal ? localImages : urls;
    const enabled = usingLocal ? localEnabled : urlEnabled;

    const productRefs = sources.filter((_, i) => enabled[i]);
    if (!productRefs.length) {
      alert("Selecciona al menos 1 imagen/URL (máx. 6).");
      return;
    }

    let overridePrompt = (editedPrompts[presetId] ?? mapById.get(presetId)?.prompt ?? "").trim();

    const isCustom = presetId.startsWith("custom-");
    const refImage = customRefs[presetId];
    if (isCustom) {
      if (!overridePrompt) {
        alert("Escribe un prompt en la tarjeta antes de generar.");
        return;
      }
      if (refImage) {
        overridePrompt = `${overridePrompt}\n\n${REFERENCE_INSTRUCTION_EN}`.trim();
      }
    }

    const refsToSend = (refImage ? [refImage, ...productRefs] : productRefs).slice(0, 6);

    const basePresetId = isCustom ? (PRESETS[0]?.id || presetId) : presetId;

    const [width, height] = imageSize.split('x').map(Number);

    try {
      setLoadingSet((prev) => {
        const next = new Set(prev);
        next.add(presetId);
        return next;
      });

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: basePresetId,
          refs: refsToSend,
          count,
          overridePrompt,
          width,
          height,
          format: imageFormat,
          engine,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error en la generación");
      setResultsByRef((prev) => {
        const refKey = activeRef;
        const byRef = { ...(prev[refKey] || {}) };
        byRef[presetId] = data.images || [];
        return { ...prev, [refKey]: byRef };
      });
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Error generando imágenes");
    } finally {
      setLoadingSet((prev) => {
        const next = new Set(prev);
        next.delete(presetId);
        return next;
      });
    }
  }

  /* ===========================
     UI
     =========================== */
  return (
    <div style={{ padding: "32px 18px", maxWidth: 1200, margin: "0 auto" }}>
      {/* --------- CSS --------- */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
.preset-card{display:flex;flex-direction:column}
.preset-card .viewport{flex:1 1 auto;min-height:0}
.preset-card .coral{background:var(--brand-accent)}
.preset-card .prompt-box{
  background:#ff6b6b;
  border:1px solid rgba(0,0,0,.08);
  color:#15181C;
  border-radius:12px;
  padding:10px 12px;
  max-height:82px;
  overflow:auto
}
.preset-card .prompt-box[data-empty="true"]{ background:#ffffff; }
.preset-card .prompt-box::-webkit-scrollbar{height:6px;width:6px}
.preset-card .prompt-box::-webkit-scrollbar-thumb{border-radius:6px}

/* Miniatura de imagen de referencia (custom) */
.custom-ref-thumb{
  width:100%;height:140px;object-fit:cover;border-radius:10px;display:block;
  background:#0b0c0e;border:1px solid #2a2d31;box-shadow:0 8px 18px rgba(0,0,0,.12);
  cursor:zoom-in;
}
.custom-ref-actions .btn{border:1px solid #e5e7eb;background:#fff;color:#111;border-radius:8px;padding:6px 10px;cursor:pointer}
.custom-ref-actions .btn.dark{background:#22252A;color:#fff;border:1px solid #2a2d31}
.custom-ref-actions .btn.danger{background:#ffefef;color:#b91c1c;border:1px solid #fecaca}
.orderBadge{
  position:absolute;top:6px;left:6px;border:1px solid rgba(0,0,0,.2);background:#fff;border-radius:6px;padding:4px 8px;font-weight:800;cursor:pointer
}
.spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.6);border-top-color:transparent;border-radius:999px;display:inline-block;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
          `,
        }}
      />

      {/* Header + acciones derechas */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10, height: 10, background: "var(--brand-accent)",
              borderRadius: "999px", boxShadow: "0 0 0 3px var(--brand-accent-glow)",
            }}
          />
          <h1 style={{ margin: 0, fontWeight: 800, color: "var(--brand-accent)" }}>
            Kreative 360º · Panel de trabajo
          </h1>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={clearAllImages}
            style={{
              borderRadius: 10, padding: "8px 12px",
              background: "#22252A", color: "#fff",
              fontWeight: 700, cursor: "pointer",
            }}
          >
            Refrescar panel
          </button>

          <button
            onClick={clearNumberingForActiveRef}
            style={{
              borderRadius: 10, padding: "8px 12px",
              background: "#fff", border: "1px solid #e5e7eb",
              color: "#111", fontWeight: 700, cursor: "pointer",
            }}
            title="Borra SOLO la numeración 0..n de la referencia activa"
          >
            Refrescar numeración
          </button>

          <button
            onClick={clearAllCustomRefs}
            style={{
              borderRadius: 10, padding: "8px 12px",
              background: "#fff", border: "1px solid #e5e7eb",
              color: "#111", fontWeight: 700, cursor: "pointer",
            }}
            title="Elimina todas las imágenes de referencia de las tarjetas Custom. No afecta a prompts ni resultados."
          >
            Refrescar Tarjetas Custom
          </button>
        </div>
      </div>

      <p style={{ marginTop: 6, color: "#15181C" }}>MVP Privado - Alejandro García</p>

      {/* Grupo 1 – Fuente */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {(["csv", "url", "local"] as Mode[]).map((m) => {
          const label =
            m === "csv"
              ? "Por fichero (CSV)"
              : m === "url"
              ? "Por URL"
              : "Desde mi PC";
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                borderRadius: 999,
                padding: "8px 12px",
                border: "1px solid #e5e7eb",
                background: active ? "var(--brand-accent)" : "#fff",
                color: active ? "var(--brand-accent-ink)" : "#111",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Grupo 2 – Opciones de generación */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <select
          value={imageSize}
          onChange={(e) => setImageSize(e.target.value)}
          style={{
            borderRadius: 10,
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            background: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <option value="1024x1024">1:1 (cuadrado) · 1024×1024</option>
          <option value="2000x2000">2:2 (cuadrado) · 2000×2000</option>

          <option value="832x1248">2:3 (vertical) · 832×1248</option>
          <option value="864x1184">3:4 (vertical) · 864×1184</option>
          <option value="896x1152">4:5 (vertical) · 896×1152</option>
          <option value="768x1344">9:16 (vertical) · 768×1344</option>
          <option value="672x1536">21:9 (vertical) · 672×1536</option>

          <option value="1248x832">3:2 (horizontal) · 1248×832</option>
          <option value="1184x864">4:3 (horizontal) · 1184×864</option>
          <option value="1152x896">5:4 (horizontal) · 1152×896</option>
          <option value="1344x768">16:9 (horizontal) · 1344×768</option>
          <option value="1536x672">21:9 (horizontal) · 1536×672</option>

          <option value="1748x2480">A5 vertical · 1748×2480</option>
          <option value="2480x1748">A5 horizontal · 2480×1748</option>
          <option value="2480x3508">A4 vertical · 2480×3508</option>
          <option value="3508x2480">A4 horizontal · 3508×2480</option>
          <option value="3508x4961">A3 vertical · 3508×4961</option>
          <option value="4961x3508">A3 horizontal · 4961×3508</option>
        </select>

        <select
          value={imageFormat}
          onChange={(e) => setImageFormat(e.target.value)}
          style={{
            borderRadius: 10,
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            background: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <option value="jpg">JPG</option>
          <option value="png">PNG</option>
          <option value="webp">WEBP</option>
          <option value="bmp">BMP</option>
        </select>

        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value as "standard" | "pro")}
          style={{
            borderRadius: 10,
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            background: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <option value="standard">Standard</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* Tabla persistente de referencias */}
      {batch.items.length > 0 && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <strong>Referencias cargadas ({batch.items.length})</strong>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <small style={{ color: "#6b7280" }}>
                Esta tabla no se limpia con "Refrescar panel".
              </small>
              <button
                onClick={exportReferencesCSV}
                className="btn-ghost"
                style={{ padding: "6px 10px" }}
                title="Exportar CSV (referencia;asin;finalizada)"
              >
                CSV
              </button>
              <button
                onClick={clearReferenceTable}
                className="btn-ghost"
                style={{ padding: "6px 10px" }}
                title="Vaciar tabla de referencias"
              >
                Vaciar tabla
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              maxHeight: 260,
              overflow: "auto",
              border: "1px solid #f0f2f4",
              borderRadius: 10,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Finalizada</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Referencia</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>ASIN</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Nº URLs</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {batch.items.map((it, i) => {
                  const done = batch.done.has(it.ref);
                  const isActive = i === batch.index;
                  return (
                    <tr
                      key={it.ref + i}
                      style={{
                        background: isActive ? "#fff7ed" : i % 2 ? "#ffffff" : "#f8fafa",
                        borderTop: "1px solid #f0f2f4",
                      }}
                    >
                      <td style={{ padding: "8px 12px" }}>
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() =>
                            setBatch((b) => {
                              const d = new Set(b.done);
                              if (d.has(it.ref)) d.delete(it.ref);
                              else d.add(it.ref);
                              return { ...b, done: d };
                            })
                          }
                        />
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <button
                          onClick={() => {
                            setBatch((b) => ({ ...b, index: i }));
                            setMode("csv");
                            setUrls(it.urls);
                            setUrlEnabled(it.urls.map(() => true));
                            setUrlInput(it.urls.join(" "));
                            setZipNameRef(it.ref || "");
                            setZipNameAsin(it.asin || "");
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#2563eb",
                            textDecoration: "underline",
                            cursor: "pointer",
                            padding: 0,
                          }}
                          title="Activar esta referencia"
                        >
                          {it.ref}
                        </button>
                      </td>
                      <td style={{ padding: "8px 12px" }}>{it.asin || ""}</td>
                      <td style={{ padding: "8px 12px" }}>{it.urls.length}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <button
                          onClick={() => {
                            if (!confirm(`¿Eliminar la referencia "${it.ref}"?`)) return;
                            setBatch((b) => {
                              const items = b.items.slice();
                              items.splice(i, 1);
                              const nextIndex = Math.min(b.index, Math.max(0, items.length - 1));
                              return { ...b, items, index: nextIndex };
                            });
                          }}
                          className="icon-btn"
                          title="Eliminar referencia"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
            <button
              onClick={() => {
                const prevIndex = Math.max(0, batch.index - 1);
                const prevItem = batch.items[prevIndex];
                setBatch((b) => ({ ...b, index: prevIndex }));
                if (prevItem) {
                  setUrls(prevItem.urls);
                  setUrlEnabled(prevItem.urls.map(() => true));
                  setUrlInput(prevItem.urls.join(" "));
                  setZipNameRef(prevItem.ref || "");
                  setZipNameAsin(prevItem.asin || "");
                }
              }}
              disabled={batch.index === 0}
              style={{
                border: "1px solid #e5e7eb", background: "#fff", color: "#111",
                borderRadius: 8, padding: "6px 10px", cursor: batch.index === 0 ? "not-allowed" : "pointer",
              }}
            >
              ← Anterior
            </button>
            <button
              onClick={goNextRef}
              disabled={batch.index >= batch.items.length - 1}
              style={{
                border: "1px solid #e5e7eb", background: "#fff", color: "#111",
                borderRadius: 8, padding: "6px 10px",
                cursor: batch.index >= batch.items.length - 1 ? "not-allowed" : "pointer",
              }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Panel de carga según modo */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 18,
          marginTop: 18,
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, fontWeight: 800, color: "var(--brand-accent)" }}>
            Kreative 360º · Generador de Imágenes Masivo IA
          </h2>
        </div>

        <p style={{ marginTop: 6, color: "#4b5563" }}>
          {mode === "csv" &&
            "Carga un CSV con: columna A referencia; B ASIN (opcional); C–G con 1–5 URLs por producto."}
          {mode === "url" &&
            "Pega 1–6 URLs (JPG/PNG) del mismo producto. Puedes separarlas por espacios; también aceptamos comas dentro de parámetros de la URL."}
          {mode === "local" &&
            "Carga 1–6 imágenes desde tu ordenador (JPG/PNG). Se usas solo en tu navegador."}
        </p>

        {/* URL mode */}
        {mode === "url" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="https://…   https://…   https://…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addUrls(); }}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  padding: "12px 14px",
                  outline: "none",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  color: "#15181C",
                }}
              />
              <button
                onClick={addUrls}
                title="Añadir URLs"
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "var(--brand-accent)", color: "var(--brand-accent-ink)",
                  fontWeight: 800, cursor: "pointer",
                }}
              >
                ↑
              </button>

              <label
                style={{
                  border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px",
                  cursor: "pointer", background: "#fff", whiteSpace: "nowrap",
                }}
                title="Cargar CSV de referencias"
              >
                Cargar CSV
                <input
                  type="file" accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCSVUpload(f);
                    e.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            <div style={{ marginTop: 12 }}>
              {urls.length > 0 && (
                <div
                  style={{
                    marginBottom: 8, display: "flex",
                    alignItems: "center", gap: 12,
                  }}
                >
                  <button
                    onClick={() => { clearUrls(); setUrlInput(""); }}
                    style={{
                      border: "1px solid #e5e7eb",
                      background: "transparent",
                      color: "#374151",
                      borderRadius: 10,
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Limpiar todo
                  </button>
                  <small style={{ color: "#6b7280" }}>
                    ({urls.length}/6 referencias)
                  </small>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {urls.map((u, i) => (
                  <Thumb
                    key={i}
                    url={u}
                    idx={i}
                    onRemove={removeUrl}
                    onPreview={(src, name) => openLightbox(src, name)}
                    selectable
                    selected={!!activeEnabled[i]}
                    onToggleSelect={setEnabledAt}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* CSV mode */}
        {mode === "csv" && (
          <>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginTop: 4,
              }}
            >
              <label
                style={{
                  border: "1px solid #e5e7eb", borderRadius: 10,
                  padding: "8px 12px", cursor: "pointer", background: "#fff",
                }}
                title="Cargar CSV de referencias"
              >
                Cargar CSV de referencias
                <input
                  type="file" accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCSVUpload(f);
                    e.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
              <small style={{ color: "#6b7280" }}>
                Formato: Columna A = referencia; B = ASIN (opcional); C–G = 1–5 URLs por producto.
              </small>
            </div>

            <div style={{ marginTop: 12 }}>
              <small style={{ color: "#6b7280" }}>
                URLs de la referencia activa ({activeRef}):
              </small>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                {urls.map((u, i) => (
                  <Thumb
                    key={i}
                    url={u}
                    idx={i}
                    onRemove={removeUrl}
                    onPreview={(src, name) => openLightbox(src, name)}
                    selectable
                    selected={!!activeEnabled[i]}
                    onToggleSelect={setEnabledAt}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Local mode */}
        {mode === "local" && (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label
                style={{
                  border: "1px solid #e5e7eb", borderRadius: 10,
                  padding: "8px 12px", cursor: "pointer", background: "#fff",
                }}
              >
                Subir imágenes (JPG/PNG)
                <input
                  type="file" accept="image/jpeg,image/png" multiple
                  onChange={(e) => {
                    addLocalFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
              <button
                onClick={clearLocal}
                disabled={localImages.length === 0}
                style={{
                  borderRadius: 10, padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  background: "transparent",
                  color: "#374151",
                  cursor: localImages.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Limpiar imágenes
              </button>
              <small style={{ color: "#6b7280" }}>
                ({localImages.length}/6 imágenes)
              </small>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              {localImages.map((u, i) => (
                <Thumb
                  key={i}
                  url={u}
                  idx={i}
                  onRemove={removeLocal}
                  onPreview={(src) => {
                    const suggested = localNames[i] || (firstLocalBase ? `${firstLocalBase}.jpg` : undefined);
                    openLightbox(src, suggested);
                  }}
                  selectable
                  selected={!!activeEnabled[i]}
                  onToggleSelect={setEnabledAt}
                  name={localNames[i]}
                />
              ))}
            </div>
          </>
        )}

        {/* Cantidad */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <label style={{ fontWeight: 600, color: "#111827" }}>Cantidad</label>
          <input
            type="number" min={1} max={6} value={count}
            onChange={(e) => handleCountChange(e.target.value)}
            style={{
              width: 70, borderRadius: 10, padding: "8px 10px", outline: "none",
              background: "#0F1113", border: "1px solid #2a2d31", color: "#E7E9EE",
              textAlign: "center",
            }}
          />
          <small style={{ color: "#6b7280" }}>(máx. 6)</small>
        </div>

        {/* FILA: SELECTOR DE PROYECTO + DOS CAMPOS ZIP + BOTÓN ENVIAR A PROYECTO */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 12,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <select
                value={selectedProjectId || ""}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                disabled={isLoadingProjects}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "8px 30px 8px 12px",
                  minWidth: 180,
                  background: "#fff",
                  color: selectedProjectId ? "#111" : "#9ca3af",
                  fontWeight: 600,
                  cursor: "pointer",
                  appearance: "none",
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

            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <input
                key={`ref-${zipInputKey}`}
                value={zipNameRef}
                onChange={(e) => setZipNameRef(e.target.value)}
                placeholder="Nombre ZIP (Referencia)"
                style={{
                  border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 36px 8px 12px",
                  minWidth: 200,
                }}
              />
              {zipNameRef.trim() !== "" && (
                <button
                  onClick={() => { setZipNameRef(""); setZipInputKey((k) => k + 1); }}
                  title="Borrar nombre"
                  aria-label="Borrar nombre"
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    width: 22, height: 22, borderRadius: 6, border: "1px solid #e5e7eb",
                    background: "#fff", color: "#111", cursor: "pointer", lineHeight: "20px",
                    fontWeight: 800,
                  }}
                >
                  ×
                </button>
              )}
            </div>

            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <input
                key={`asin-${zipInputKey}`}
                value={zipNameAsin}
                onChange={(e) => setZipNameAsin(e.target.value)}
                placeholder="Nombre ZIP (ASIN)"
                style={{
                  border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 36px 8px 12px",
                  minWidth: 200,
                }}
              />
              {zipNameAsin.trim() !== "" && (
                <button
                  onClick={() => { setZipNameAsin(""); setZipInputKey((k) => k + 1); }}
                  title="Borrar nombre"
                  aria-label="Borrar nombre"
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    width: 22, height: 22, borderRadius: 6, border: "1px solid #e5e7eb",
                    background: "#fff", color: "#111", cursor: "pointer", lineHeight: "20px",
                    fontWeight: 800,
                  }}
                >
                  ×
                </button>
              )}
            </div>

            <button
              onClick={handleSendToProject}
              disabled={isSending || !selectedProjectId}
              style={{
                borderRadius: 10,
                padding: "8px 12px",
                background: selectedProjectId ? "#10b981" : "#e5e7eb",
                color: selectedProjectId ? "#ffffff" : "#9ca3af",
                fontWeight: 700,
                cursor: (isSending || !selectedProjectId) ? "not-allowed" : "pointer",
                border: "1px solid rgba(0,0,0,.1)",
                opacity: isSending ? 0.7 : 1,
              }}
              title={
                !selectedProjectId 
                  ? "Selecciona un proyecto primero" 
                  : isSending 
                    ? "Enviando imágenes..." 
                    : `Enviar imágenes seleccionadas al proyecto`
              }
            >
              {isSending ? "Enviando..." : "Enviar a proyecto"}
            </button>
          </div>
        </div>

        {/* FILA INFERIOR: Botones de descarga y marca finalizada */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => handleDownloadSelected(false)}
              style={{
                borderRadius: 10, padding: "8px 12px",
                background: "var(--brand-accent)", color: "var(--brand-accent-ink)",
                fontWeight: 700, cursor: "pointer",
              }}
            >
              Descargar ZIP (Referencia)
            </button>

            <button
              onClick={() => handleDownloadSelected(true)}
              disabled={!zipNameAsin.trim()}
              style={{
                borderRadius: 10, padding: "8px 12px",
                background: zipNameAsin.trim() ? "var(--brand-accent)" : "#e5e7eb",
                color: zipNameAsin.trim() ? "var(--brand-accent-ink)" : "#9ca3af",
                fontWeight: 700,
                cursor: zipNameAsin.trim() ? "pointer" : "not-allowed",
              }}
            >
              Descargar ZIP (ASIN)
            </button>
          </div>

          <button
            onClick={markCurrentAsDone}
            disabled={batch.items.length === 0}
            style={{
              borderRadius: 10, padding: "8px 12px",
              background: "#000", color: "var(--brand-accent)",
              fontWeight: 700, cursor: batch.items.length === 0 ? "not-allowed" : "pointer",
              border: "1px solid rgba(0,0,0,.1)",
            }}
            title="Marcar referencia activa como finalizada"
          >
            Marcar referencia como finalizada
          </button>
        </div>
      </div>

      {/* Grid de presets */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          gap: 16,
          marginTop: 18,
        }}
      >
        {presetsInOrder.map((p) => {
          const displayName = nameOverrides[p.id] ?? p.name;
          const promptShown = editedPrompts[p.id] ?? p.prompt;
          const imgs = (resultsByRef[activeRef] || {})[p.id] || [];
          const isLoading = loadingSet.has(p.id);
          const isCustom = p.id.startsWith("custom-");
          const refImg = customRefs[p.id];

          return (
            <div
              key={p.id}
              className="preset-card"
              draggable
              onDragStart={onDragStart(p.id)}
              onDragOver={onDragOver(p.id)}
              onDrop={onDrop(p.id)}
              onDragEnd={onDragEnd}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                overflow: "hidden",
                background: "#ffffff",
                color: "#15181C",
                boxShadow: draggingId === p.id ? "0 0 0 2px var(--brand-accent)" : "0 10px 24px rgba(0,0,0,.08)",
                opacity: draggingId === p.id ? 0.7 : 1,
                cursor: "move",
              }}
              title="Arrastra para reordenar"
            >
              {/* Viewport NEGRO */}
              <div
                className="viewport"
                style={{
                  aspectRatio: "1 / 1",
                  background: "#0b0c0e",
                  border: "1px solid var(--brand-accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--brand-accent)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {imgs.length === 0 ? (
                  <span>Sin imagen aún</span>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: imgs.length >= 2 ? "1fr 1fr" : "1fr",
                      gap: 6,
                      width: "100%",
                      height: "100%",
                      padding: 6,
                      boxSizing: "border-box",
                    }}
                  >
                    {imgs.map((im, idx) => {
                      const isPicked = isOrdered(activeRef, p.id, idx);
                      const order = getOrder(activeRef, p.id, idx);
                      const mime = im.mime || "image/png";
                      const ext =
                        mime.includes("png")
                          ? "png"
                          : mime.includes("webp")
                          ? "webp"
                          : mime.includes("gif")
                          ? "gif"
                          : "jpg";
                      const suggestedName =
                        mode === "local" && (zipNameRef.trim() || firstLocalBase.trim())
                          ? `${(zipNameRef.trim() || firstLocalBase.trim())}.${ext}`
                          : undefined;

                      return (
                        <div key={idx} style={{ position: "relative" }}>
                          <img
                            src={`data:${mime};base64,${im.base64}`}
                            alt=""
                            style={{
                              width: "100%", height: "100%",
                              maxWidth: "100%", maxHeight: "100%",
                              objectFit: "contain",
                              borderRadius: 8, display: "block",
                              cursor: "zoom-in",
                            }}
                            onClick={() =>
                              openLightbox(`data:${mime};base64,${im.base64}`, suggestedName)
                            }
                          />
                          {/* Botón de selección (asigna/quita orden) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleOrder(activeRef, p.id, idx);
                            }}
                            className="orderBadge"
                            title={
                              isPicked
                                ? `Quitar orden (${order})`
                                : "Asignar siguiente número (empieza en 0)"
                            }
                          >
                            {isPicked ? order : "✓"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bloque inferior coral */}
              <div className="coral" style={{ padding: 14, background: "var(--brand-accent)" }}>
                <div className="card-title-row" style={{ color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".04em" }}>
                    {displayName.toUpperCase()}
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => openEditPrompt(p.id)}
                    title="Editar nombre y/o prompt"
                    aria-label="Editar nombre y/o prompt"
                    style={{ background: "#ffffffa0", color: "#111" }}
                  >
                    ✎
                  </button>
                </div>

                {/* Prompt visible */}
                <div
                  className="prompt-box"
                  data-empty={promptShown ? "false" : "true"}
                  style={{
                    fontSize: 12,
                    color: "#15181C",
                    background: "#ffffff",
                    border: "1px solid rgba(0,0,0,.08)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    maxHeight: 82,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {promptShown || (p.id.startsWith("custom-") ? "Escribe tu prompt (botón ✎)" : "")}
                </div>

                {/* 🆕 Zona para imagen de referencia (solo custom-*) */}
                {isCustom && (
                  <div style={{ marginTop: 10, background: "#0b0c0e", border: "1px solid #2a2d31", borderRadius: 12, padding: 10 }}>
                    {!refImg ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                        <label
                          style={{
                            border: "1px solid #e5e7eb", borderRadius: 10,
                            padding: "8px 12px", cursor: "pointer", background: "#fff",
                            textAlign: "center", fontWeight: 700,
                          }}
                          title="Subir imagen de referencia"
                        >
                          + Añadir imagen de referencia
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              e.currentTarget.value = "";
                              addCustomRefFromFile(p.id, file);
                            }}
                            style={{ display: "none" }}
                          />
                        </label>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                          <input
                            type="text"
                            placeholder="o pega aquí una URL (https://...)"
                            style={{
                              width: "100%", borderRadius: 10, padding: "8px 10px", outline: "none",
                              background: "#0F1113", border: "1px solid #2a2d31", color: "#E7E9EE",
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const v = (e.target as HTMLInputElement).value;
                                (e.target as HTMLInputElement).value = "";
                                addCustomRefFromUrl(p.id, v);
                              }
                            }}
                          />
                          <button
                            onClick={(e) => {
                              const input = (e.currentTarget.parentElement?.querySelector("input[type='text']") as HTMLInputElement | null);
                              const v = input?.value || "";
                              if (input) input.value = "";
                              addCustomRefFromUrl(p.id, v);
                            }}
                            style={{
                              borderRadius: 10, padding: "8px 12px",
                              background: "#fff", border: "1px solid #e5e7eb", color: "#111",
                              fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            Añadir URL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 🔎 Ref abre el lightbox */}
                        <img
                          src={refImg}
                          alt="Referencia"
                          className="custom-ref-thumb"
                          title="Ampliar referencia"
                          onClick={() => openLightbox(getViewSrc(refImg))}
                          draggable={false}
                        />
                        <div className="custom-ref-actions" style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                          <button
                            className="btn danger"
                            onClick={() => removeCustomRef(p.id)}
                            title="Eliminar imagen de referencia"
                          >
                            Eliminar
                          </button>
                          <label className="btn dark" title="Reemplazar imagen">
                            Reemplazar
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                e.currentTarget.value = "";
                                addCustomRefFromFile(p.id, file);
                              }}
                              style={{ display: "none" }}
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Botón generar */}
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    onClick={() => handleGenerate(p.id)}
                    disabled={
                      activeSources.length === 0 ||
                      isLoading ||
                      (isCustom && !(editedPrompts[p.id] ?? "").trim())
                    }
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      padding: "10px 14px",
                      border: "1px solid rgba(0,0,0,.1)",
                      fontWeight: 700,
                      cursor: activeSources.length === 0 || isLoading ? "not-allowed" : "pointer",
                      background:
                        activeSources.length === 0 || isLoading ? "#1f2937" : "#000000",
                      color:
                        activeSources.length === 0 || isLoading ? "#9ca3af" : "var(--brand-accent)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {isLoading && <span className="spinner" />}
                    {isLoading ? "Generando…" : "Generar"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal edición */}
      {showModal && currentPreset && (
        <div
          onClick={closeEditPrompt}
          style={{
            position: "fixed",
            inset: 0 as unknown as number,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 92vw)",
              background: "#0d0f11",
              border: "1px solid #2a2d31",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h3 style={{ margin: "0 0 6px 0" }}>EDITAR TARJETA</h3>
            <small style={{ color: "#9aa0a6" }}>
              ID: <code>{currentPreset.id}</code>
            </small>

            {/* Campo de nombre */}
            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", fontSize: 12, color: "#C8CBD1", marginBottom: 6 }}>
                Nombre de la tarjeta
              </label>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder={currentPreset.name}
                style={{
                  width: "100%", borderRadius: 10, padding: "10px 12px",
                  outline: "none", background: "#0F1113",
                  border: "1px solid #2a2d31", color: "#E7E9EE",
                }}
              />
              <small style={{ color: "#9aa0a6" }}>
                Déjalo vacío para usar el nombre por defecto (<em>{currentPreset.name}</em>).
              </small>
            </div>

            {/* Campo de prompt */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#C8CBD1", marginBottom: 6 }}>
                Prompt
              </label>
              <textarea
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                spellCheck={false}
                style={{
                  width: "100%", minHeight: 180, resize: "vertical",
                  borderRadius: 12, padding: 12, outline: "none",
                  background: "#0F1113", border: "1px solid #2a2d31", color: "#E7E9EE",
                }}
              />
              <small style={{ color: "#9aa0a6" }}>
                Déjalo vacío para usar el prompt por defecto o escribe tu prompt para los "Custom".
              </small>
            </div>

            <div className="row" style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={closeEditPrompt}
                style={{
                  border: "1px solid #2a2d31", background: "transparent",
                  color: "#C8CBD1", borderRadius: 10, padding: "8px 12px", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={saveEditedPrompt}
                style={{
                  background: "var(--brand-accent)", color: "var(--brand-accent-ink)",
                  padding: "10px 14px", borderRadius: 10, border: "none",
                  fontWeight: 800, cursor: "pointer",
                }}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox.open && (
        <div
          onClick={closeLightbox}
          style={{
            position: "fixed",
            inset: 0 as unknown as number,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
            cursor: "zoom-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              position: "relative",
              cursor: "default",
            }}
          >
            <div style={{ position: "relative", display: "inline-block" }}>
              <img
                id="zoom-image"
                src={lightbox.src}
                alt="preview"
                style={{
                  maxWidth: "90vw", maxHeight: "90vh",
                  objectFit: "contain",
                  borderRadius: 12,
                  boxShadow: "0 20px 60px rgba(0,0,0,.5)",
                  display: "block",
                }}
              />
              <div
                id="zoom-lens"
                style={{
                  position: "absolute",
                  border: "2px solid var(--brand-accent)",
                  width: 150, height: 150,
                  pointerEvents: "none",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "200%",
                  display: "none",
                  borderRadius: 8,
                }}
              />
            </div>

            <div style={{ marginTop: 12, textAlign: "center" }}>
              <a
                href={lightbox.src}
                download={lightbox.name || undefined}
                style={{
                  marginRight: 12,
                  padding: "8px 14px",
                  background: "var(--brand-accent)",
                  color: "var(--brand-accent-ink)",
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                Descargar
              </a>
              <button
                onClick={closeLightbox}
                style={{
                  padding: "8px 14px",
                  background: "#22252A",
                  color: "#fff",
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                Cerrar (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
