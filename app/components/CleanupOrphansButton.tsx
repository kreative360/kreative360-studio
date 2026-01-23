"use client";

import { useState } from "react";

export default function CleanupOrphansButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      validImages: number;
      orphanedFiles: number;
      deletedFiles: number;
    };
    deletedFiles?: string[];
  } | null>(null);

  const handleCleanup = async () => {
    if (!confirm("¿Estás seguro de ejecutar la limpieza de archivos huérfanos?\n\nEsto eliminará PERMANENTEMENTE archivos del Storage que no tengan registro en la base de datos.")) {
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/cleanup-orphans", {
        method: "POST",
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        alert(`✅ ${data.message}`);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error: any) {
      console.error("Error ejecutando limpieza:", error);
      alert("❌ Error ejecutando limpieza: " + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: 800, margin: "0 auto" }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
          🧹 Limpieza de Archivos Huérfanos
        </h2>

        <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
          Esta herramienta elimina archivos del Storage que ya no tienen registro en la base de datos.
          <br />
          <strong>Útil cuando:</strong>
        </p>

        <ul style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
          <li>Eliminaste imágenes de la BD pero los archivos siguen en Storage</li>
          <li>Hay archivos de pruebas anteriores</li>
          <li>Quieres liberar espacio en Supabase</li>
        </ul>

        <button
          onClick={handleCleanup}
          disabled={isRunning}
          style={{
            padding: "12px 24px",
            background: isRunning ? "#999" : "#ff6b6b",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: isRunning ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {isRunning ? (
            <>
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid #fff",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }}
              />
              Ejecutando limpieza...
            </>
          ) : (
            <>🧹 Ejecutar Limpieza</>
          )}
        </button>

        {result && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: result.success ? "#f0fdf4" : "#fef2f2",
              borderRadius: 8,
              border: `1px solid ${result.success ? "#86efac" : "#fca5a5"}`,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
                color: result.success ? "#16a34a" : "#dc2626",
              }}
            >
              {result.success ? "✅ Limpieza Completada" : "❌ Error"}
            </h3>

            <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
              {result.message}
            </p>

            {result.stats && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    padding: 12,
                    borderRadius: 6,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>
                    {result.stats.validImages}
                  </div>
                  <div style={{ fontSize: 11, color: "#666" }}>Imágenes en BD</div>
                </div>

                <div
                  style={{
                    background: "#fff",
                    padding: 12,
                    borderRadius: 6,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>
                    {result.stats.orphanedFiles}
                  </div>
                  <div style={{ fontSize: 11, color: "#666" }}>Huérfanos encontrados</div>
                </div>

                <div
                  style={{
                    background: "#fff",
                    padding: 12,
                    borderRadius: 6,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>
                    {result.stats.deletedFiles}
                  </div>
                  <div style={{ fontSize: 11, color: "#666" }}>Archivos eliminados</div>
                </div>
              </div>
            )}

            {result.deletedFiles && result.deletedFiles.length > 0 && (
              <details style={{ marginTop: 16 }}>
                <summary
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#666",
                    cursor: "pointer",
                  }}
                >
                  Ver archivos eliminados ({result.deletedFiles.length})
                </summary>
                <ul
                  style={{
                    fontSize: 11,
                    color: "#666",
                    marginTop: 8,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {result.deletedFiles.map((file, idx) => (
                    <li key={idx}>{file}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}