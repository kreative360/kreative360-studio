"use client";

import { useState, useEffect } from "react";

/* ===========================
   TIPOS
   =========================== */

type Prompt = {
  id: string;
  title: string;
  content: string;
  folderId: string;
  isFavorite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type Folder = {
  id: string;
  name: string;
  icon: string;
  isBase?: boolean;
};

/* ===========================
   MODAL DE SELECCIÓN DE PROMPTS
   =========================== */

export default function PromptSelector({
  onSelect,
  onClose,
  currentPrompt = "",
}: {
  onSelect: (prompt: string) => void;
  onClose: () => void;
  currentPrompt?: string;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("base");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Cargar datos
  useEffect(() => {
    try {
      const savedFolders = localStorage.getItem("kreative-prompt-folders");
      const savedPrompts = localStorage.getItem("kreative-prompts");
      
      if (savedFolders) {
        setFolders(JSON.parse(savedFolders));
      } else {
        const defaultFolders: Folder[] = [
          { id: "base", name: "Prompts Base", icon: "📝", isBase: true }
        ];
        setFolders(defaultFolders);
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
    const matchesFolder = p.folderId === selectedFolderId;
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

    const updatedPrompts = [...prompts, newPrompt];
    setPrompts(updatedPrompts);
    
    try {
      localStorage.setItem("kreative-prompts", JSON.stringify(updatedPrompts));
      alert("✅ Prompt guardado correctamente");
    } catch (e) {
      console.error("Error guardando prompt:", e);
      alert("❌ Error guardando el prompt");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "min(1000px, 95vw)",
          height: "min(700px, 90vh)",
          display: "flex",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        {/* Sidebar */}
        <aside style={{
          width: 240,
          background: "#f9fafb",
          borderRight: "1px solid #e5e7eb",
          padding: 20,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                background: "#ff6b6b",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}>
                ✨
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Mis Prompts</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{prompts.length} guardados</div>
              </div>
            </div>
          </div>

          {/* Favoritos */}
          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: showOnlyFavorites ? "#fff1f0" : "#fff",
              color: showOnlyFavorites ? "#ff6b6b" : "#6b7280",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: 16,
            }}
          >
            ⭐ Solo favoritos
          </button>

          {/* Carpetas */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#9ca3af",
              marginBottom: 8,
              textTransform: "uppercase",
            }}>
              Carpetas
            </div>
            
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: selectedFolderId === folder.id ? "#fff1f0" : "transparent",
                  color: selectedFolderId === folder.id ? "#ff6b6b" : "#6b7280",
                  fontWeight: selectedFolderId === folder.id ? 600 : 400,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                  textAlign: "left",
                }}
              >
                <span>{folder.icon}</span>
                <span style={{ flex: 1 }}>{folder.name}</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {prompts.filter(p => p.folderId === folder.id).length}
                </span>
              </button>
            ))}
          </div>

          {/* Link a página de prompts */}
          <button
            onClick={() => window.location.href = "/prompts"}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#6b7280",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              marginTop: 16,
            }}
          >
            📝 Gestionar prompts
          </button>

          {/* Cerrar */}
          <button
            onClick={onClose}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#6b7280",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Cerrar
          </button>
        </aside>

        {/* Main */}
        <main style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
          <header style={{
            padding: 20,
            borderBottom: "1px solid #e5e7eb",
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Buscar prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              {currentPrompt && (
                <button
                  onClick={handleSaveCurrentPrompt}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  💾 Guardar prompt actual
                </button>
              )}
            </div>
          </header>

          {/* Content */}
          <div style={{
            flex: 1,
            overflow: "auto",
            padding: 20,
          }}>
            {filteredPrompts.length === 0 ? (
              // Empty state
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                textAlign: "center",
                color: "#9ca3af",
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#374151" }}>
                  {searchQuery ? "No se encontraron prompts" : "Aún no tienes prompts"}
                </h3>
                <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
                  {searchQuery
                    ? "Intenta con otra búsqueda"
                    : "Ve a la página de Prompts para crear tu primer prompt"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => window.location.href = "/prompts"}
                    style={{
                      marginTop: 20,
                      padding: "10px 20px",
                      borderRadius: 8,
                      background: "#ff6b6b",
                      color: "#fff",
                      border: "none",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Ir a Prompts
                  </button>
                )}
              </div>
            ) : (
              // Grid
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}>
                {filteredPrompts.map(prompt => (
                  <div
                    key={prompt.id}
                    onClick={() => {
                      onSelect(prompt.content);
                      onClose();
                    }}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 16,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 107, 107, 0.15)";
                      e.currentTarget.style.borderColor = "#ff6b6b";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      display: "flex",
                      alignItems: "start",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#111827",
                        flex: 1,
                      }}>
                        {prompt.title}
                      </h4>
                      {prompt.isFavorite && (
                        <span style={{ fontSize: 16 }}>⭐</span>
                      )}
                    </div>

                    {/* Content */}
                    <p style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#6b7280",
                      lineHeight: "1.4",
                      maxHeight: 48,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}>
                      {prompt.content}
                    </p>

                    {/* Tags */}
                    {prompt.tags.length > 0 && (
                      <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        marginTop: 8,
                      }}>
                        {prompt.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            style={{
                              padding: "2px 6px",
                              background: "#fff1f0",
                              color: "#ff6b6b",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action hint */}
                    <div style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "1px solid #f3f4f6",
                      fontSize: 12,
                      color: "#ff6b6b",
                      fontWeight: 600,
                    }}>
                      Clic para usar →
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}