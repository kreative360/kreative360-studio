"use client";

import { useState, useRef, useEffect } from "react";

type ImageEditorProps = {
  imageUrl: string;
  onSave: (editedImageBase64: string) => void;
  onCancel: () => void;
};

export default function ImageEditor({ imageUrl, onSave, onCancel }: ImageEditorProps) {
  const [editMode, setEditMode] = useState<"global" | "local">("global");
  const [editPrompt, setEditPrompt] = useState("");
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);

  // Cargar imagen original (convierte URL a base64 via proxy)
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);

    const loadImage = async () => {
      try {
        let imageDataUrl = imageUrl;

        // Si NO es base64, convertir via proxy
        if (!imageUrl.startsWith("data:")) {
          console.log("📡 Descargando imagen via proxy...");
          const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`);
          
          if (!response.ok) {
            throw new Error("Error descargando imagen");
          }

          const blob = await response.blob();
          imageDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          console.log("✅ Imagen convertida a base64");
        }

        // Cargar imagen en elemento Image
        const img = new Image();
        
        img.onload = () => {
          console.log("✅ Imagen cargada en canvas:", img.width, "x", img.height);
          setOriginalImage(img);
          
          const canvas = canvasRef.current;
          const maskCanvas = maskCanvasRef.current;
          
          if (canvas && maskCanvas) {
            const maxSize = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize || height > maxSize) {
              const ratio = Math.min(maxSize / width, maxSize / height);
              width = width * ratio;
              height = height * ratio;
            }
            
            console.log("📐 Dimensiones canvas:", width, "x", height);
            
            canvas.width = width;
            canvas.height = height;
            maskCanvas.width = width;
            maskCanvas.height = height;
            
            const ctx = canvas.getContext("2d");
            const maskCtx = maskCanvas.getContext("2d");
            
            if (ctx && maskCtx) {
              ctx.drawImage(img, 0, 0, width, height);
              console.log("🎨 Imagen dibujada en canvas");
              
              maskCtx.fillStyle = "black";
              maskCtx.fillRect(0, 0, width, height);
              console.log("🎭 Máscara inicializada");
            } else {
              console.error("❌ No se pudo obtener contexto del canvas");
            }
          } else {
            console.error("❌ Canvas ref no disponible");
          }
          
          setIsLoading(false);
        };
        
        img.onerror = () => {
          throw new Error("Error al cargar imagen en canvas");
        };
        
        img.src = imageDataUrl;

      } catch (error: any) {
        console.error("❌ Error:", error);
        setLoadError(error.message || "Error al cargar la imagen");
        setIsLoading(false);
      }
    };

    loadImage();
  }, [imageUrl]);

  // Funciones de dibujo
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode === "global") return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || editMode === "global") return;
    
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const rect = maskCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * maskCanvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * maskCanvas.height;
    
    const ctx = maskCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
  };

  const handleApply = async () => {
    if (!editPrompt.trim()) {
      alert("Escribe instrucciones para la edición");
      return;
    }

    setIsProcessing(true);

    try {
      // Obtener imagen original en base64
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas no disponible");
      
      const imageBase64 = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
      
      // Obtener máscara en base64 (solo si es modo local)
      let maskBase64 = null;
      if (editMode === "local") {
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas) throw new Error("Mask canvas no disponible");
        maskBase64 = maskCanvas.toDataURL("image/png").split(",")[1];
      }

      console.log("🎨 Enviando edición:", {
        mode: editMode,
        hasMask: !!maskBase64,
        prompt: editPrompt,
      });

      // Llamar a la API de edición
      const response = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          maskBase64,
          editPrompt,
          editMode,
          width: canvas.width,
          height: canvas.height,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error editando imagen");
      }

      // Devolver imagen editada
      onSave(data.image.base64);

    } catch (error: any) {
      console.error("Error editando:", error);
      alert("❌ Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 16,
          padding: 24,
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          gap: 20,
          color: "#fff",
        }}
      >
        {/* Panel Izquierdo - Herramientas */}
        <div
          style={{
            width: 200,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18 }}>✏️ Editor</h3>

          {/* Modo de Edición */}
          <div>
            <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Modo:</p>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
              <input
                type="radio"
                checked={editMode === "global"}
                onChange={() => setEditMode("global")}
              />
              <span style={{ fontSize: 14 }}>🌍 Global</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                checked={editMode === "local"}
                onChange={() => setEditMode("local")}
              />
              <span style={{ fontSize: 14 }}>🎨 Local (Pincel)</span>
            </label>
          </div>

          {/* Herramientas de Pincel */}
          {editMode === "local" && (
            <>
              <div>
                <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                  Tamaño Pincel: {brushSize}px
                </p>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <button
                onClick={clearMask}
                style={{
                  padding: "8px 16px",
                  background: "#ef4444",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                🗑️ Limpiar Máscara
              </button>
            </>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={onCancel}
            style={{
              padding: "10px",
              background: "#333",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>

        {/* Panel Central - Canvas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              position: "relative",
              width: 600,
              height: 600,
              border: "2px solid #333",
              borderRadius: 12,
              overflow: "hidden",
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isLoading && (
              <div style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>
                <div style={{ marginBottom: 16 }}>⏳ Cargando imagen...</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Esto puede tardar unos segundos
                </div>
              </div>
            )}
            
            {loadError && (
              <div style={{ color: "#ef4444", fontSize: 14, textAlign: "center", padding: 20 }}>
                <div style={{ marginBottom: 16 }}>❌ {loadError}</div>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: "8px 16px",
                    background: "#3b82f6",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  🔄 Reintentar
                </button>
              </div>
            )}
            
            {!isLoading && !loadError && (
              <>
                {/* Canvas de imagen */}
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                  }}
                />
                
                {/* Canvas de máscara (solo visible en modo local) */}
                {editMode === "local" && (
                  <canvas
                    ref={maskCanvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      cursor: "crosshair",
                      opacity: 0.5,
                      mixBlendMode: "screen",
                    }}
                  />
                )}
              </>
            )}
          </div>

          {/* Instrucciones */}
          <div>
            <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
              Instrucciones de edición:
            </p>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder={
                editMode === "global"
                  ? "Ej: Cambia la pared de blanco a gris"
                  : "Ej: Añade una planta decorativa"
              }
              style={{
                width: "100%",
                height: 80,
                padding: 12,
                background: "#2a2a2a",
                border: "1px solid #444",
                borderRadius: 8,
                color: "#fff",
                fontSize: 14,
                fontFamily: "inherit",
                resize: "none",
              }}
            />
          </div>

          <button
            onClick={handleApply}
            disabled={isProcessing || isLoading}
            style={{
              padding: "12px 24px",
              background: isProcessing || isLoading ? "#666" : "#3b82f6",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: isProcessing || isLoading ? "not-allowed" : "pointer",
              opacity: isProcessing || isLoading ? 0.5 : 1,
            }}
          >
            {isProcessing ? "⏳ Editando..." : "✨ Aplicar Edición"}
          </button>
        </div>
      </div>
    </div>
  );
}