import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const sku = req.nextUrl.searchParams.get("sku") || "SKU";
  const label = sku.replace(/^SKU-/, "").slice(0, 6);
  let hash = 0;
  for (let i = 0; i < sku.length; i++) hash = (hash * 31 + sku.charCodeAt(i)) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hash}, 58%, 22%)"/>
      <stop offset="100%" stop-color="hsl(${(hash + 35) % 360}, 65%, 14%)"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="14" fill="url(#g)" stroke="hsl(${hash}, 70%, 45%)" stroke-opacity="0.45" stroke-width="2"/>
  <text x="40" y="45" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="13" font-weight="700" fill="#e2e8f0">${label}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

