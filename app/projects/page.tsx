"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

/* ======================================================
   TIPOS
====================================================== */
type Project = {
  id: string;
  name: string;
  imagesCount: number;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const hasLoadedOnce = useRef(false);

  /* ======================================================
     CARGAR PROYECTOS - 🚀 OPTIMIZADO
  ====================================================== */
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/list", { cache: "no-store" });
      const data = await res.json();

      if (!data.projects) {
        setProjects([]);
        return;
      }

      // 🚀 YA NO NECESITA PETICIONES ADICIONALES
      // El backend devuelve imagesCount directamente
      setProjects(data.projects);
    } catch (err) {
      console.error("Error cargando proyectos", err);
      setProjects([]);
    } finally {
      if (!hasLoadedOnce.current) {
        setLoading(false);
        hasLoadedOnce.current = true;
      }
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  /* ======================================================
     CREAR PROYECTO
  ====================================================== */
  const createProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;

    const tempId = crypto.randomUUID();

    setProjects((prev) => [
      { id: tempId, name, imagesCount: 0 },
      ...prev,
    ]);
    setNewProjectName("");

    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (!data.project) throw new Error();

      setProjects((prev) =>
        prev.map((p) =>
          p.id === tempId ? { ...data.project, imagesCount: 0 } : p
        )
      );
    } catch {
      setProjects((prev) => prev.filter((p) => p.id !== tempId));
      alert("Error creando proyecto");
    }
  };

  /* ======================================================
     RENOMBRAR (UI)
  ====================================================== */
  const saveProjectName = (id: string) => {
    if (!editingName.trim()) {
      setEditingProjectId(null);
      return;
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name: editingName.trim() } : p
      )
    );

    setEditingProjectId(null);
    setEditingName("");
  };

  /* ======================================================
     ELIMINAR PROYECTO
  ====================================================== */
  const deleteProject = async (id: string) => {
    const ok = confirm("¿Estás seguro que deseas eliminar el proyecto?");
    if (!ok) return;

    const backup = projects;
    setProjects((prev) => prev.filter((p) => p.id !== id));

    try {
      const res = await fetch("/api/projects/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });

      const data = await res.json();
      if (!data.success) throw new Error();
    } catch {
      setProjects(backup);
      alert("Error eliminando proyecto");
    }
  };

  /* ======================================================
     🆕 COPIAR UUID
  ====================================================== */
  const copyUUID = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ======================================================
     UI
  ====================================================== */
  return (
    <div style={{ minHeight: "100vh", background: "#fff", padding: 40 }}>
      <h1
        style={{
          fontFamily: "DM Serif Display",
          fontSize: 34,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        Proyectos
      </h1>

      {loading && (
        <p style={{ textAlign: "center", opacity: 0.6, marginBottom: 20 }}>
          Cargando proyectos…
        </p>
      )}

      <div
        style={{
          maxWidth: 420,
          margin: "0 auto 30px",
          display: "flex",
          gap: 10,
        }}
      >
        <input
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createProject()}
          placeholder="Nombre del proyecto"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={createProject}
          className="btn-zoom"
          style={{
            background: "#ff6b6b",
            color: "#fff",
            borderRadius: 10,
            padding: "0 18px",
          }}
        >
          Crear
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 24,
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            style={{ textDecoration: "none" }}
          >
            <div
              className="btn-zoom"
              style={{
                background: "#ff6b6b",
                color: "#fff",
                borderRadius: 16,
                padding: 18,
                cursor: "pointer",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  display: "flex",
                  gap: 8,
                }}
                onClick={(e) => e.preventDefault()}
              >
                <span
                  onClick={() => {
                    setEditingProjectId(project.id);
                    setEditingName(project.name);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  ✏️
                </span>
                <span 
                  onClick={() => deleteProject(project.id)}
                  style={{ cursor: "pointer" }}
                >
                  ✕
                </span>
              </div>

              {editingProjectId === project.id ? (
                <input
                  value={editingName}
                  autoFocus
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => saveProjectName(project.id)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && saveProjectName(project.id)
                  }
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: 600,
                    outline: "none",
                  }}
                />
              ) : (
                <>
                  <h2
                    style={{
                      fontFamily: "DM Serif Display",
                      fontSize: 20,
                      marginBottom: 6,
                    }}
                  >
                    {project.name}
                  </h2>
                  
                  {/* 🆕 UUID VISIBLE */}
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      copyUUID(project.id);
                    }}
                    style={{
                      fontSize: 10,
                      opacity: 0.8,
                      marginBottom: 8,
                      fontFamily: "monospace",
                      cursor: "pointer",
                      padding: "4px 6px",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: 4,
                      display: "inline-block",
                      wordBreak: "break-all",
                    }}
                    title="Click para copiar"
                  >
                    {copiedId === project.id ? "✓ Copiado" : project.id}
                  </div>
                </>
              )}

              <p style={{ fontSize: 13, opacity: 0.9 }}>
                {project.imagesCount} imágenes
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}