import { proxyDataRequest } from "@/lib/data-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = proxyDataRequest;
export const POST = proxyDataRequest;
export const PUT = proxyDataRequest;
export const PATCH = proxyDataRequest;
export const DELETE = proxyDataRequest;
