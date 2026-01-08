"use client";

import Link from "next/link";

export default function HomePage() {
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
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          width: "100%",
          maxWidth: 700,
        }}
      >
        {/* Panel MASIVO */}
        <Link
          href="/masivo"
          style={{
            background: "#1A1D21",
            border: "1px solid #2a2d31",
            borderRadius: 16,
            padding: "24px 20px",
            textDecoration: "none",
            color: "#fff",
            fontWeight: 700,
            transition: "all 0.2s ease",
          }}
        >
          <h2
            style={{
              color: "#FF6D6D",
              marginBottom: 10,
              fontSize: "1.2rem",
            }}
          >
            Generador de Imágenes Masivo
          </h2>
          <p style={{ color: "#cbd5e1", fontSize: "0.95rem" }}>
            Genera imágenes de producto en lote usando prompts y una imagen de referencia.
          </p>
        </Link>

        {/* Panel Pic2Lab */}
        <Link
          href="/pictulab"
          style={{
            background: "#1A1D21",
            border: "1px solid #2a2d31",
            borderRadius: 16,
            padding: "24px 20px",
            textDecoration: "none",
            color: "#fff",
            fontWeight: 700,
            transition: "all 0.2s ease",
          }}
        >
          <h2
            style={{
              color: "#FF6D6D",
              marginBottom: 10,
              fontSize: "1.2rem",
            }}
          >
            Panel Pic2Lab
          </h2>
          <p style={{ color: "#cbd5e1", fontSize: "0.95rem" }}>
            Editor avanzado con tamaños, formatos y calidad hasta 300 ppp.
          </p>
        </Link>
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
