import { createDataClient } from "@/data/client";

export async function createServerDataClient() {
  return createDataClient({
    baseUrl: process.env.DATA_API_URL ?? "http://127.0.0.1:8787",
    token: process.env.DATA_API_TOKEN,
    headers: {
      "X-Inkloom-WorkOS-User-Id": "local",
      "X-Inkloom-User-Email": "local@inkloom.local",
    },
  });
}
