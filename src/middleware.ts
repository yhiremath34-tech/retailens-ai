import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const hasSimSession = Boolean(req.cookies.get("retailens_session")?.value);
    const hasSupabaseCookie = req.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.value.length > 0);

    if (!hasSimSession && !hasSupabaseCookie) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

