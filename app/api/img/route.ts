// app/api/img/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";

const BLOCKED = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const PRIVATE_IP = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^169\.254\./];

function isPrivate(host: string) {
  if (BLOCKED.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return PRIVATE_IP.some((re) => re.test(host));
  return false;
}

function normalizeDrive(u: URL) {
  if (u.hostname === "drive.google.com" && u.pathname.includes("/file/d/")) {
    const id = u.pathname.split("/").filter(Boolean)[2];
    return new URL(`https://drive.google.com/uc?export=download&id=${id}`);
  }
  if (u.hostname === "drive.google.com" && u.pathname === "/uc") {
    if (!u.searchParams.get("export")) u.searchParams.set("export", "view");
  }
  return u;
}

async function fetchImage(url: string) {
  return fetch(url, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      // OJO: NO pedimos AVIF; preferimos formatos compatibles con Gemini
      Accept: "image/webp,image/jpeg,image/png,image/*;q=0.8",
      "User-Agent": "Mozilla/5.0 FirstWin-ImageProxy/1.0",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawParam = searchParams.get("url");
    if (!rawParam) return NextResponse.json({ error: "Missing ?url=" }, { status: 400 });

    // Quita comillas y decodifica varias veces (por si viene doblemente codificada)
    let raw = rawParam.trim().replace(/^['"]|['"]$/g, "");
    for (let i = 0; i < 3; i++) {
      try {
        const dec = decodeURIComponent(raw);
        if (dec === raw) break;
        raw = dec;
      } catch {
        break;
      }
    }
    raw = raw.replace(/\s+/g, "%20");

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return NextResponse.json({ error: "Invalid URL", received: rawParam, parsed: raw }, { status: 400 });
    }

    if (!/^https?:$/.test(target.protocol)) {
      return NextResponse.json({ error: "Only http/https allowed" }, { status: 400 });
    }
    if (isPrivate(target.hostname)) {
      return NextResponse.json({ error: "Blocked host" }, { status: 403 });
    }

    target = normalizeDrive(target);

    // 1º intento: directo
    let r = await fetchImage(target.toString());
    let ct = r.headers.get("content-type") || "";

    // Si es AVIF o no parece imagen → convertimos por weserv a JPG
    if (!r.ok || ct.includes("image/avif") || (!ct.startsWith("image/") && ct !== "application/octet-stream")) {
      const via = `https://images.weserv.nl/?url=${encodeURIComponent(target.toString())}&output=jpg`;
      r = await fetchImage(via);
      ct = r.headers.get("content-type") || "";
    }

    if (!r.ok) {
      return NextResponse.json({ error: `Upstream error ${r.status}` }, { status: 502 });
    }

    const buf = await r.arrayBuffer();
    const mime =
      ct && (ct.startsWith("image/") || ct === "application/octet-stream")
        ? (ct.includes("image/avif") ? "image/jpeg" : (ct.startsWith("image/") ? ct : "image/jpeg"))
        : "image/jpeg";

    const res = new NextResponse(buf, { status: 200 });
    res.headers.set("Content-Type", mime);
    res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Timing-Allow-Origin", "*");
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: "Proxy error", detail: String(e?.message || e) }, { status: 500 });
  }
}
