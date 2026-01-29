"use client";

import Link from "next/link";

export default function HomePage() {
  const panels = [
    {
      href: "/masivo",
      title: "Panel Masivo",
      icon: "🎨",
      description: "Genera imágenes de producto en lote usando prompts y una imagen de referencia.",
    },
    {
      href: "/pictulab",
      title: "Panel Pictulab",
      icon: "🖼️",
      description: "Editor avanzado con tamaños, formatos y calidad hasta 300 ppp.",
    },
    {
      href: "/projects",
      title: "Galeria Proyectos",
      icon: "📁",
      description: "Gestiona y organiza todos tus proyectos de imágenes generadas.",
    },
    {
      href: "/prompts",
      title: "Galeria Prompts",
      icon: "📝",
      description: "Biblioteca de prompts reutilizables para generar imágenes consistentes.",
    },
    {
      href: "/cleanup",
      title: "Optimizador Espacio",
      icon: "🚀",
      description: "Limpia archivos huérfanos y optimiza el espacio de almacenamiento.",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0c0e",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "2.6rem",
          fontWeight: 800,
          color: "#FF6D6D",
          marginBottom: "16px",
        }}
      >
        Kreative 360º · Panel de trabajo
      </h1>

      <p
        style={{
          color: "#cbd5e1",
          maxWidth: 640,
          lineHeight: 1.6,
          marginBottom: 40,
        }}
      >
        Bienvenido al sistema de herramientas internas de{" "}
        <strong>Kreative 360º</strong>.
        <br />
        Elige un panel para comenzar:
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          width: "100%",
          maxWidth: 900,
        }}
      >
        {panels.map((panel) => (
          <Link
            key={panel.href}
            href={panel.href}
            style={{
              background: "#1A1D21",
              border: "1px solid #2a2d31",
              borderRadius: 16,
              padding: "24px 20px",
              textDecoration: "none",
              color: "#fff",
              fontWeight: 700,
              transition: "all 0.2s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#252831";
              e.currentTarget.style.borderColor = "#FF6D6D";
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(255, 109, 109, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#1A1D21";
              e.currentTarget.style.borderColor = "#2a2d31";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                fontSize: "2.5rem",
                marginBottom: 12,
              }}
            >
              {panel.icon}
            </div>
            <h2
              style={{
                color: "#FF6D6D",
                marginBottom: 10,
                fontSize: "1.2rem",
              }}
            >
              {panel.title}
            </h2>
            <p style={{ color: "#cbd5e1", fontSize: "0.9rem", lineHeight: 1.5 }}>
              {panel.description}
            </p>
          </Link>
        ))}
      </div>

      <p
        style={{
          marginTop: 60,
          color: "#666",
          fontSize: "0.85rem",
        }}
      >
        © 2025 Kreative 360º — Panel interno desarrollado por FirstWin Agency
      </p>
    </main>
  );
}