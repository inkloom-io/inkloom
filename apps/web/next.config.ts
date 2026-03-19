import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Use Turbopack (default in Next.js 16)
  turbopack: {
    resolveAlias: {
      // elkjs conditionally requires 'web-worker' for Node.js environments,
      // but this code path is unreachable in the browser. Tell Turbopack to
      // treat it as an empty module so the static resolver doesn't fail.
      "web-worker": "./lib/empty-module.js",
    },
  },
  transpilePackages: [
    "@inkloom/ui",
    "@blocknote/core",
    "@blocknote/react",
    "@blocknote/mantine",
    "@mantine/core",
    "@mantine/hooks",
    "convex",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Ensure API routes and server components can use Node.js modules
  serverExternalPackages: ["@apidevtools/swagger-parser", "create-inkloom"],
};

export default withNextIntl(nextConfig);
