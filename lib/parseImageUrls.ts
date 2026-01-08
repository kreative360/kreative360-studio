// lib/parseImageUrls.ts
export function parseImageUrls(input: string, max = 6): string[] {
  // Captura cualquier http/https hasta el siguiente espacio o salto de línea.
  const found = input.match(/https?:\/\/\S+/g) || [];

  const cleaned = found.map((u) => {
    // Quita puntuación de cierre común si viene pegada
    const trimmed = u.replace(/[)\]\}\>,]+$/, "");
    return trimmed;
  });

  const valid = cleaned.filter((u) => {
    try {
      const x = new URL(u);
      return x.protocol === "https:" || x.protocol === "http:";
    } catch {
      return false;
    }
  });

  // Dedupe y limita a max
  return Array.from(new Set(valid)).slice(0, max);
}
