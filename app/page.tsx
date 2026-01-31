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
      href: "/workflows",
      title: "Workflows Automáticos",
      icon: "🤖",
      description: "Procesamiento masivo de catálogos con prompts adaptativos e IA.",
    },
    {
      href: "/projects",
      title: "Galería Proyectos",
      icon: "📁",
      description: "Gestiona y organiza todos tus proyectos de imágenes generadas.",
    },
    {
      href: "/prompts",
      title: "Galería Prompts",
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
        background: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #ffeaa7 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      {/* Logo / Icono principal */}
      <div
        style={{
          width: 100,
          height: 100,
          background: "linear-gradient(135deg, #ff6b6b 0%, #ffa07a 100%)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 50,
          marginBottom: 24,
          boxShadow: "0 10px 30px rgba(255, 107, 107, 0.3)",
        }}
      >
        🎨
      </div>

      <h1
        style={{
          fontSize: "2.8rem",
          fontWeight: 800,
          color: "#ff6b6b",
          marginBottom: "16px",
          textShadow: "0 2px 10px rgba(255, 107, 107, 0.2)",
        }}
      >
        Kreative 360º · Panel de trabajo
      </h1>

      <p
        style={{
          color: "#374151",
          maxWidth: 640,
          lineHeight: 1.7,
          marginBottom: 40,
          fontSize: "1.05rem",
          fontWeight: 500,
        }}
      >
        Bienvenido al sistema de herramientas internas de{" "}
        <strong style={{ color: "#ff6b6b" }}>Kreative 360º</strong>.
        <br />
        Elige un panel para comenzar:
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          width: "100%",
          maxWidth: 1000,
        }}
      >
        {panels.map((panel) => (
          <Link
            key={panel.href}
            href={panel.href}
            style={{
              background: "#ffffff",
              border: "2px solid transparent",
              borderRadius: 20,
              padding: "28px 24px",
              textDecoration: "none",
              color: "#1f2937",
              fontWeight: 700,
              transition: "all 0.3s ease",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(255, 107, 107, 0.15)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#ff6b6b";
              e.currentTarget.style.transform = "translateY(-8px) scale(1.02)";
              e.currentTarget.style.boxShadow = "0 12px 40px rgba(255, 107, 107, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(255, 107, 107, 0.15)";
            }}
          >
            <div
              style={{
                fontSize: "3rem",
                marginBottom: 16,
                filter: "drop-shadow(0 2px 4px rgba(255, 107, 107, 0.2))",
              }}
            >
              {panel.icon}
            </div>
            <h2
              style={{
                color: "#ff6b6b",
                marginBottom: 12,
                fontSize: "1.3rem",
                fontWeight: 800,
              }}
            >
              {panel.title}
            </h2>
            <p
              style={{
                color: "#6b7280",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              {panel.description}
            </p>
          </Link>
        ))}
      </div>

      <p
        style={{
          marginTop: 60,
          color: "#6b7280",
          fontSize: "0.9rem",
          fontWeight: 500,
        }}
      >
        Panel interno desarrollado por — Kreative 360º © 
      </p>
    </main>
  );
}