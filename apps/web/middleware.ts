import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { buildCspDirectives, CSP_HEADER } from "@/lib/csp";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Attach CSP report-only header to a response.
 */
function withCspHeaders(response: NextResponse): NextResponse {
  response.headers.set(CSP_HEADER, buildCspDirectives());
  return response;
}

/**
 * Core-mode middleware.
 *
 * Handles i18n locale detection/routing and CSP headers.
 * No WorkOS cookie handling, no auth-related cache headers.
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip locale handling for API routes and static files
  if (pathname.startsWith("/api/")) {
    return withCspHeaders(NextResponse.next());
  }

  return withCspHeaders(intlMiddleware(request));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
