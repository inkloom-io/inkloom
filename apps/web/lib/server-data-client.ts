import { createDataClient } from "@/data/client";
import { authAdapter } from "@/lib/adapters";

export async function createServerDataClient() {
  const user = await authAdapter.requireUser();
  return createDataClient({
    baseUrl: process.env.DATA_API_URL ?? "http://127.0.0.1:8787",
    token: process.env.DATA_API_TOKEN,
    headers: {
      "X-Inkloom-WorkOS-User-Id": user.id,
      "X-Inkloom-User-Email": user.email,
    },
  });
}
