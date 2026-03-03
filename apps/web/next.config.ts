import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Use Turbopack (default in Next.js 16)
  turbopack: {},
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
  serverExternalPackages: ["@workos-inc/node", "@workos-inc/authkit-nextjs", "@apidevtools/swagger-parser", "create-inkloom"],
};

export default withNextIntl(nextConfig);
