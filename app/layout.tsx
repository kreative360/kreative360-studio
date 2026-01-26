"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Mostrar menú en todas las páginas excepto la home
  const showMenu = pathname !== "/";

  return (
    <html lang="es">
      <body style={{ background: "#0b0c0e" }}>

        {showMenu && (
          <>
            {/* Botón hamburguesa */}
            <button
              onClick={() => setOpen(!open)}
              style={{
                position: "fixed",
                top: 20,
                left: 20,
                zIndex: 9999,
                background: "#fff",
                width: 42,
                height: 42,
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              ☰
            </button>

            {/* Sidebar */}
            <div
              style={{
                position: "fixed",
                top: 0,
                left: open ? 0 : "-260px",
                width: 260,
                height: "100vh",
                background: "#ffffff",
                borderRight: "1px solid #eee",
                padding: "28px 18px",
                zIndex: 9998,
                transition: "left 0.3s ease",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h1
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#FF6D6D",
                  marginBottom: 24
                }}
              >
                Kreative 360º
              </h1>

              {/* 1. Panel Masivo */}
              <Link
                href="/masivo"
                onClick={() => setOpen(false)}
                style={{
                  padding: "14px 16px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  marginBottom: 12,
                  fontWeight: 600,
                  color: "#111827",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                Panel Masivo
              </Link>

              {/* 2. Panel Pictulab */}
              <Link
                href="/pictulab"
                onClick={() => setOpen(false)}
                style={{
                  padding: "14px 16px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  marginBottom: 12,
                  fontWeight: 600,
                  color: "#111827",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                Panel Pictulab
              </Link>

              {/* 3. Galería Proyectos */}
              <Link
                href="/projects"
                onClick={() => setOpen(false)}
                style={{
                  padding: "14px 16px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  marginBottom: 12,
                  fontWeight: 600,
                  color: "#111827",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                Galería Proyectos
              </Link>

              {/* 4. Galería Prompts - NUEVO */}
              <Link
                href="/prompts"
                onClick={() => setOpen(false)}
                style={{
                  padding: "14px 16px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  marginBottom: 12,
                  fontWeight: 600,
                  color: "#111827",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                Galería Prompts
              </Link>

              {/* 5. Optimizador Espacio */}
              <Link
                href="/cleanup"
                onClick={() => setOpen(false)}
                style={{
                  padding: "14px 16px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  marginBottom: 12,
                  fontWeight: 600,
                  color: "#111827",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                Optimizador Espacio
              </Link>

              <p style={{ marginTop: "auto", color: "#9ca3af", fontSize: 12 }}>
                © 2025 Kreative 360º
              </p>
            </div>
          </>
        )}

        {children}
      </body>
    </html>
  );
}