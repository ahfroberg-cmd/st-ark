import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Hoppa över om vi redan är på /mobile eller om det är en API-route/static-fil
  if (
    request.nextUrl.pathname.startsWith("/mobile") ||
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|json|wasm|mjs)$/)
  ) {
    return NextResponse.next();
  }

  // Detektera mobil via user agent
  const userAgent = request.headers.get("user-agent") || "";
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent
  );

  // Om det är root-sidan och mobil, redirecta till /mobile
  if (isMobile && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/mobile", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

