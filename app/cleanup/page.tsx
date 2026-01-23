import CleanupOrphansButton from "@/app/components/CleanupOrphansButton";

export default function CleanupPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", paddingTop: 40 }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: "DM Serif Display",
              fontSize: 36,
              marginBottom: 12,
            }}
          >
            🧹 Mantenimiento
          </h1>
          <p style={{ fontSize: 14, color: "#666" }}>
            Herramientas de mantenimiento y limpieza del sistema
          </p>
        </div>

        <CleanupOrphansButton />

        <div
          style={{
            marginTop: 40,
            padding: 20,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            ℹ️ ¿Cuándo usar esta herramienta?
          </h3>
          <ul style={{ fontSize: 13, color: "#666", lineHeight: 1.8 }}>
            <li>
              Después de eliminar imágenes desde el panel de proyectos
            </li>
            <li>
              Si notas que hay más archivos en Supabase Storage que en tu base de datos
            </li>
            <li>
              Para liberar espacio en tu cuenta de Supabase
            </li>
            <li>
              Después de hacer pruebas o migraciones de datos
            </li>
          </ul>
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <a
            href="/projects"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#ff6b6b",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Volver a Proyectos
          </a>
        </div>
      </div>
    </div>
  );
}