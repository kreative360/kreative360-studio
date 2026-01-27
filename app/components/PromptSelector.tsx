"use client";

import { useState, useEffect } from "react";

/* ===========================
   TIPOS
   =========================== */

type Prompt = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  isFavorite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type Folder = {
  id: string;
  name: string;
  icon: string;
};

/* ===========================
   MODAL DE SELECCIÓN DE PROMPTS
   =========================== */

export default function PromptSelector({
  onSelect,
  onClose,
  currentPrompt = "",
}: {
  onSelect: (data: { title: string; content: string }) => void; // 🆕 Ahora pasa título y contenido
  onClose: () => void;
  currentPrompt?: string;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Cargar datos
  useEffect(() => {
    try {
      const savedFolders = localStorage.getItem("kreative-prompt-folders");
      const savedPrompts = localStorage.getItem("kreative-prompts");
      
      if (savedFolders) {
        setFolders(JSON.parse(savedFolders));
      }
      
      if (savedPrompts) {
        setPrompts(JSON.parse(savedPrompts));
      }
    } catch (e) {
      console.error("Error cargando prompts:", e);
    }
  }, []);

  // Filtrar prompts
  const filteredPrompts = prompts.filter(p => {
    const matchesFolder = selectedFolderId === null || p.folderId === selectedFolderId;
    const matchesFavorite = !showOnlyFavorites || p.isFavorite;
    const matchesSearch = !searchQuery || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesFolder && matchesFavorite && matchesSearch;
  });

  // Guardar prompt actual
  const handleSaveCurrentPrompt = () => {
    if (!currentPrompt.trim()) {
      alert("El prompt actual está vacío");
      return;
    }

    const title = window.prompt("Nombre del prompt:", "Mi Prompt");
    if (!title) return;

    const newPrompt: Prompt = {
      id: `prompt-${Date.now()}`,
      title: title.trim(),
      content: currentPrompt,
      folderId: selectedFolderId,
      isFavorite: false,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [...prompts, newPrompt];
    setPrompts(updated);
    localStorage.setItem("kreative-prompts", JSON.stringify(updated));
    alert("✅ Prompt guardado en la galería");
  };

  const folderCounts = folders.map(f => ({
    ...f,
    count: prompts.filter(p => p.folderId === f.id).length
  }));

  const uncategorizedCount = prompts.filter(p => p.folderId === null).length;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 900,
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: "20px 24px",
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: 20, 
              fontWeight: 700,
              color: "#ff6b6b"
            }}>
              📋 Galería de Prompts
            </h2>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#6b7280",
                fontSize: 20,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>

          {/* Barra de búsqueda y acciones */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              style={{
                padding: "8px 12px",
                background: showOnlyFavorites ? "#fff7ed" : "#fff",
                border: "1px solid",
                borderColor: showOnlyFavorites ? "#ff6b6b" : "#e5e7eb",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: showOnlyFavorites ? "#ff6b6b" : "#6b7280",
                cursor: "pointer",
              }}
            >
              ⭐ Favoritos
            </button>

            <input
              type="text"
              placeholder="Buscar por título, contenido o tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
              }}
            />

            <button
              onClick={handleSaveCurrentPrompt}
              style={{
                padding: "8px 12px",
                background: "#10b981",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              💾 Guardar actual
            </button>
          </div>

          {/* Filtros de carpetas */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setSelectedFolderId(null)}
              style={{
                padding: "6px 12px",
                background: selectedFolderId === null ? "#ff6b6b" : "#fff",
                border: "1px solid",
                borderColor: selectedFolderId === null ? "#ff6b6b" : "#e5e7eb",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: selectedFolderId === null ? "#fff" : "#6b7280",
                cursor: "pointer",
              }}
            >
              📋 Todos ({prompts.length})
            </button>

            <button
              onClick={() => setSelectedFolderId(null)}
              style={{
                padding: "6px 12px",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#6b7280",
                cursor: "pointer",
              }}
            >
              📄 Sin carpeta ({uncategorizedCount})
            </button>

            {folderCounts.map(folder => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                style={{
                  padding: "6px 12px",
                  background: selectedFolderId === folder.id ? "#ff6b6b" : "#fff",
                  border: "1px solid",
                  borderColor: selectedFolderId === folder.id ? "#ff6b6b" : "#e5e7eb",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: selectedFolderId === folder.id ? "#fff" : "#6b7280",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>{folder.icon}</span>
                <span>{folder.name}</span>
                <span>({folder.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista de prompts */}
        <div style={{ 
          flex: 1,
          overflow: "auto",
          padding: "16px 24px"
        }}>
          {filteredPrompts.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "#9ca3af"
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
              <p style={{ margin: 0, fontSize: 14 }}>
                {prompts.length === 0 
                  ? "No hay prompts guardados. Guarda el prompt actual para empezar."
                  : "No se encontraron prompts con estos filtros."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredPrompts.map(prompt => (
                <div
                  key={prompt.id}
                  onClick={() => onSelect({ title: prompt.title, content: prompt.content })} // 🆕 Envía título y contenido
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 14,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fff0f0";
                    e.currentTarget.style.borderColor = "#ff6b6b";
                    e.currentTarget.style.transform = "translateX(4px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f9fafb";
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#111827",
                    }}>
                      {prompt.title}
                    </h3>
                    {prompt.isFavorite && (
                      <span style={{ fontSize: 16 }}>⭐</span>
                    )}
                  </div>

                  <p style={{
                    margin: "0 0 8px 0",
                    fontSize: 12,
                    color: "#6b7280",
                    lineHeight: 1.5,
                    maxHeight: 60,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                  }}>
                    {prompt.content}
                  </p>

                  {prompt.tags.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {prompt.tags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            padding: "2px 8px",
                            background: "#e0e7ff",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#4f46e5",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid #e5e7eb",
          background: "#f9fafb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <small style={{ color: "#9ca3af", fontSize: 12 }}>
            Haz clic en un prompt para aplicarlo
          </small>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}