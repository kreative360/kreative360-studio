"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  created_at: string;
  updated_at: string;
};

/* ===========================
   PÁGINA PRINCIPAL
   =========================== */

export default function PromptsPage() {
  const router = useRouter();

  // Estados
  const [folders, setFolders] = useState<Folder[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [loading, setLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  // Modal estados
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);

  // Form estados
  const [promptTitle, setPromptTitle] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [promptFolderId, setPromptFolderId] = useState<string | null>(null);
  const [promptTags, setPromptTags] = useState<string[]>([]);

  const [folderName, setFolderName] = useState("");
  const [folderIcon, setFolderIcon] = useState("📁");

  /* ====== MIGRACIÓN DESDE LOCALSTORAGE ====== */
  useEffect(() => {
    checkAndMigrateLocalStorage();
  }, []);

  const checkAndMigrateLocalStorage = async () => {
    try {
      const localFolders = localStorage.getItem("kreative-prompt-folders");
      const localPrompts = localStorage.getItem("kreative-prompts");

      if (!localFolders && !localPrompts) {
        return; // No hay nada que migrar
      }

      // Verificar si ya hay datos en Supabase
      const hasSupabaseData = await checkSupabaseData();

      if (hasSupabaseData) {
        // Ya hay datos en Supabase, ofrecer mantener o sobrescribir
        const migrate = confirm(
          "Tienes prompts guardados en tu navegador.\n\n" +
          "¿Quieres migrarlos a la nube?\n\n" +
          "Esto permitirá que tus prompts estén disponibles desde cualquier dispositivo."
        );

        if (!migrate) {
          // Limpiar localStorage para no volver a preguntar
          localStorage.removeItem("kreative-prompt-folders");
          localStorage.removeItem("kreative-prompts");
          return;
        }
      }

      setMigrationStatus("Migrando prompts a la nube...");

      const folders = localFolders ? JSON.parse(localFolders) : [];
      const prompts = localPrompts ? JSON.parse(localPrompts) : [];

      const res = await fetch("/api/prompts/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folders, prompts }),
      });

      const data = await res.json();

      if (data.success) {
        setMigrationStatus(
          `✅ ${data.stats.promptsMigrated} prompts y ${data.stats.foldersMigrated} carpetas migradas`
        );

        // Limpiar localStorage
        localStorage.removeItem("kreative-prompt-folders");
        localStorage.removeItem("kreative-prompts");

        // Recargar datos
        loadData();

        setTimeout(() => setMigrationStatus(null), 5000);
      } else {
        setMigrationStatus("❌ Error en la migración");
      }
    } catch (error) {
      console.error("Error en migración:", error);
      setMigrationStatus("❌ Error en la migración");
    }
  };

  const checkSupabaseData = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/prompts/list");
      const data = await res.json();
      return data.prompts && data.prompts.length > 0;
    } catch {
      return false;
    }
  };

  /* ====== CARGAR DATOS ====== */
  useEffect(() => {
    loadData();
  }, []);

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

  // Recargar cuando cambian los filtros
  useEffect(() => {
    if (!loading) {
      loadPrompts();
    }
  }, [selectedFolderId, showOnlyFavorites, searchQuery]);

  /* ====== CRUD PROMPTS ====== */
  const handleSavePrompt = async () => {
    if (!promptTitle.trim() || !promptContent.trim()) {
      alert("Título y contenido son requeridos");
      return;
    }

    try {
      const res = await fetch("/api/prompts/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingPrompt ? "update" : "create",
          promptId: editingPrompt?.id,
          data: {
            title: promptTitle,
            content: promptContent,
            folderId: promptFolderId,
            tags: promptTags,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        loadPrompts();
        closePromptModal();
        alert(editingPrompt ? "✅ Prompt actualizado" : "✅ Prompt creado");
      } else {
        alert("❌ " + data.error);
      }
    } catch (error) {
      console.error("Error guardando prompt:", error);
      alert("❌ Error guardando prompt");
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm("¿Eliminar este prompt?")) return;

    try {
      const res = await fetch("/api/prompts/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          promptId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        loadPrompts();
        alert("✅ Prompt eliminado");
      } else {
        alert("❌ " + data.error);
      }
    } catch (error) {
      console.error("Error eliminando prompt:", error);
      alert("❌ Error eliminando prompt");
    }
  };

  const handleToggleFavorite = async (promptId: string) => {
    try {
      const res = await fetch("/api/prompts/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-favorite",
          promptId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        loadPrompts();
      }
    } catch (error) {
      console.error("Error actualizando favorito:", error);
    }
  };

  /* ====== CRUD FOLDERS ====== */
  const handleSaveFolder = async () => {
    if (!folderName.trim()) {
      alert("El nombre de la carpeta es requerido");
      return;
    }

    try {
      const res = await fetch("/api/prompts/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingFolder ? "update" : "create",
          folderId: editingFolder?.id,
          data: {
            name: folderName,
            icon: folderIcon,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        loadFolders();
        closeFolderModal();
        alert(editingFolder ? "✅ Carpeta actualizada" : "✅ Carpeta creada");
      } else {
        alert("❌ " + data.error);
      }
    } catch (error) {
      console.error("Error guardando carpeta:", error);
      alert("❌ Error guardando carpeta");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("¿Eliminar esta carpeta? Los prompts quedarán sin carpeta.")) return;

    try {
      const res = await fetch("/api/prompts/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          folderId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        loadFolders();
        loadPrompts();
        alert("✅ Carpeta eliminada");
      } else {
        alert("❌ " + data.error);
      }
    } catch (error) {
      console.error("Error eliminando carpeta:", error);
      alert("❌ Error eliminando carpeta");
    }
  };

  /* ====== MODALS ====== */
  const openPromptModal = (prompt?: Prompt) => {
    if (prompt) {
      setEditingPrompt(prompt);
      setPromptTitle(prompt.title);
      setPromptContent(prompt.content);
      setPromptFolderId(prompt.folder_id);
      setPromptTags(prompt.tags);
    } else {
      setEditingPrompt(null);
      setPromptTitle("");
      setPromptContent("");
      setPromptFolderId(selectedFolderId);
      setPromptTags([]);
    }
    setShowPromptModal(true);
  };

  const closePromptModal = () => {
    setShowPromptModal(false);
    setEditingPrompt(null);
    setPromptTitle("");
    setPromptContent("");
    setPromptFolderId(null);
    setPromptTags([]);
  };

  const openFolderModal = (folder?: Folder) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderName(folder.name);
      setFolderIcon(folder.icon);
    } else {
      setEditingFolder(null);
      setFolderName("");
      setFolderIcon("📁");
    }
    setShowFolderModal(true);
  };

  const closeFolderModal = () => {
    setShowFolderModal(false);
    setEditingFolder(null);
    setFolderName("");
    setFolderIcon("📁");
  };

  /* ====== ESTADÍSTICAS ====== */
  const totalPrompts = prompts.length;
  const favoritePrompts = prompts.filter((p) => p.is_favorite).length;

  const folderCounts = folders.map((f) => ({
    ...f,
    count: prompts.filter((p) => p.folder_id === f.id).length,
  }));

  const uncategorizedCount = prompts.filter((p) => p.folder_id === null).length;

  /* ====== RENDER ====== */
  return (
    <div style={{ 
      minHeight: "100vh",
      background: "#fff",
      padding: "32px 18px", 
      maxWidth: 1400, 
      margin: "0 auto" 
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              background: "var(--brand-accent)",
              borderRadius: "999px",
              boxShadow: "0 0 0 3px var(--brand-accent-glow)",
            }}
          />
          <h1 style={{ margin: 0, fontWeight: 800, color: "var(--brand-accent)", fontSize: 32 }}>
            Galería de Prompts
          </h1>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => openPromptModal()}
            style={{
              padding: "10px 16px",
              background: "var(--brand-accent)",
              color: "var(--brand-accent-ink)",
              borderRadius: 10,
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
            }}
          >
            + Nuevo prompt
          </button>
          <button
            onClick={() => openFolderModal()}
            style={{
              padding: "10px 16px",
              background: "#fff",
              color: "#111",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Nueva Carpeta
          </button>
        </div>
      </div>

      <p style={{ marginTop: -12, marginBottom: 24, color: "#6b7280" }}>
        Kreative 360º - Tus prompts guardados en la nube
      </p>

      {/* Mensaje de migración */}
      {migrationStatus && (
        <div
          style={{
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            color: "#0c4a6e",
          }}
        >
          {migrationStatus}
        </div>
      )}

      {/* Estadísticas */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            padding: "12px 16px",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>{totalPrompts}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total prompts</div>
        </div>
        <div
          style={{
            padding: "12px 16px",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{favoritePrompts}</div>
          <div style={{ fontSize: 12, color: "#92400e" }}>Favoritos</div>
        </div>
        <div
          style={{
            padding: "12px 16px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a" }}>{folders.length}</div>
          <div style={{ fontSize: 12, color: "#14532d" }}>Carpetas</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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
            minWidth: 300,
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>

      {/* Chips de carpetas */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
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
          📋 Todos ({totalPrompts})
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

        {folderCounts.map((folder) => (
          <div key={folder.id} style={{ position: "relative", display: "inline-flex" }}>
            <button
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
                paddingRight: 30,
              }}
            >
              <span>{folder.icon}</span> <span>{folder.name}</span> <span>({folder.count})</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(folder.id);
              }}
              style={{
                position: "absolute",
                right: 2,
                top: "50%",
                transform: "translateY(-50%)",
                width: 20,
                height: 20,
                borderRadius: 4,
                border: "none",
                background: "transparent",
                color: selectedFolderId === folder.id ? "#fff" : "#6b7280",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
              }}
              title="Eliminar carpeta"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Lista de prompts */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
          Cargando...
        </div>
      ) : prompts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "#9ca3af",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
          <p style={{ margin: 0, fontSize: 14 }}>
            No hay prompts. Crea tu primer prompt con el botón "+ Nuevo prompt".
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 14,
                transition: "all 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fff0f0";
                e.currentTarget.style.borderColor = "#ff6b6b";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f9fafb";
                e.currentTarget.style.borderColor = "#e5e7eb";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#111827",
                    flex: 1,
                  }}
                >
                  {prompt.title}
                </h3>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(prompt.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 16,
                      padding: 0,
                    }}
                  >
                    {prompt.is_favorite ? "⭐" : "☆"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPromptModal(prompt);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      padding: 0,
                      color: "#6b7280",
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePrompt(prompt.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      padding: 0,
                      color: "#ef4444",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Content */}
              <p
                style={{
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
                }}
              >
                {prompt.content}
              </p>

              {/* Tags */}
              {prompt.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {prompt.tags.map((tag) => (
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

      {/* Modal de Prompt */}
      {showPromptModal && (
        <div
          onClick={closePromptModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
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
              maxWidth: 700,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              padding: 24,
            }}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: 20, fontWeight: 700, color: "#111" }}>
              {editingPrompt ? "Editar Prompt" : "Nuevo Prompt"}
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#111" }}>
                Título *
              </label>
              <input
                type="text"
                value={promptTitle}
                onChange={(e) => setPromptTitle(e.target.value)}
                placeholder="Mi prompt para..."
                maxLength={200}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  color: "#111",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#111" }}>
                Contenido *
              </label>
              <textarea
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                placeholder="Escribe tu prompt aquí..."
                maxLength={5000}
                style={{
                  width: "100%",
                  minHeight: 200,
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  color: "#111",
                }}
              />
              <small style={{ color: "#6b7280" }}>
                {promptContent.length} / 5000 caracteres
              </small>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#111" }}>
                Carpeta
              </label>
              <select
                value={promptFolderId || ""}
                onChange={(e) => setPromptFolderId(e.target.value || null)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  color: "#111",
                }}
              >
                <option value="">Sin carpeta</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.icon} {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={closePromptModal}
                style={{
                  padding: "10px 16px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "#111",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePrompt}
                style={{
                  padding: "10px 16px",
                  background: "var(--brand-accent)",
                  color: "var(--brand-accent-ink)",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {editingPrompt ? "Actualizar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Folder */}
      {showFolderModal && (
        <div
          onClick={closeFolderModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
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
              maxWidth: 500,
              width: "100%",
              padding: 24,
            }}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: 20, fontWeight: 700, color: "#111" }}>
              {editingFolder ? "Editar Carpeta" : "Nueva Carpeta"}
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#111" }}>
                Nombre *
              </label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Mi carpeta"
                maxLength={100}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  color: "#111",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#111" }}>
                Emoji
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["📁", "🎨", "💼", "🏢", "🎯", "⭐", "🔥", "💡", "🚀", "📦"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setFolderIcon(emoji)}
                    style={{
                      padding: "8px 12px",
                      background: folderIcon === emoji ? "#ff6b6b" : "#f9fafb",
                      border: "1px solid",
                      borderColor: folderIcon === emoji ? "#ff6b6b" : "#e5e7eb",
                      borderRadius: 8,
                      fontSize: 20,
                      cursor: "pointer",
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={closeFolderModal}
                style={{
                  padding: "10px 16px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "#111",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFolder}
                style={{
                  padding: "10px 16px",
                  background: "var(--brand-accent)",
                  color: "var(--brand-accent-ink)",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {editingFolder ? "Actualizar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}