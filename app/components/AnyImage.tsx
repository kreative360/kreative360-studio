"use client";

import { useState } from "react";
import Link from "next/link";

export default function AnyImage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Botón hamburguesa */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 bg-white shadow p-2 rounded-md"
      >
        <span className="text-2xl">☰</span>
      </button>

      {/* Panel lateral */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white shadow-lg z-40 p-6 w-72 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <h2 className="text-2xl font-bold text-[#FF6D6D] mb-6">
          Kreative 360º
        </h2>

        {/* Botón: Generador Masivo */}
        <Link
          href="/masivo"
          className="block w-full bg-white border border-gray-300 hover:border-black text-black font-medium py-3 rounded-lg mb-4 text-center"
        >
          Generador de Imágenes Masivo
        </Link>

        {/* Botón: PicTULAB */}
        <Link
          href="/pictulab"
          className="block w-full bg-white border border-gray-300 hover:border-black text-black font-medium py-3 rounded-lg mb-4 text-center"
        >
          Panel PicTULAB
        </Link>

        {/* Footer */}
        <p className="absolute bottom-6 left-6 text-xs text-gray-500">
          © 2025 Kreative 360º
        </p>
      </aside>
    </>
  );
}
