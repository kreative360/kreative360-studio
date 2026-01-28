"use client";

import { useState, useEffect } from "react";

/* ===========================
   TIPOS
   =========================== */

type Prompt = {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  is_favorite: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type Folder = {
  id: string;
  name: string;
  icon: string;
};

/* ===========================
   PÁGINA DE PROMPTS
   =========================== */

export default function PromptsPage() {
  // Estados
  const [folders, setFolders] = useState<Folder[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showNewPromptModal, setShowNewPromptModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [newPromptTags, setNewPromptTags] = useState("");
  const [newPromptFolder, setNewPromptFolder] = useState<string | null>(null);
  
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderIcon, setNewFolderIcon] = useState("📁");

  // 🆕 Migración automática desde localStorage
  useEffect(() => {
    checkAndMigrate();
  }, []);

  const checkAndMigrate = async () => {
    try {
      const localFolders = localStorage.getItem("kreative-prompt-folders");
      const localPrompts = localStorage.getItem("kreative-prompts");

      if (localFolders || localPrompts) {
        const migrate = confirm(
          "Tienes prompts guardados localmente.\n\n¿Quieres migrarlos a la nube?\n\nEsto permitirá acceder desde cualquier dispositivo."
        );

        if (migrate) {
          const folders = localFolders ? JSON.parse(localFolders) : [];
          const prompts = localPrompts ? JSON.parse(localPrompts) : [];

          const res = await fetch("/api/prompts/migrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folders, prompts }),
          });

          if (res.ok) {
            alert("✅ Migración completada");
            localStorage.removeItem("kreative-prompt-folders");
            localStorage.removeItem("kreative-prompts");
          }
        } else {
          localStorage.removeItem("kreative-prompt-folders");
          localStorage.removeItem("kreative-prompts");
        }
      }

      loadData();
    } catch (error) {
      console.error("Error en migración:", error);
      loadData();
    }
  };

  // Cargar datos desde Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadFolders(), loadPrompts()]);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const res = await fetch("/api/prompts/folders");
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error("Error cargando carpetas:", error);
    }
  };

  const loadPrompts = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedFolderId) params.set("folderId", selectedFolderId);
      if (showOnlyFavorites) params.set("favorites", "true");
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/prompts/list?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPrompts(data.prompts || []);
      }
    } catch (error) {
      console.error("Error cargando prompts:", error);
    }
  };

  // Recargar cuando cambian filtros
  useEffect(() => {
    if (!loading) {
      loadPrompts();
    }
  }, [selectedFolderId, showOnlyFavorites, searchQuery]);

  // Filtrar prompts localmente
  const filteredPrompts = prompts;

  // CRUD de prompts
  const createPrompt = async () => {
    if (!newPromptTitle.trim()) return;
    
    try {
      const res = await fetch("/api/prompts/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: {
            title: newPromptTitle.trim(),
            content: newPromptContent.trim(),
            folderId: newPromptFolder,
            tags: newPromptTags.split(",").map(t => t.trim()).filter(Boolean),
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Añadir el nuevo prompt al estado
        if (data.prompt) {
          setPrompts(prev => [data.prompt, ...prev]);
        }
        closeNewPromptModal();
      } else {
        alert("❌ Error creando prompt");
      }
    } catch (error) {
      console.error("Error creando prompt:", error);
      alert("❌ Error creando prompt");
    }
  };

  const deletePrompt = async (id: string) => {
    if (!confirm("¿Eliminar este prompt?")) return;

    // Actualización optimista: eliminar del estado inmediatamente
    setPrompts(prev => prev.filter(p => p.id !== id));

    try {
      const res = await fetch("/api/prompts/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          promptId: id,
        }),
      });

      const data = await res.json();
      
      if (!data.success) {
        // Si falla, recargar para restaurar el estado correcto
        await loadPrompts();
        alert("❌ Error eliminando prompt");
      }
    } catch (error) {
      console.error("Error eliminando prompt:", error);
      // Si falla, recargar para restaurar el estado correcto
      await loadPrompts();
      alert("❌ Error eliminando prompt");
    }
  };

  const toggleFavorite = async (id: string) => {
    // Actualización optimista
    setPrompts(prev => prev.map(p => 
      p.id === id ? { ...p, is_favorite: !p.is_favorite } : p
    ));

    try {
      const res = await fetch("/api/prompts/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-favorite",
          promptId: id,
        }),
      });

      const data = await res.json();
      
      if (!data.success) {
        // Si falla, recargar para restaurar
        await loadPrompts();
      }
    } catch (error) {
      console.error("Error actualizando favorito:", error);
      // Si falla, recargar para restaurar
      await loadPrompts();
    }
  };

  // CRUD de carpetas
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const res = await fetch("/api/prompts/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: {
            name: newFolderName.trim(),
            icon: newFolderIcon,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Añadir la nueva carpeta al estado
        if (data.folder) {
          setFolders(prev => [...prev, data.folder]);
        }
        closeNewFolderModal();
      } else {
        alert("❌ Error creando carpeta");
      }
    } catch (error) {
      console.error("Error creando carpeta:", error);
      alert("❌ Error creando carpeta");
    }
  };

  const deleteFolder = async (id: string) => {
    if (!confirm("¿Eliminar esta carpeta? Los prompts dentro no se eliminarán.")) return;

    // Actualización optimista
    setFolders(prev => prev.filter(f => f.id !== id));
    setPrompts(prev => prev.map(p => 
      p.folder_id === id ? { ...p, folder_id: null } : p
    ));
    if (selectedFolderId === id) {
      setSelectedFolderId(null);
    }

    try {
      const res = await fetch("/api/prompts/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          folderId: id,
        }),
      });

      const data = await res.json();
      
      if (!data.success) {
        // Si falla, recargar para restaurar
        await loadFolders();
        await loadPrompts();
        alert("❌ Error eliminando carpeta");
      }
    } catch (error) {
      console.error("Error eliminando carpeta:", error);
      // Si falla, recargar para restaurar
      await loadFolders();
      await loadPrompts();
      alert("❌ Error eliminando carpeta");
    }
  };

  // Modales
  const openNewPromptModal = () => {
    setEditingPrompt(null);
    setNewPromptTitle("");
    setNewPromptContent("");
    setNewPromptTags("");
    setNewPromptFolder(selectedFolderId);
    setShowNewPromptModal(true);
  };

  const closeNewPromptModal = () => {
    setShowNewPromptModal(false);
    setEditingPrompt(null);
    setNewPromptTitle("");
    setNewPromptContent("");
    setNewPromptTags("");
    setNewPromptFolder(null);
  };

  const openNewFolderModal = () => {
    setNewFolderName("");
    setNewFolderIcon("📁");
    setShowNewFolderModal(true);
  };

  const closeNewFolderModal = () => {
    setShowNewFolderModal(false);
    setNewFolderName("");
    setNewFolderIcon("📁");
  };

  const openEditPromptModal = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setNewPromptTitle(prompt.title);
    setNewPromptContent(prompt.content);
    setNewPromptTags(prompt.tags.join(", "));
    setNewPromptFolder(prompt.folder_id);
    setShowNewPromptModal(true);
  };

  const saveEditedPrompt = async () => {
    if (!editingPrompt) return;
    
    // Actualización optimista
    const updatedData = {
      title: newPromptTitle.trim(),
      content: newPromptContent.trim(),
      tags: newPromptTags.split(",").map(t => t.trim()).filter(Boolean),
      folder_id: newPromptFolder,
    };
    
    setPrompts(prev => prev.map(p => 
      p.id === editingPrompt.id ? { ...p, ...updatedData } : p
    ));
    
    closeNewPromptModal();
    
    try {
      const res = await fetch("/api/prompts/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          promptId: editingPrompt.id,
          data: {
            title: newPromptTitle.trim(),
            content: newPromptContent.trim(),
            tags: newPromptTags.split(",").map(t => t.trim()).filter(Boolean),
            folderId: newPromptFolder,
          },
        }),
      });

      const data = await res.json();
      
      if (!data.success) {
        // Si falla, recargar para restaurar
        await loadPrompts();
        alert("❌ Error actualizando prompt");
      }
    } catch (error) {
      console.error("Error actualizando prompt:", error);
      // Si falla, recargar para restaurar
      await loadPrompts();
      alert("❌ Error actualizando prompt");
    }
  };

  const iconOptions = ["📁", "🎨", "💼", "🏢", "🎯", "⭐", "🔥", "💡", "🚀", "📦"];

  const folderCounts = folders.map(f => ({
    ...f,
    count: prompts.filter(p => p.folder_id === f.id).length
  }));

  const uncategorizedCount = prompts.filter(p => p.folder_id === null).length;

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "#f9fafb",
      padding: "24px"
    }}>
      {/* Header */}
      <div style={{ 
        maxWidth: 1400, 
        margin: "0 auto",
        marginBottom: 32
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          marginBottom: 8
        }}>
          <div>
            <h1 style={{ 
              fontSize: 32, 
              fontWeight: 800, 
              color: "#ff6b6b",
              margin: 0,
              marginBottom: 4
            }}>
              Galería de Prompts
            </h1>
            <p style={{ 
              fontSize: 16, 
              color: "#6b7280", 
              margin: 0 
            }}>
              Kreative 360º
            </p>
          </div>

          {/* Contadores */}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>
                {prompts.length}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Total</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#ff6b6b" }}>
                ⭐ {prompts.filter(p => p.is_favorite).length}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Favoritos</div>
            </div>
          </div>
        </div>

        {/* Barra de acciones */}
        <div style={{ 
          display: "flex", 
          gap: 12, 
          alignItems: "center",
          marginBottom: 20
        }}>
          {/* Filtro favoritos */}
          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            style={{
              padding: "10px 16px",
              background: showOnlyFavorites ? "#fff7ed" : "#fff",
              border: "1px solid",
              borderColor: showOnlyFavorites ? "#ff6b6b" : "#e5e7eb",
              borderRadius: 10,
              fontWeight: 600,
              color: showOnlyFavorites ? "#ff6b6b" : "#6b7280",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ⭐ Solo favoritos
          </button>

          {/* Buscador */}
          <input
            type="text"
            placeholder="Buscar por título, contenido o tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              fontSize: 14,
              outline: "none",
            }}
          />

          {/* Botones de acción */}
          <button
            onClick={openNewFolderModal}
            style={{
              padding: "10px 16px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Nueva carpeta
          </button>

          <button
            onClick={openNewPromptModal}
            style={{
              padding: "10px 20px",
              background: "#ff6b6b",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              color: "#fff",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Nuevo prompt
          </button>
        </div>

        {/* Filtros de carpetas */}
        <div style={{ 
          display: "flex", 
          gap: 8, 
          flexWrap: "wrap",
          alignItems: "center"
        }}>
          <button
            onClick={() => setSelectedFolderId(null)}
            style={{
              padding: "8px 14px",
              background: selectedFolderId === null ? "#ff6b6b" : "#fff",
              border: "1px solid",
              borderColor: selectedFolderId === null ? "#ff6b6b" : "#e5e7eb",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              color: selectedFolderId === null ? "#fff" : "#6b7280",
              cursor: "pointer",
            }}
          >
            📋 Todos ({prompts.length})
          </button>

          <button
            onClick={() => setSelectedFolderId(null)}
            style={{
              padding: "8px 14px",
              background: selectedFolderId === null ? "#f3f4f6" : "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              color: "#6b7280",
              cursor: "pointer",
            }}
          >
            📄 Sin carpeta ({uncategorizedCount})
          </button>

          {folderCounts.map(folder => (
            <div key={folder.id} style={{ position: "relative" }}>
              <button
                onClick={() => setSelectedFolderId(folder.id)}
                style={{
                  padding: "8px 14px",
                  background: selectedFolderId === folder.id ? "#ff6b6b" : "#fff",
                  border: "1px solid",
                  borderColor: selectedFolderId === folder.id ? "#ff6b6b" : "#e5e7eb",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  color: selectedFolderId === folder.id ? "#fff" : "#6b7280",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{folder.icon}</span>
                <span>{folder.name}</span>
                <span>({folder.count})</span>
              </button>
              <button
                onClick={() => deleteFolder(folder.id)}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#ef4444",
                  color: "#fff",
                  border: "2px solid #fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Eliminar carpeta"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Grid de prompts */}
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#6b7280" }}>
            Cargando prompts...
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "80px 20px",
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✨</div>
            <h2 style={{ 
              fontSize: 24, 
              fontWeight: 700, 
              color: "#111827",
              marginBottom: 8
            }}>
              {prompts.length === 0 
                ? "Aún no tienes prompts" 
                : "No se encontraron prompts"}
            </h2>
            <p style={{ 
              fontSize: 14, 
              color: "#6b7280",
              marginBottom: 24
            }}>
              {prompts.length === 0
                ? "Comienza creando tu primer prompt para generar imágenes increíbles con IA"
                : "Intenta con otra búsqueda o filtro"}
            </p>
            {prompts.length === 0 && (
              <button
                onClick={openNewPromptModal}
                style={{
                  padding: "12px 24px",
                  background: "#ff6b6b",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                + Crear mi primer prompt
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 20,
          }}>
            {filteredPrompts.map(prompt => (
              <div
                key={prompt.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 18,
                  position: "relative",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 10px 24px rgba(0,0,0,0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* Header de la tarjeta */}
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12
                }}>
                  <h3 style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#111827",
                    margin: 0,
                    flex: 1,
                  }}>
                    {prompt.title}
                  </h3>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(prompt.id);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        fontSize: 20,
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      {prompt.is_favorite ? "⭐" : "☆"}
                    </button>
                  </div>
                </div>

                {/* Contenido del prompt */}
                <p style={{
                  fontSize: 13,
                  color: "#6b7280",
                  lineHeight: 1.6,
                  margin: "0 0 12px 0",
                  maxHeight: 80,
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
                  <div style={{ 
                    display: "flex", 
                    gap: 6, 
                    flexWrap: "wrap",
                    marginBottom: 12
                  }}>
                    {prompt.tags.map(tag => (
                      <span
                        key={tag}
                        style={{
                          padding: "4px 10px",
                          background: "#f3f4f6",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#6b7280",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Carpeta */}
                {prompt.folder_id && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{
                      padding: "4px 10px",
                      background: "#fff0f0",
                      border: "1px solid #ffd6d6",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#ff6b6b",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}>
                      {folders.find(f => f.id === prompt.folder_id)?.icon}
                      {folders.find(f => f.id === prompt.folder_id)?.name}
                    </span>
                  </div>
                )}

                {/* Acciones */}
                <div style={{ 
                  display: "flex", 
                  gap: 8,
                  paddingTop: 12,
                  borderTop: "1px solid #f3f4f6"
                }}>
                  <button
                    onClick={() => openEditPromptModal(prompt)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      color: "#374151",
                      cursor: "pointer",
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => deletePrompt(prompt.id)}
                    style={{
                      padding: "8px 12px",
                      background: "#fff",
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Nuevo/Editar Prompt */}
      {showNewPromptModal && (
        <div
          onClick={closeNewPromptModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 600,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <h2 style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: "#111827",
              marginBottom: 20
            }}>
              {editingPrompt ? "Editar prompt" : "Nuevo prompt"}
            </h2>

            {/* Título */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ 
                display: "block", 
                fontSize: 13, 
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6
              }}>
                Título
              </label>
              <input
                type="text"
                value={newPromptTitle}
                onChange={(e) => setNewPromptTitle(e.target.value)}
                placeholder="Ej: Producto minimalista fondo blanco"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {/* Contenido */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ 
                display: "block", 
                fontSize: 13, 
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6
              }}>
                Prompt
              </label>
              <textarea
                value={newPromptContent}
                onChange={(e) => setNewPromptContent(e.target.value)}
                placeholder="Escribe tu prompt aquí..."
                style={{
                  width: "100%",
                  minHeight: 150,
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                }}
              />
            </div>

            {/* Carpeta */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ 
                display: "block", 
                fontSize: 13, 
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6
              }}>
                Carpeta (opcional)
              </label>
              <select
                value={newPromptFolder || ""}
                onChange={(e) => setNewPromptFolder(e.target.value || null)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Sin carpeta</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.icon} {folder.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: "block", 
                fontSize: 13, 
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6
              }}>
                Tags (separados por comas)
              </label>
              <input
                type="text"
                value={newPromptTags}
                onChange={(e) => setNewPromptTags(e.target.value)}
                placeholder="Ej: ecommerce, minimalista, producto"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {/* Botones */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={closeNewPromptModal}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  fontWeight: 600,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={editingPrompt ? saveEditedPrompt : createPrompt}
                disabled={!newPromptTitle.trim()}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: newPromptTitle.trim() ? "#ff6b6b" : "#e5e7eb",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: newPromptTitle.trim() ? "pointer" : "not-allowed",
                }}
              >
                {editingPrompt ? "Guardar cambios" : "Crear prompt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nueva Carpeta */}
      {showNewFolderModal && (
        <div
          onClick={closeNewFolderModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: "100%",
            }}
          >
            <h2 style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: "#111827",
              marginBottom: 20
            }}>
              Nueva carpeta
            </h2>

            {/* Nombre */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ 
                display: "block", 
                fontSize: 13, 
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6
              }}>
                Nombre
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ej: Prompts de Amazon"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {/* Icono */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: "block", 
                fontSize: 13, 
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6
              }}>
                Icono
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {iconOptions.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewFolderIcon(icon)}
                    style={{
                      width: 44,
                      height: 44,
                      fontSize: 24,
                      background: newFolderIcon === icon ? "#fff0f0" : "#f9fafb",
                      border: "2px solid",
                      borderColor: newFolderIcon === icon ? "#ff6b6b" : "#e5e7eb",
                      borderRadius: 10,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={closeNewFolderModal}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  fontWeight: 600,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: newFolderName.trim() ? "#ff6b6b" : "#e5e7eb",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: newFolderName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Crear carpeta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div style={{ 
        maxWidth: 1400, 
        margin: "40px auto 0",
        padding: "20px 0",
        borderTop: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
        color: "#9ca3af"
      }}>
        <div>
          Prompts guardados: {prompts.length} | Favoritos: {prompts.filter(p => p.is_favorite).length}
        </div>
        <div>
          © 2025 Kreative 360º
        </div>
      </div>
    </div>
  );
}