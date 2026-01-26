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
   PÁGINA DE PROMPTS
   =========================== */

export default function PromptsPage() {
  // Estados
  const [folders, setFolders] = useState<Folder[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("base");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showNewPromptModal, setShowNewPromptModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  // Cargar datos de localStorage
  useEffect(() => {
    try {
      const savedFolders = localStorage.getItem("kreative-prompt-folders");
      const savedPrompts = localStorage.getItem("kreative-prompts");
      
      if (savedFolders) {
        setFolders(JSON.parse(savedFolders));
      } else {
        // Carpeta base por defecto
        const defaultFolders: Folder[] = [
          { id: "base", name: "Prompts Base", icon: "📝", isBase: true }
        ];
        setFolders(defaultFolders);
        localStorage.setItem("kreative-prompt-folders", JSON.stringify(defaultFolders));
      }
      
      if (savedPrompts) {
        setPrompts(JSON.parse(savedPrompts));
      }
    } catch (e) {
      console.error("Error cargando prompts:", e);
    }
  }, []);

  // Guardar en localStorage cuando cambian
  useEffect(() => {
    try {
      localStorage.setItem("kreative-prompt-folders", JSON.stringify(folders));
    } catch (e) {
      console.error("Error guardando carpetas:", e);
    }
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem("kreative-prompts", JSON.stringify(prompts));
    } catch (e) {
      console.error("Error guardando prompts:", e);
    }
  }, [prompts]);

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

  // Funciones
  const createPrompt = (data: Omit<Prompt, "id" | "createdAt" | "updatedAt">) => {
    const newPrompt: Prompt = {
      ...data,
      id: `prompt-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPrompts([...prompts, newPrompt]);
  };

  const updatePrompt = (id: string, data: Partial<Prompt>) => {
    setPrompts(prompts.map(p => 
      p.id === id 
        ? { ...p, ...data, updatedAt: new Date().toISOString() }
        : p
    ));
  };

  const deletePrompt = (id: string) => {
    if (confirm("¿Eliminar este prompt?")) {
      setPrompts(prompts.filter(p => p.id !== id));
    }
  };

  const toggleFavorite = (id: string) => {
    updatePrompt(id, { isFavorite: !prompts.find(p => p.id === id)?.isFavorite });
  };

  const createFolder = (name: string, icon: string) => {
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name,
      icon,
    };
    setFolders([...folders, newFolder]);
  };

  const deleteFolder = (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder?.isBase) {
      alert("No puedes eliminar la carpeta base");
      return;
    }
    
    const hasPrompts = prompts.some(p => p.folderId === id);
    if (hasPrompts) {
      if (!confirm("Esta carpeta tiene prompts. ¿Eliminar carpeta y mover prompts a Base?")) {
        return;
      }
      // Mover prompts a Base
      setPrompts(prompts.map(p => 
        p.folderId === id ? { ...p, folderId: "base" } : p
      ));
    }
    
    setFolders(folders.filter(f => f.id !== id));
    if (selectedFolderId === id) {
      setSelectedFolderId("base");
    }
  };

  const currentFolder = folders.find(f => f.id === selectedFolderId);
  const totalPrompts = prompts.length;
  const favoriteCount = prompts.filter(p => p.isFavorite).length;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb" }}>
      {/* Sidebar */}
      <aside style={{
        width: 256,
        background: "#fff",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        padding: 20,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 40,
              height: 40,
              background: "#ff6b6b",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}>
              ✨
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Kreative 360º</h2>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Prompts</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "#ff6b6b",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}>
            📝 Prompts
          </div>
          
          <div style={{
            padding: "8px 12px",
            borderRadius: 8,
            color: "#6b7280",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
          onClick={() => window.location.href = "/masivo"}
          >
            🎨 Generar imágenes
          </div>

          <div style={{
            padding: "8px 12px",
            borderRadius: 8,
            color: "#6b7280",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
          onClick={() => window.location.href = "/projects"}
          >
            📁 Proyectos
          </div>

          {/* Carpetas */}
          <div style={{ marginTop: 24 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              paddingLeft: 12,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" }}>
                Carpetas
              </span>
              <button
                onClick={() => setShowNewFolderModal(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ff6b6b",
                  cursor: "pointer",
                  fontSize: 18,
                  padding: 4,
                }}
                title="Nueva carpeta"
              >
                +
              </button>
            </div>
            
            {folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: selectedFolderId === folder.id ? "#fff1f0" : "transparent",
                  color: selectedFolderId === folder.id ? "#ff6b6b" : "#6b7280",
                  fontWeight: selectedFolderId === folder.id ? 600 : 400,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span>
                  {folder.icon} {folder.name}
                </span>
                {!folder.isBase && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFolder(folder.id);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#9ca3af",
                      cursor: "pointer",
                      padding: 2,
                      fontSize: 14,
                    }}
                    title="Eliminar carpeta"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Storage info */}
        <div style={{
          padding: 12,
          background: "#f9fafb",
          borderRadius: 8,
          fontSize: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#6b7280" }}>Prompts guardados</span>
            <span style={{ fontWeight: 600 }}>{totalPrompts}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6b7280" }}>Favoritos</span>
            <span style={{ fontWeight: 600, color: "#ff6b6b" }}>⭐ {favoriteCount}</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <header style={{
          padding: "20px 32px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                background: "#ff6b6b",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
              }}>
                {currentFolder?.icon || "📝"}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
                  {currentFolder?.name || "Prompts"}
                </h1>
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                  {filteredPrompts.length} prompts en esta carpeta
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 24 }}>{totalPrompts}</span>
                <span style={{ fontSize: 14, color: "#6b7280", alignSelf: "center" }}>Total</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 24, color: "#ff6b6b" }}>⭐ {favoriteCount}</span>
                <span style={{ fontSize: 14, color: "#6b7280", alignSelf: "center" }}>Favoritos</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: showOnlyFavorites ? "#fff1f0" : "#fff",
                color: showOnlyFavorites ? "#ff6b6b" : "#6b7280",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ⭐ Solo favoritos
            </button>

            <input
              type="text"
              placeholder="Buscar por título, contenido o tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
              }}
            />

            <button
              onClick={() => setShowNewPromptModal(true)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "#ff6b6b",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              + Nuevo prompt
            </button>
          </div>
        </header>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: "auto",
          padding: 32,
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
            }}>
              <div style={{
                width: 120,
                height: 120,
                background: "#f3f4f6",
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                marginBottom: 24,
              }}>
                ✨
              </div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                {searchQuery ? "No se encontraron prompts" : "Aún no tienes prompts"}
              </h2>
              <p style={{ margin: 0, fontSize: 16, color: "#6b7280", marginBottom: 24 }}>
                {searchQuery 
                  ? "Intenta con otra búsqueda"
                  : "Comienza creando tu primer prompt para generar imágenes increíbles con IA"
                }
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowNewPromptModal(true)}
                  style={{
                    padding: "12px 24px",
                    borderRadius: 10,
                    background: "#ff6b6b",
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  + Crear mi primer prompt
                </button>
              )}
            </div>
          ) : (
            // Grid de prompts
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}>
              {filteredPrompts.map(prompt => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onToggleFavorite={() => toggleFavorite(prompt.id)}
                  onEdit={() => setEditingPrompt(prompt)}
                  onDelete={() => deletePrompt(prompt.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal: Nuevo/Editar Prompt */}
      {(showNewPromptModal || editingPrompt) && (
        <PromptModal
          prompt={editingPrompt || undefined}
          folderId={selectedFolderId}
          folders={folders}
          onSave={(data) => {
            if (editingPrompt) {
              updatePrompt(editingPrompt.id, data);
              setEditingPrompt(null);
            } else {
              createPrompt(data);
              setShowNewPromptModal(false);
            }
          }}
          onClose={() => {
            setShowNewPromptModal(false);
            setEditingPrompt(null);
          }}
        />
      )}

      {/* Modal: Nueva Carpeta */}
      {showNewFolderModal && (
        <NewFolderModal
          onSave={(name, icon) => {
            createFolder(name, icon);
            setShowNewFolderModal(false);
          }}
          onClose={() => setShowNewFolderModal(false)}
        />
      )}
    </div>
  );
}

/* ===========================
   COMPONENTE: PromptCard
   =========================== */

function PromptCard({
  prompt,
  onToggleFavorite,
  onEdit,
  onDelete,
}: {
  prompt: Prompt;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      transition: "all 0.2s",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 107, 107, 0.1)";
      e.currentTarget.style.borderColor = "#ff6b6b";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.borderColor = "#e5e7eb";
    }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
        <h3 style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
          flex: 1,
        }}>
          {prompt.title}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          style={{
            background: "transparent",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {prompt.isFavorite ? "⭐" : "☆"}
        </button>
      </div>

      {/* Content preview */}
      <p style={{
        margin: 0,
        fontSize: 14,
        color: "#6b7280",
        lineHeight: "1.5",
        maxHeight: 60,
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
      }}>
        {prompt.content}
      </p>

      {/* Tags */}
      {prompt.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {prompt.tags.map((tag, i) => (
            <span
              key={i}
              style={{
                padding: "4px 8px",
                background: "#fff1f0",
                color: "#ff6b6b",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: "flex",
        gap: 8,
        marginTop: "auto",
        paddingTop: 12,
        borderTop: "1px solid #f3f4f6",
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#6b7280",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ✏️ Editar
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(prompt.content);
            alert("Prompt copiado al portapapeles");
          }}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#6b7280",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          📋 Copiar
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            padding: "8px",
            borderRadius: 8,
            border: "1px solid #fee2e2",
            background: "#fff",
            color: "#ef4444",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

/* ===========================
   MODAL: Nuevo/Editar Prompt
   =========================== */

function PromptModal({
  prompt,
  folderId,
  folders,
  onSave,
  onClose,
}: {
  prompt?: Prompt;
  folderId: string;
  folders: Folder[];
  onSave: (data: Omit<Prompt, "id" | "createdAt" | "updatedAt">) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(prompt?.title || "");
  const [content, setContent] = useState(prompt?.content || "");
  const [selectedFolderId, setSelectedFolderId] = useState(prompt?.folderId || folderId);
  const [tags, setTags] = useState(prompt?.tags.join(", ") || "");
  const [isFavorite, setIsFavorite] = useState(prompt?.isFavorite || false);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      alert("Completa el título y contenido");
      return;
    }

    onSave({
      title: title.trim(),
      content: content.trim(),
      folderId: selectedFolderId,
      isFavorite,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          maxWidth: 600,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 24px 0", fontSize: 24, fontWeight: 800 }}>
          {prompt ? "Editar prompt" : "Nuevo prompt"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Título */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Producto minimalista fondo blanco"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {/* Carpeta */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
              Carpeta
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
              }}
            >
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.icon} {folder.name}
                </option>
              ))}
            </select>
          </div>

          {/* Contenido */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
              Prompt
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tu prompt aquí..."
              style={{
                width: "100%",
                minHeight: 200,
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
              Tags (separados por comas)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="producto, minimalista, fondo blanco"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {/* Favorito */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              id="favorite-check"
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
            <label htmlFor="favorite-check" style={{ fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
              ⭐ Marcar como favorito
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#6b7280",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 8,
                border: "none",
                background: "#ff6b6b",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {prompt ? "Guardar cambios" : "Crear prompt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   MODAL: Nueva Carpeta
   =========================== */

function NewFolderModal({
  onSave,
  onClose,
}: {
  onSave: (name: string, icon: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");

  const iconOptions = ["📁", "🎨", "💼", "🏢", "🎯", "⭐", "🔥", "💡", "🚀", "📦"];

  const handleSave = () => {
    if (!name.trim()) {
      alert("Escribe un nombre para la carpeta");
      return;
    }
    onSave(name.trim(), icon);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          maxWidth: 400,
          width: "100%",
        }}
      >
        <h2 style={{ margin: "0 0 24px 0", fontSize: 24, fontWeight: 800 }}>
          Nueva carpeta
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Nombre */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
              Nombre de la carpeta
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Proyecto Amazon"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {/* Icono */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
              Icono
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {iconOptions.map(i => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: icon === i ? "2px solid #ff6b6b" : "1px solid #e5e7eb",
                    background: icon === i ? "#fff1f0" : "#fff",
                    fontSize: 24,
                    cursor: "pointer",
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#6b7280",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 8,
                border: "none",
                background: "#ff6b6b",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Crear carpeta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}