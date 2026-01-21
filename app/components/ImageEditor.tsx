"use client";

import { useState, useRef, useEffect } from "react";

type ImageEditorProps = {
  imageUrl: string;
  onSave: (editedImageBase64: string) => void;
  onCancel: () => void;
};

export default function ImageEditor({ imageUrl, onSave, onCancel }: ImageEditorProps) {
  const [editPrompt, setEditPrompt] = useState("");
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);

    const loadImage = async () => {
      try {
        let imageDataUrl = imageUrl;

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

        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
          console.log("✅ Imagen cargada:", img.width, "x", img.height);
          setOriginalImage(img);
          
          requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            const maskCanvas = maskCanvasRef.current;
            
            if (!canvas || !maskCanvas) {
              console.error("❌ Canvas ref no disponible");
              setLoadError("Error: Canvas no disponible");
              setIsLoading(false);
              return;
            }
            
            const maxSize = 900;
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
            
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            const maskCtx = maskCanvas.getContext("2d");
            
            if (!ctx || !maskCtx) {
              console.error("❌ No se pudo obtener contexto del canvas");
              setLoadError("Error: No se pudo inicializar canvas");
              setIsLoading(false);
              return;
            }
            
            // Dibujar imagen en canvas temporal para procesarla
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            
            if (!tempCtx) {
              setLoadError("Error: No se pudo crear canvas temporal");
              setIsLoading(false);
              return;
            }
            
            // Dibujar imagen original
            tempCtx.drawImage(img, 0, 0, width, height);
            
            // 🔧 SOLUCIÓN DEFINITIVA: Reemplazar píxeles grises por blancos
            const imageData = tempCtx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              
              // Detectar grises (cuando R, G, B son similares y están en rango gris)
              const isGray = Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10;
              const isInGrayRange = r > 100 && r < 200; // Rango típico de grises
              
              if (isGray && isInGrayRange) {
                // Convertir a blanco
                data[i] = 255;     // R
                data[i + 1] = 255; // G
                data[i + 2] = 255; // B
                // Alpha se mantiene igual
              }
            }
            
            // Pintar fondo blanco en canvas principal
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
            
            // Dibujar imagen procesada (con grises convertidos a blanco)
            tempCtx.putImageData(imageData, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0);
            
            console.log("🎨 Imagen procesada y dibujada con fondo blanco");
            
            // 🔧 CORRECCIÓN: Máscara transparente inicial (no negra)
            maskCtx.clearRect(0, 0, width, height);
            console.log("🎭 Máscara inicializada (transparente)");
            
            setIsLoading(false);
          });
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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const rect = maskCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * maskCanvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * maskCanvas.height;
    
    const ctx = maskCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ff6b6b";
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
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
  };

  const hasPaintedArea = (): boolean => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return false;
    
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return false;
    
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
        return true;
      }
    }
    
    return false;
  };

  const handleApply = async () => {
    if (!editPrompt.trim()) {
      alert("Escribe instrucciones para la edición");
      return;
    }

    setIsProcessing(true);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas no disponible");
      
      const imageBase64 = canvas.toDataURL("image/jpeg", 1.0).split(",")[1];
      
      const isLocalEdit = hasPaintedArea();
      
      let apiEndpoint: string;
      let bodyData: any;

      if (isLocalEdit) {
        console.log("🎨 Edición LOCAL detectada");
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas) throw new Error("Mask canvas no disponible");
        
        const maskBase64 = maskCanvas.toDataURL("image/png").split(",")[1];
        
        apiEndpoint = "/api/edit-image-local";
        bodyData = {
          imageBase64,
          maskBase64,
          editPrompt,
          width: canvas.width,
          height: canvas.height,
        };
      } else {
        console.log("🌍 Edición GLOBAL detectada");
        apiEndpoint = "/api/edit-image-global";
        bodyData = {
          imageBase64,
          editPrompt,
          width: canvas.width,
          height: canvas.height,
        };
      }

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error editando imagen");
      }

      console.log("✅ Imagen editada correctamente");
      onSave(data.image.base64);

    } catch (error: any) {
      console.error("❌ Error editando:", error);
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
        background: "rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "95vw",
          maxWidth: 1400,
          height: "95vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e5e5e5",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#333" }}>
            Editar imagen
          </h3>
          <button
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              padding: 4,
              color: "#666",
            }}
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Lado izquierdo - Canvas */}
          <div
            style={{
              flex: "0 0 70%",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Canvas container */}
            <div
              style={{
                flex: 1,
                position: "relative",
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                overflow: "hidden",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
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
                  display: isLoading || loadError ? "none" : "block",
                }}
              />
              
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
                  pointerEvents: isLoading || loadError ? "none" : "auto",
                }}
              />

              {isLoading && (
                <div style={{ textAlign: "center", zIndex: 10, color: "#666" }}>
                  ⏳ Cargando imagen...
                </div>
              )}
              
              {loadError && (
                <div style={{ color: "#ef4444", textAlign: "center", padding: 20, zIndex: 10 }}>
                  <div style={{ marginBottom: 16 }}>❌ {loadError}</div>
                </div>
              )}
            </div>

            {/* Barra de herramientas inferior */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "12px 16px",
                background: "#f5f5f5",
                borderRadius: 8,
              }}
            >
              <button
                style={{
                  padding: "8px 16px",
                  background: "#ff5a5f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ✏️ Pincel
              </button>

              <button
                onClick={clearMask}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: "#666",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                🔄 Borrador
              </button>

              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#666" }}>Tamaño</span>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, color: "#666", minWidth: 30 }}>{brushSize}</span>
              </div>

              <button
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  color: "#666",
                }}
              >
                🔄
              </button>
            </div>
          </div>

          {/* Lado derecho - Instrucciones */}
          <div
            style={{
              flex: "0 0 30%",
              padding: 24,
              background: "#fef6f5",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>
                Instrucciones
              </p>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Describe los cambios que quieres hacer...

Ejemplo: 'Cambia el color del producto a azul'"
                style={{
                  width: "100%",
                  height: 150,
                  padding: 12,
                  background: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "inherit",
                  resize: "none",
                  color: "#333",
                }}
                maxLength={500}
              />
              <p style={{ fontSize: 11, color: "#999", textAlign: "right", margin: "8px 0 0 0" }}>
                {editPrompt.length}/500
              </p>
            </div>

            <div style={{ flex: 1 }} />

            {/* Botones */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={onCancel}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "transparent",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#666",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                disabled={isProcessing || isLoading}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: isProcessing || isLoading ? "#ccc" : "#ff5a5f",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isProcessing || isLoading ? "not-allowed" : "pointer",
                }}
              >
                {isProcessing ? "Generando..." : "Generar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}