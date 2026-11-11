import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const sku = req.nextUrl.searchParams.get("sku") || "SKU";
  const label = sku.replace(/^SKU-/, "").slice(0, 6);
  let hash = 0;
  for (let i = 0; i < sku.length; i++) hash = (hash * 31 + sku.charCodeAt(i)) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0f9ff"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="14" fill="url(#g)" stroke="#7dd3fc" stroke-width="2"/>
  <text x="40" y="45" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="13" font-weight="700" fill="#0369a1">${label}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

