"use client";

export interface AuthConfig {
  type: "bearer" | "apiKey" | "basic" | "none";
  token?: string;
  apiKey?: string;
  apiKeyName?: string;
  apiKeyIn?: "header" | "query" | "cookie";
  username?: string;
  password?: string;
}

const STORAGE_KEY = "inkloom-api-auth";

const DEFAULT_CONFIG: AuthConfig = { type: "none" };

export function getAuthConfig(): AuthConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return DEFAULT_CONFIG;
}

export function setAuthConfig(config: AuthConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}
