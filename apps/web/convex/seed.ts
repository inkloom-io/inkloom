/**
 * Seed data function for populating the dev environment with rich,
 * realistic mock data suitable for product documentation screenshots.
 *
 * Idempotent: clears existing data and repopulates on each run.
 *
 * Usage: pnpm seed (or: npx convex run seed:seed)
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Helpers ──────────────────────────────────────────────────────────

const now = Date.now();
const hour = 3_600_000;
const day = 86_400_000;

function ts(daysAgo: number, hoursAgo = 0): number {
  return now - daysAgo * day - hoursAgo * hour;
}

// Clear a single table — call once per table via: npx convex run seed:clearTable '{"table":"tableName"}'
export const clearTable = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    let hasMore = true;
    while (hasMore) {
      const rows = await ctx.db.query(table as any).take(50);
      if (rows.length === 0) {
        hasMore = false;
      } else {
        for (const row of rows) {
          await ctx.db.delete(row._id);
        }
      }
    }
  },
});

// ── BlockNote Content Helpers ────────────────────────────────────────

function text(t: string, styles?: Record<string, boolean>) {
  return styles ? { type: "text" as const, text: t, styles } : { type: "text" as const, text: t };
}

function link(t: string, href: string) {
  return { type: "link" as const, href, content: [text(t)] };
}

function heading(level: number, ...content: any[]) {
  return { type: "heading", props: { level }, content };
}

function paragraph(...content: any[]) {
  return { type: "paragraph", content };
}

function bulletItem(...content: any[]) {
  return { type: "bulletListItem", content };
}

function numberedItem(...content: any[]) {
  return { type: "numberedListItem", content };
}

function codeBlock(language: string, code: string) {
  return { type: "codeBlock", props: { language }, content: [text(code)] };
}

function callout(type: string, ...content: any[]) {
  return { type: "callout", props: { type }, content };
}

function divider() {
  return { type: "divider" };
}

function toContent(blocks: any[]): string {
  return JSON.stringify(blocks);
}

// ── Rich Page Content ────────────────────────────────────────────────

const introductionContent = toContent([
  heading(1, text("Welcome to Acme Platform")),
  paragraph(
    text("Acme Platform Docs is your comprehensive resource for building, deploying, and scaling applications with the Acme ecosystem. Whether you're a new developer exploring our APIs or an experienced engineer architecting production systems, you'll find everything you need here.")
  ),
  callout("info", text("New to Acme? Start with the "), link("Quickstart Guide", "/getting-started/quickstart"), text(" to have your first app running in under 5 minutes.")),
  divider(),
  heading(2, text("What You'll Find")),
  bulletItem(text("Getting Started", { bold: true }), text(" — Installation, quickstart, and core concepts")),
  bulletItem(text("API Reference", { bold: true }), text(" — Complete endpoint documentation with examples")),
  bulletItem(text("Guides", { bold: true }), text(" — Step-by-step tutorials for common workflows")),
  bulletItem(text("SDKs & Libraries", { bold: true }), text(" — Client libraries for JavaScript, Python, Go, and more")),
  divider(),
  heading(2, text("Platform Overview")),
  paragraph(
    text("The Acme Platform provides a unified suite of tools for modern application development:")
  ),
  numberedItem(text("Acme Auth", { bold: true }), text(" — Enterprise-grade authentication with SSO, MFA, and social login")),
  numberedItem(text("Acme Data", { bold: true }), text(" — Real-time database with automatic syncing and conflict resolution")),
  numberedItem(text("Acme Deploy", { bold: true }), text(" — One-click deployments to global edge infrastructure")),
  numberedItem(text("Acme Analytics", { bold: true }), text(" — Built-in observability with custom dashboards and alerts")),
  callout("tip", text("All Acme services share a single API key and unified billing. No juggling multiple accounts.")),
]);

const quickstartContent = toContent([
  heading(1, text("Quickstart")),
  paragraph(text("Get up and running with Acme Platform in under 5 minutes. This guide walks you through creating your first project, installing the SDK, and making your first API call.")),
  heading(2, text("Prerequisites")),
  bulletItem(text("Node.js 18+ or Python 3.10+")),
  bulletItem(text("An Acme account ("), link("sign up free", "https://acme.dev/signup"), text(")")),
  bulletItem(text("A terminal / command line")),
  heading(2, text("Step 1: Install the SDK")),
  paragraph(text("Choose your preferred language and install the Acme SDK:")),
  codeBlock("bash", "# Node.js / TypeScript\nnpm install @acme/sdk\n\n# Python\npip install acme-sdk"),
  heading(2, text("Step 2: Initialize Your Client")),
  paragraph(text("Create an API client with your project credentials:")),
  codeBlock("typescript", 'import { AcmeClient } from "@acme/sdk";\n\nconst client = new AcmeClient({\n  apiKey: process.env.ACME_API_KEY,\n  projectId: "proj_abc123",\n});\n\n// Verify the connection\nconst status = await client.ping();\nconsole.log("Connected:", status.ok); // true'),
  heading(2, text("Step 3: Make Your First Request")),
  codeBlock("typescript", '// Create a new document\nconst doc = await client.documents.create({\n  title: "Hello World",\n  content: "Welcome to Acme Platform!",\n  published: true,\n});\n\nconsole.log("Created:", doc.id);'),
  callout("success", text("That's it! You've successfully connected to Acme Platform and created your first document.")),
  heading(2, text("Next Steps")),
  bulletItem(text("Read the "), link("Core Concepts", "/getting-started/concepts"), text(" guide")),
  bulletItem(text("Explore the "), link("API Reference", "/api-reference/overview"), text(" for all available endpoints")),
  bulletItem(text("Set up "), link("Authentication", "/guides/authentication"), text(" for your users")),
]);

const authenticationGuideContent = toContent([
  heading(1, text("Authentication")),
  paragraph(text("Acme Auth provides a complete authentication solution with support for email/password, social login (Google, GitHub, Microsoft), SSO via SAML, and multi-factor authentication.")),
  heading(2, text("How It Works")),
  paragraph(text("Authentication in Acme uses short-lived JWTs (JSON Web Tokens) for API access paired with refresh tokens for session management. Here's the typical flow:")),
  numberedItem(text("User submits credentials (email/password, OAuth redirect, or SSO)")),
  numberedItem(text("Acme Auth validates and issues an access token (15 min TTL) and refresh token (30 day TTL)")),
  numberedItem(text("Your application includes the access token in API requests via the "), text("Authorization", { code: true }), text(" header")),
  numberedItem(text("When the access token expires, the SDK automatically refreshes it using the refresh token")),
  callout("warning", text("Never expose your API secret key in client-side code. Use environment variables and server-side endpoints for sensitive operations.")),
  heading(2, text("Setting Up Authentication")),
  codeBlock("typescript", 'import { AcmeAuth } from "@acme/sdk/auth";\n\nconst auth = new AcmeAuth({\n  apiKey: process.env.ACME_API_KEY,\n  redirectUrl: "https://yourapp.com/callback",\n  providers: ["email", "google", "github"],\n});\n\n// Start the login flow\nconst { url } = await auth.createLoginUrl();\n// Redirect user to `url`'),
  heading(2, text("Protecting API Routes")),
  paragraph(text("Use the middleware to protect your API endpoints:")),
  codeBlock("typescript", 'import { withAuth } from "@acme/sdk/middleware";\n\nexport const GET = withAuth(async (req, { user }) => {\n  // `user` is the authenticated user object\n  return Response.json({ message: `Hello, ${user.name}!` });\n});'),
  heading(2, text("Role-Based Access Control")),
  paragraph(text("Acme supports four built-in roles: "), text("owner", { code: true }), text(", "), text("admin", { code: true }), text(", "), text("editor", { code: true }), text(", and "), text("viewer", { code: true }), text(". You can also define custom roles for fine-grained permissions.")),
  codeBlock("typescript", 'await client.members.updateRole({\n  userId: "user_xyz",\n  role: "editor",\n  permissions: ["documents.write", "comments.create"],\n});'),
]);

const apiOverviewContent = toContent([
  heading(1, text("API Overview")),
  paragraph(text("The Acme REST API gives you programmatic access to every feature of the platform. All endpoints follow consistent conventions for authentication, pagination, error handling, and rate limiting.")),
  heading(2, text("Base URL")),
  codeBlock("text", "https://api.acme.dev/v1"),
  heading(2, text("Authentication")),
  paragraph(text("All API requests require a valid API key passed in the "), text("Authorization", { code: true }), text(" header:")),
  codeBlock("bash", 'curl -H "Authorization: Bearer ik_live_abc123..." \\\n  https://api.acme.dev/v1/projects'),
  heading(2, text("Response Format")),
  paragraph(text("All responses return JSON with a consistent envelope:")),
  codeBlock("json", '{\n  "data": { ... },\n  "meta": {\n    "requestId": "req_abc123",\n    "timestamp": "2026-03-25T10:30:00Z"\n  }\n}'),
  heading(2, text("Error Handling")),
  paragraph(text("Errors follow RFC 7807 Problem Details format:")),
  codeBlock("json", '{\n  "type": "https://api.acme.dev/errors/validation",\n  "title": "Validation Error",\n  "status": 422,\n  "detail": "The field `email` must be a valid email address.",\n  "instance": "/v1/users",\n  "errors": [\n    { "field": "email", "message": "Invalid email format" }\n  ]\n}'),
  heading(2, text("Rate Limiting")),
  paragraph(text("API requests are rate-limited per API key:")),
  bulletItem(text("Free tier: ", { bold: true }), text("100 requests/minute")),
  bulletItem(text("Pro tier: ", { bold: true }), text("1,000 requests/minute")),
  bulletItem(text("Enterprise: ", { bold: true }), text("10,000 requests/minute")),
  callout("info", text("Rate limit headers ("), text("X-RateLimit-Remaining", { code: true }), text(", "), text("X-RateLimit-Reset", { code: true }), text(") are included in every response.")),
]);

const webhooksGuideContent = toContent([
  heading(1, text("Webhooks")),
  paragraph(text("Webhooks let you receive real-time notifications when events occur in your Acme project. Instead of polling the API, configure a webhook endpoint and Acme will send HTTP POST requests with event payloads.")),
  heading(2, text("Supported Events")),
  bulletItem(text("deployment.ready", { code: true }), text(" — A deployment has completed successfully")),
  bulletItem(text("deployment.error", { code: true }), text(" — A deployment has failed")),
  bulletItem(text("document.published", { code: true }), text(" — A page has been published")),
  bulletItem(text("document.updated", { code: true }), text(" — A page's content has changed")),
  bulletItem(text("member.invited", { code: true }), text(" — A new team member was invited")),
  bulletItem(text("member.joined", { code: true }), text(" — An invitation was accepted")),
  heading(2, text("Configuring Webhooks")),
  codeBlock("typescript", 'const webhook = await client.webhooks.create({\n  url: "https://yourapp.com/api/webhooks/acme",\n  events: ["deployment.ready", "deployment.error"],\n  secret: "whsec_your_signing_secret",\n});'),
  heading(2, text("Verifying Signatures")),
  paragraph(text("Always verify webhook signatures to ensure requests are genuine:")),
  codeBlock("typescript", 'import { verifyWebhookSignature } from "@acme/sdk/webhooks";\n\nexport async function POST(req: Request) {\n  const payload = await req.text();\n  const signature = req.headers.get("X-Acme-Signature");\n\n  const isValid = verifyWebhookSignature({\n    payload,\n    signature,\n    secret: process.env.WEBHOOK_SECRET,\n  });\n\n  if (!isValid) {\n    return new Response("Invalid signature", { status: 401 });\n  }\n\n  const event = JSON.parse(payload);\n  // Handle the event...\n}'),
  callout("warning", text("Webhook endpoints must respond with a 2xx status within 30 seconds. After 3 consecutive failures, the webhook will be automatically disabled.")),
]);

const dataModelContent = toContent([
  heading(1, text("Data Model")),
  paragraph(text("Acme Platform uses a document-oriented data model optimized for real-time collaboration. Understanding the core entities and their relationships will help you make the most of the API.")),
  heading(2, text("Core Entities")),
  heading(3, text("Projects")),
  paragraph(text("A project is the top-level container for your documentation site. Each project has its own slug, custom domain, theme settings, and deployment pipeline.")),
  codeBlock("typescript", 'interface Project {\n  id: string;\n  name: string;\n  slug: string;\n  description?: string;\n  isPublic: boolean;\n  plan: "free" | "pro" | "ultimate";\n  settings: ProjectSettings;\n  createdAt: string;\n  updatedAt: string;\n}'),
  heading(3, text("Pages")),
  paragraph(text("Pages are the fundamental content unit. Each page belongs to a branch and optionally to a folder. Page content is stored as a structured block tree (BlockNote JSON).")),
  heading(3, text("Branches")),
  paragraph(text("Branches enable parallel editing workflows. Every project has a default branch (typically "), text("main", { code: true }), text("). Feature branches can be created for draft work and merged back via merge requests.")),
  callout("info", text("Branches in Acme work similarly to Git branches but operate on structured document content rather than raw files.")),
  heading(2, text("Relationships")),
  codeBlock("text", "Organization\n  └── Project\n       ├── Branch (main)\n       │    ├── Folder (Getting Started)\n       │    │    ├── Page (Introduction)\n       │    │    ├── Page (Quickstart)\n       │    │    └── Page (Concepts)\n       │    └── Folder (API Reference)\n       │         ├── Page (Overview)\n       │         └── Page (Authentication)\n       ├── Branch (feature/new-api-docs)\n       │    └── ... (forked pages)\n       └── Deployments\n            ├── Production (live)\n            └── Preview (draft)"),
]);

const deploymentGuideContent = toContent([
  heading(1, text("Deployments")),
  paragraph(text("Deploy your documentation to Acme's global edge network with a single click. Every deployment is atomic — your readers always see a consistent snapshot of your docs.")),
  heading(2, text("Deployment Targets")),
  bulletItem(text("Production", { bold: true }), text(" — Your live documentation site, accessible via your custom domain or the default "), text("*.inkloom.dev", { code: true }), text(" URL")),
  bulletItem(text("Preview", { bold: true }), text(" — Temporary deployments for reviewing changes before going live")),
  heading(2, text("Deployment Pipeline")),
  paragraph(text("When you click Publish, Acme runs a three-phase deployment pipeline:")),
  numberedItem(text("Build", { bold: true }), text(" — Content is compiled, assets are optimized, and the static site is generated")),
  numberedItem(text("Deploy", { bold: true }), text(" — Built artifacts are uploaded to the edge CDN across 50+ global locations")),
  numberedItem(text("Propagate", { bold: true }), text(" — DNS and cache propagation (typically under 60 seconds)")),
  callout("success", text("Average deployment time is under 30 seconds for most projects.")),
  heading(2, text("Rollbacks")),
  paragraph(text("Every deployment is versioned. Roll back to any previous deployment instantly from the deployment history:")),
  codeBlock("bash", "# Via CLI\nacme deploy rollback --to dep_prev_abc123\n\n# Via API\ncurl -X POST https://api.acme.dev/v1/deployments/rollback \\\n  -H 'Authorization: Bearer ik_live_...' \\\n  -d '{\"deploymentId\": \"dep_prev_abc123\"}'"),
  heading(2, text("Custom Domains")),
  paragraph(text("Connect your own domain (e.g., "), text("docs.acme.com", { code: true }), text(") by adding a CNAME record:")),
  codeBlock("text", "docs.acme.com  CNAME  proxy.inkloom.dev"),
  paragraph(text("SSL certificates are provisioned automatically via Let's Encrypt. Full propagation typically completes within 10 minutes.")),
]);

const sdkReferenceContent = toContent([
  heading(1, text("SDK Reference")),
  paragraph(text("The Acme SDK is available for JavaScript/TypeScript, Python, Go, and Ruby. All SDKs follow the same API surface and are auto-generated from our OpenAPI specification.")),
  heading(2, text("Installation")),
  codeBlock("bash", "# JavaScript / TypeScript\nnpm install @acme/sdk\n\n# Python\npip install acme-sdk\n\n# Go\ngo get github.com/acme/acme-go\n\n# Ruby\ngem install acme-sdk"),
  heading(2, text("Client Initialization")),
  codeBlock("typescript", 'import { AcmeClient } from "@acme/sdk";\n\nconst client = new AcmeClient({\n  apiKey: process.env.ACME_API_KEY,\n  // Optional: override the base URL for self-hosted instances\n  baseUrl: "https://api.acme.dev/v1",\n  // Optional: request timeout in milliseconds (default: 30000)\n  timeout: 10_000,\n  // Optional: automatic retries for transient errors (default: 2)\n  maxRetries: 3,\n});'),
  heading(2, text("Available Modules")),
  bulletItem(text("client.projects", { code: true }), text(" — CRUD operations for projects")),
  bulletItem(text("client.pages", { code: true }), text(" — Page management and content updates")),
  bulletItem(text("client.deployments", { code: true }), text(" — Deployment lifecycle management")),
  bulletItem(text("client.members", { code: true }), text(" — Team and role management")),
  bulletItem(text("client.webhooks", { code: true }), text(" — Webhook configuration")),
  bulletItem(text("client.auth", { code: true }), text(" — Authentication helpers")),
  callout("info", text("All methods return typed responses. TypeScript users get full IntelliSense support out of the box.")),
]);

const changelogContent = toContent([
  heading(1, text("Changelog")),
  paragraph(text("A chronological list of notable changes, new features, and bug fixes for the Acme Platform.")),
  divider(),
  heading(2, text("v2.4.0 — March 2026")),
  heading(3, text("New Features")),
  bulletItem(text("Branch-level permissions", { bold: true }), text(" — Lock branches to specific roles to prevent accidental edits")),
  bulletItem(text("Real-time collaboration", { bold: true }), text(" — See live cursors and edits from team members (Ultimate plan)")),
  bulletItem(text("OpenAPI auto-sync", { bold: true }), text(" — Automatically regenerate API reference pages when your spec changes")),
  heading(3, text("Improvements")),
  bulletItem(text("Deployment times reduced by 40% with incremental builds")),
  bulletItem(text("Search now supports fuzzy matching and typo tolerance")),
  bulletItem(text("Custom domain SSL provisioning is now under 2 minutes")),
  heading(3, text("Bug Fixes")),
  bulletItem(text("Fixed merge conflict resolution losing inline formatting")),
  bulletItem(text("Fixed code block syntax highlighting for Rust and Swift")),
  divider(),
  heading(2, text("v2.3.0 — February 2026")),
  heading(3, text("New Features")),
  bulletItem(text("AI doc generation", { bold: true }), text(" — Generate documentation from your codebase using AI")),
  bulletItem(text("Version history", { bold: true }), text(" — View and restore previous versions of any page")),
  bulletItem(text("Webhook events", { bold: true }), text(" — Subscribe to real-time notifications for deployments and content changes")),
]);

const migrationGuideContent = toContent([
  heading(1, text("Migration Guide")),
  paragraph(text("Moving to Acme from another documentation platform? This guide covers the most common migration paths.")),
  heading(2, text("From Mintlify")),
  paragraph(text("Acme can import Mintlify projects directly from your GitHub repository:")),
  numberedItem(text("Connect your GitHub repo in Project Settings → Integrations")),
  numberedItem(text("Select \"Import from Mintlify\" as the migration source")),
  numberedItem(text("Review the import preview to verify page mappings")),
  numberedItem(text("Click \"Start Migration\" — your content will be converted and imported")),
  callout("info", text("Mintlify MDX components are automatically mapped to Acme equivalents. Custom components may require manual adjustment.")),
  heading(2, text("From GitBook")),
  paragraph(text("GitBook exports can be imported via the Acme CLI:")),
  codeBlock("bash", "# Export from GitBook\ngitbook export --format markdown ./my-docs\n\n# Import into Acme\nacme import ./my-docs --format gitbook --project proj_abc123"),
  heading(2, text("From Markdown Files")),
  paragraph(text("Any directory of Markdown or MDX files can be imported:")),
  codeBlock("bash", "acme import ./docs --format markdown --project proj_abc123"),
  callout("tip", text("After migration, review your navigation structure and page ordering. The importer preserves directory structure but you may want to reorganize for optimal readability.")),
]);

// ── Seed Function ────────────────────────────────────────────────────

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    // NOTE: Call seed:clearTable for each table before running this.
    // The old clearAllTables function hit Convex's byte-read limit.

    // Create users (team members with different roles)
    const alexId = await ctx.db.insert("users", {
      workosUserId: "seed_user_alex",
      email: "alex.chen@acme.dev",
      name: "Alex Chen",
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=AlexChen",
      authProvider: "google",
      onboardingCompletedAt: ts(90),
      createdAt: ts(90),
      updatedAt: ts(0, 2),
    });

    const sarahId = await ctx.db.insert("users", {
      workosUserId: "seed_user_sarah",
      email: "sarah.martinez@acme.dev",
      name: "Sarah Martinez",
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=SarahMartinez",
      authProvider: "github",
      onboardingCompletedAt: ts(60),
      createdAt: ts(60),
      updatedAt: ts(1),
    });

    const jordanId = await ctx.db.insert("users", {
      workosUserId: "seed_user_jordan",
      email: "jordan.lee@acme.dev",
      name: "Jordan Lee",
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=JordanLee",
      authProvider: "email",
      onboardingCompletedAt: ts(30),
      createdAt: ts(30),
      updatedAt: ts(3),
    });

    // ── Project 1: Acme Platform Docs (published, main project) ──────

    const acmeProjectId = await ctx.db.insert("projects", {
      workosOrgId: "test_org_01",
      name: "Acme Platform Docs",
      slug: "acme-platform-docs",
      description: "Comprehensive documentation for the Acme developer platform — APIs, SDKs, guides, and references.",
      isPublic: true,
      plan: "ultimate",
      settings: {
        theme: "default",
        primaryColor: "#6366F1",
        fonts: { heading: "Inter", body: "Inter", code: "Fira Code" },
        customDomain: "docs.acme.com",
        seo: {
          ogTitle: "Acme Platform Documentation",
          ogDescription: "Everything you need to build with the Acme developer platform.",
          twitterCard: "summary_large_image",
        },
        socialLinks: [
          { platform: "github", url: "https://github.com/acme" },
          { platform: "x", url: "https://x.com/acmedev" },
          { platform: "discord", url: "https://discord.gg/acmedev" },
        ],
        accessControl: { mode: "public" },
        defaultThemeMode: "system",
        ctaButton: { label: "Get Started", url: "/getting-started/quickstart" },
      },
      createdBy: "seed_user_alex",
      createdAt: ts(60),
      updatedAt: ts(0, 1),
    });

    // Main branch
    const acmeMainBranchId = await ctx.db.insert("branches", {
      projectId: acmeProjectId,
      name: "main",
      isDefault: true,
      isLocked: false,
      createdBy: alexId,
      createdAt: ts(60),
      updatedAt: ts(0, 1),
    });

    // Update project with default branch
    await ctx.db.patch(acmeProjectId, { defaultBranchId: acmeMainBranchId });

    // Feature branches
    const newApiDocsBranchId = await ctx.db.insert("branches", {
      projectId: acmeProjectId,
      name: "feature/new-api-docs",
      isDefault: false,
      isLocked: false,
      sourceBranchId: acmeMainBranchId,
      createdBy: sarahId,
      createdAt: ts(5),
      updatedAt: ts(1),
    });

    const v2RedesignBranchId = await ctx.db.insert("branches", {
      projectId: acmeProjectId,
      name: "draft/v2-redesign",
      isDefault: false,
      isLocked: false,
      sourceBranchId: acmeMainBranchId,
      createdBy: jordanId,
      createdAt: ts(3),
      updatedAt: ts(0, 6),
    });

    // Folders on main branch
    const gettingStartedFolderId = await ctx.db.insert("folders", {
      branchId: acmeMainBranchId,
      name: "Getting Started",
      slug: "getting-started",
      position: 0,
      path: "/getting-started",
      icon: "rocket",
      createdAt: ts(60),
      updatedAt: ts(10),
    });

    const apiReferenceFolderId = await ctx.db.insert("folders", {
      branchId: acmeMainBranchId,
      name: "API Reference",
      slug: "api-reference",
      position: 1,
      path: "/api-reference",
      icon: "code",
      createdAt: ts(55),
      updatedAt: ts(5),
    });

    const guidesFolderId = await ctx.db.insert("folders", {
      branchId: acmeMainBranchId,
      name: "Guides",
      slug: "guides",
      position: 2,
      path: "/guides",
      icon: "book-open",
      createdAt: ts(50),
      updatedAt: ts(2),
    });

    const sdksFolderId = await ctx.db.insert("folders", {
      branchId: acmeMainBranchId,
      name: "SDKs & Libraries",
      slug: "sdks",
      position: 3,
      path: "/sdks",
      icon: "package",
      createdAt: ts(45),
      updatedAt: ts(7),
    });

    const changelogFolderId = await ctx.db.insert("folders", {
      branchId: acmeMainBranchId,
      name: "Changelog",
      slug: "changelog",
      position: 4,
      path: "/changelog",
      icon: "clock",
      createdAt: ts(40),
      updatedAt: ts(1),
    });

    // Helper to create a page with content and optional versions
    async function createPage(opts: {
      branchId: Id<"branches">;
      folderId?: Id<"folders">;
      title: string;
      slug: string;
      path: string;
      position: number;
      isPublished: boolean;
      description?: string;
      icon?: string;
      content: string;
      createdAt: number;
      updatedAt: number;
      updatedBy?: Id<"users">;
      versions?: Array<{ version: number; content: string; createdBy: Id<"users">; message?: string; createdAt: number }>;
    }): Promise<Id<"pages">> {
      const pageId = await ctx.db.insert("pages", {
        branchId: opts.branchId,
        folderId: opts.folderId,
        title: opts.title,
        slug: opts.slug,
        path: opts.path,
        position: opts.position,
        isPublished: opts.isPublished,
        description: opts.description,
        icon: opts.icon,
        createdAt: opts.createdAt,
        updatedAt: opts.updatedAt,
      });

      await ctx.db.insert("pageContents", {
        pageId,
        content: opts.content,
        updatedBy: opts.updatedBy,
        updatedAt: opts.updatedAt,
      });

      if (opts.versions) {
        for (const v of opts.versions) {
          await ctx.db.insert("pageVersions", {
            pageId,
            version: v.version,
            content: v.content,
            createdBy: v.createdBy,
            message: v.message,
            createdAt: v.createdAt,
          });
        }
      }

      return pageId;
    }

    // ── Pages: Getting Started ───────────────────────────────────────

    const introPageId = await createPage({
      branchId: acmeMainBranchId,
      folderId: gettingStartedFolderId,
      title: "Introduction",
      slug: "introduction",
      path: "/getting-started/introduction",
      position: 0,
      isPublished: true,
      description: "Welcome to Acme Platform — learn what you can build and how to get started.",
      icon: "home",
      content: introductionContent,
      createdAt: ts(60),
      updatedAt: ts(2),
      updatedBy: alexId,
      versions: [
        { version: 1, content: introductionContent, createdBy: alexId, message: "Initial draft", createdAt: ts(60) },
        { version: 2, content: introductionContent, createdBy: sarahId, message: "Added platform overview section", createdAt: ts(30) },
        { version: 3, content: introductionContent, createdBy: alexId, message: "Updated feature descriptions for v2.4", createdAt: ts(5) },
        { version: 4, content: introductionContent, createdBy: jordanId, message: "Fixed typos and improved clarity", createdAt: ts(2) },
      ],
    });

    await createPage({
      branchId: acmeMainBranchId,
      folderId: gettingStartedFolderId,
      title: "Quickstart",
      slug: "quickstart",
      path: "/getting-started/quickstart",
      position: 1,
      isPublished: true,
      description: "Get up and running with Acme Platform in under 5 minutes.",
      icon: "zap",
      content: quickstartContent,
      createdAt: ts(58),
      updatedAt: ts(5),
      updatedBy: sarahId,
      versions: [
        { version: 1, content: quickstartContent, createdBy: alexId, message: "Initial quickstart guide", createdAt: ts(58) },
        { version: 2, content: quickstartContent, createdBy: sarahId, message: "Updated code examples for SDK v3", createdAt: ts(5) },
      ],
    });

    const conceptsContent = toContent([
      heading(1, text("Core Concepts")),
      paragraph(text("Before diving deeper, familiarize yourself with the key concepts that underpin the Acme Platform.")),
      heading(2, text("Projects")),
      paragraph(text("A project is the top-level container for a documentation site. Each project has a unique slug, its own branch history, theme configuration, and deployment pipeline.")),
      heading(2, text("Branches")),
      paragraph(text("Branches let you work on documentation changes in isolation. The "), text("main", { code: true }), text(" branch is your production content. Create feature branches for drafts and review them through merge requests.")),
      heading(2, text("Pages & Folders")),
      paragraph(text("Content is organized into pages (individual documents) and folders (grouping containers). Pages hold structured block content — headings, paragraphs, code blocks, callouts, and more.")),
      heading(2, text("Deployments")),
      paragraph(text("When you're ready to go live, publish your changes. Acme builds a static site from your content and deploys it to our global edge network in seconds.")),
      callout("tip", text("Think of Acme like GitHub for documentation — projects are repos, branches are branches, and publishing is deploying.")),
    ]);

    await createPage({
      branchId: acmeMainBranchId,
      folderId: gettingStartedFolderId,
      title: "Core Concepts",
      slug: "concepts",
      path: "/getting-started/concepts",
      position: 2,
      isPublished: true,
      description: "Understand the fundamental building blocks of the Acme Platform.",
      icon: "lightbulb",
      content: conceptsContent,
      createdAt: ts(55),
      updatedAt: ts(10),
      updatedBy: alexId,
    });

    // ── Pages: API Reference ─────────────────────────────────────────

    await createPage({
      branchId: acmeMainBranchId,
      folderId: apiReferenceFolderId,
      title: "Overview",
      slug: "overview",
      path: "/api-reference/overview",
      position: 0,
      isPublished: true,
      description: "REST API conventions, authentication, rate limits, and error handling.",
      icon: "globe",
      content: apiOverviewContent,
      createdAt: ts(50),
      updatedAt: ts(3),
      updatedBy: sarahId,
    });

    const authEndpointContent = toContent([
      heading(1, text("Authentication Endpoints")),
      paragraph(text("Endpoints for managing user authentication, sessions, and API keys.")),
      heading(2, text("POST /v1/auth/login")),
      paragraph(text("Authenticate a user and receive access and refresh tokens.")),
      codeBlock("bash", 'curl -X POST https://api.acme.dev/v1/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "email": "user@example.com",\n    "password": "secure-password"\n  }\''),
      heading(3, text("Response")),
      codeBlock("json", '{\n  "data": {\n    "accessToken": "eyJhbGciOi...",\n    "refreshToken": "rt_abc123...",\n    "expiresIn": 900,\n    "user": {\n      "id": "user_xyz",\n      "email": "user@example.com",\n      "name": "Jane Developer"\n    }\n  }\n}'),
      heading(2, text("POST /v1/auth/refresh")),
      paragraph(text("Exchange a refresh token for a new access token.")),
      heading(2, text("DELETE /v1/auth/sessions")),
      paragraph(text("Revoke all active sessions for the authenticated user.")),
    ]);

    await createPage({
      branchId: acmeMainBranchId,
      folderId: apiReferenceFolderId,
      title: "Authentication Endpoints",
      slug: "authentication",
      path: "/api-reference/authentication",
      position: 1,
      isPublished: true,
      description: "Login, token refresh, and session management API endpoints.",
      icon: "lock",
      content: authEndpointContent,
      createdAt: ts(48),
      updatedAt: ts(4),
      updatedBy: sarahId,
    });

    await createPage({
      branchId: acmeMainBranchId,
      folderId: apiReferenceFolderId,
      title: "Documents API",
      slug: "documents",
      path: "/api-reference/documents",
      position: 2,
      isPublished: true,
      description: "Create, read, update, and delete documentation pages via the API.",
      icon: "file-text",
      content: dataModelContent,
      createdAt: ts(45),
      updatedAt: ts(6),
      updatedBy: alexId,
    });

    // ── Pages: Guides ────────────────────────────────────────────────

    const authGuidePageId = await createPage({
      branchId: acmeMainBranchId,
      folderId: guidesFolderId,
      title: "Authentication",
      slug: "authentication",
      path: "/guides/authentication",
      position: 0,
      isPublished: true,
      description: "Set up user authentication with email, social login, and SSO.",
      icon: "shield",
      content: authenticationGuideContent,
      createdAt: ts(40),
      updatedAt: ts(1),
      updatedBy: sarahId,
    });

    await createPage({
      branchId: acmeMainBranchId,
      folderId: guidesFolderId,
      title: "Webhooks",
      slug: "webhooks",
      path: "/guides/webhooks",
      position: 1,
      isPublished: true,
      description: "Receive real-time event notifications via HTTP webhooks.",
      icon: "webhook",
      content: webhooksGuideContent,
      createdAt: ts(35),
      updatedAt: ts(2),
      updatedBy: jordanId,
    });

    await createPage({
      branchId: acmeMainBranchId,
      folderId: guidesFolderId,
      title: "Deployments",
      slug: "deployments",
      path: "/guides/deployments",
      position: 2,
      isPublished: true,
      description: "Deploy your docs to production with custom domains and rollback support.",
      icon: "rocket",
      content: deploymentGuideContent,
      createdAt: ts(30),
      updatedAt: ts(3),
      updatedBy: alexId,
    });

    await createPage({
      branchId: acmeMainBranchId,
      folderId: guidesFolderId,
      title: "Migration Guide",
      slug: "migration",
      path: "/guides/migration",
      position: 3,
      isPublished: false, // Draft page
      description: "Migrate from Mintlify, GitBook, or plain Markdown to Acme.",
      icon: "arrow-right-left",
      content: migrationGuideContent,
      createdAt: ts(10),
      updatedAt: ts(1),
      updatedBy: jordanId,
    });

    // ── Pages: SDKs ──────────────────────────────────────────────────

    await createPage({
      branchId: acmeMainBranchId,
      folderId: sdksFolderId,
      title: "SDK Reference",
      slug: "overview",
      path: "/sdks/overview",
      position: 0,
      isPublished: true,
      description: "Client libraries for JavaScript, Python, Go, and Ruby.",
      icon: "package",
      content: sdkReferenceContent,
      createdAt: ts(40),
      updatedAt: ts(7),
      updatedBy: sarahId,
    });

    // ── Pages: Changelog ─────────────────────────────────────────────

    await createPage({
      branchId: acmeMainBranchId,
      folderId: changelogFolderId,
      title: "Changelog",
      slug: "changelog",
      path: "/changelog/changelog",
      position: 0,
      isPublished: true,
      description: "Notable changes, new features, and bug fixes.",
      icon: "clock",
      content: changelogContent,
      createdAt: ts(30),
      updatedAt: ts(0, 12),
      updatedBy: alexId,
    });

    // ── Pages on feature branch (for MR diff) ────────────────────────

    // A new page on the feature branch
    await createPage({
      branchId: newApiDocsBranchId,
      title: "Rate Limiting",
      slug: "rate-limiting",
      path: "/api-reference/rate-limiting",
      position: 3,
      isPublished: false,
      description: "Understand and configure API rate limits for your project.",
      icon: "gauge",
      content: toContent([
        heading(1, text("Rate Limiting")),
        paragraph(text("The Acme API uses a sliding-window rate limiter to ensure fair usage across all customers. Rate limits are applied per API key.")),
        heading(2, text("Default Limits")),
        codeBlock("json", '{\n  "free": { "requestsPerMinute": 100, "burstLimit": 20 },\n  "pro": { "requestsPerMinute": 1000, "burstLimit": 200 },\n  "enterprise": { "requestsPerMinute": 10000, "burstLimit": 2000 }\n}'),
        heading(2, text("Rate Limit Headers")),
        paragraph(text("Every response includes rate limit information:")),
        bulletItem(text("X-RateLimit-Limit", { code: true }), text(" — Maximum requests per window")),
        bulletItem(text("X-RateLimit-Remaining", { code: true }), text(" — Requests remaining in current window")),
        bulletItem(text("X-RateLimit-Reset", { code: true }), text(" — Unix timestamp when the window resets")),
        callout("warning", text("When rate-limited, the API returns HTTP 429. Implement exponential backoff in your client to handle this gracefully.")),
      ]),
      createdAt: ts(4),
      updatedAt: ts(1),
      updatedBy: sarahId,
    });

    // A modified page on the feature branch
    await createPage({
      branchId: newApiDocsBranchId,
      title: "Error Codes Reference",
      slug: "errors",
      path: "/api-reference/errors",
      position: 4,
      isPublished: false,
      description: "Complete list of API error codes with troubleshooting tips.",
      icon: "alert-triangle",
      content: toContent([
        heading(1, text("Error Codes")),
        paragraph(text("When an API request fails, the response includes a structured error object with a machine-readable error code.")),
        heading(2, text("Common Error Codes")),
        codeBlock("json", '[\n  { "code": "auth/invalid-token", "status": 401, "message": "The access token is invalid or expired" },\n  { "code": "auth/insufficient-permissions", "status": 403, "message": "Your API key does not have permission for this action" },\n  { "code": "resource/not-found", "status": 404, "message": "The requested resource does not exist" },\n  { "code": "validation/invalid-input", "status": 422, "message": "One or more fields failed validation" },\n  { "code": "rate-limit/exceeded", "status": 429, "message": "Too many requests — retry after the rate limit window resets" },\n  { "code": "server/internal-error", "status": 500, "message": "An unexpected error occurred — contact support if this persists" }\n]'),
      ]),
      createdAt: ts(3),
      updatedAt: ts(1),
      updatedBy: sarahId,
    });

    // ── Pages on v2 redesign branch ─────────────────────────────────

    await createPage({
      branchId: v2RedesignBranchId,
      title: "Platform Overview (Redesigned)",
      slug: "platform-overview",
      path: "/getting-started/platform-overview",
      position: 0,
      isPublished: false,
      description: "Redesigned platform overview with interactive architecture diagram.",
      icon: "layout-dashboard",
      content: toContent([
        heading(1, text("Platform Overview")),
        paragraph(text("This is a draft redesign of the platform overview page with an interactive architecture diagram and updated service descriptions.")),
        callout("warning", text("This page is a work in progress — do not merge until the interactive diagrams are finalized.")),
        heading(2, text("Architecture")),
        paragraph(text("The Acme Platform is built on a modular microservices architecture with four core pillars: Auth, Data, Deploy, and Analytics. Each service can be used independently or composed together.")),
      ]),
      createdAt: ts(3),
      updatedAt: ts(0, 6),
      updatedBy: jordanId,
    });

    // ── Merge Request ────────────────────────────────────────────────

    const mrId = await ctx.db.insert("mergeRequests", {
      projectId: acmeProjectId,
      sourceBranchId: newApiDocsBranchId,
      targetBranchId: acmeMainBranchId,
      title: "Add rate limiting docs and error code reference",
      description: "This MR adds two new pages to the API Reference section:\n\n- **Rate Limiting** — explains the sliding-window rate limiter, default limits per plan, and rate limit headers\n- **Error Codes Reference** — comprehensive list of error codes with HTTP statuses and troubleshooting tips\n\nAlso includes minor clarifications to the existing API Overview page.",
      status: "open",
      diffSummary: {
        pagesAdded: 2,
        pagesRemoved: 0,
        pagesModified: 1,
        foldersAdded: 0,
        foldersRemoved: 0,
      },
      createdBy: sarahId,
      createdAt: ts(2),
      updatedAt: ts(0, 3),
    });

    // MR Comments
    await ctx.db.insert("mergeRequestComments", {
      mergeRequestId: mrId,
      content: "Looks great! Could we add a table showing all rate limit tiers side-by-side?",
      createdBy: alexId,
      createdAt: ts(1, 12),
      updatedAt: ts(1, 12),
    });

    await ctx.db.insert("mergeRequestComments", {
      mergeRequestId: mrId,
      pagePath: "/api-reference/rate-limiting",
      blockIndex: 3,
      content: "Good idea — I've added a JSON comparison table. Does this format work?",
      createdBy: sarahId,
      createdAt: ts(1, 6),
      updatedAt: ts(1, 6),
    });

    await ctx.db.insert("mergeRequestComments", {
      mergeRequestId: mrId,
      content: "Perfect, LGTM. Ship it! 🚀",
      createdBy: alexId,
      createdAt: ts(0, 3),
      updatedAt: ts(0, 3),
    });

    // MR Review thread (block-anchored)
    const reviewThreadId = await ctx.db.insert("mrReviewThreads", {
      mergeRequestId: mrId,
      pagePath: "/api-reference/rate-limiting",
      blockId: "block-rate-limit-warning",
      blockIndex: 8,
      quotedContent: "When rate-limited, the API returns HTTP 429.",
      threadType: "comment",
      status: "resolved",
      resolvedBy: sarahId,
      resolvedAt: ts(0, 6),
      createdBy: jordanId,
      createdAt: ts(1),
      updatedAt: ts(0, 6),
    });

    await ctx.db.insert("mrReviewComments", {
      threadId: reviewThreadId,
      content: "Should we mention the Retry-After header here too?",
      createdBy: jordanId,
      createdAt: ts(1),
      updatedAt: ts(1),
      isEdited: false,
    });

    await ctx.db.insert("mrReviewComments", {
      threadId: reviewThreadId,
      content: "Good catch — added it to the response headers section.",
      createdBy: sarahId,
      createdAt: ts(0, 6),
      updatedAt: ts(0, 6),
      isEdited: false,
    });

    // ── Comment Threads on pages ─────────────────────────────────────

    // Open comment thread on Introduction page
    const thread1Id = await ctx.db.insert("commentThreads", {
      pageId: introPageId,
      blockId: "block-platform-overview",
      anchorType: "block",
      status: "open",
      createdBy: jordanId,
      createdAt: ts(3),
      updatedAt: ts(1),
    });

    await ctx.db.insert("comments", {
      threadId: thread1Id,
      content: "Should we add Acme Functions to the platform overview? It launched last month.",
      createdBy: jordanId,
      createdAt: ts(3),
      updatedAt: ts(3),
      isEdited: false,
    });

    await ctx.db.insert("comments", {
      threadId: thread1Id,
      content: "Agreed — I'll add it in the next update along with the serverless edge functions docs.",
      createdBy: alexId,
      createdAt: ts(2),
      updatedAt: ts(2),
      isEdited: false,
    });

    // Resolved comment thread on Auth guide
    const thread2Id = await ctx.db.insert("commentThreads", {
      pageId: authGuidePageId,
      blockId: "block-auth-warning",
      anchorType: "inline",
      inlineStart: 0,
      inlineEnd: 45,
      quotedText: "Never expose your API secret key in client-side code",
      status: "resolved",
      createdBy: sarahId,
      createdAt: ts(10),
      updatedAt: ts(8),
    });

    await ctx.db.insert("comments", {
      threadId: thread2Id,
      content: "Can we make this callout more prominent? Maybe use the 'danger' type instead of 'warning'?",
      createdBy: sarahId,
      createdAt: ts(10),
      updatedAt: ts(10),
      isEdited: false,
    });

    await ctx.db.insert("comments", {
      threadId: thread2Id,
      content: "Done — changed to danger callout and added example of what NOT to do.",
      createdBy: alexId,
      createdAt: ts(8),
      updatedAt: ts(8),
      isEdited: false,
    });

    // Another open thread with inline anchor
    const thread3Id = await ctx.db.insert("commentThreads", {
      pageId: introPageId,
      blockId: "block-next-steps",
      anchorType: "inline",
      inlineStart: 10,
      inlineEnd: 35,
      quotedText: "unified billing",
      status: "open",
      createdBy: sarahId,
      createdAt: ts(1),
      updatedAt: ts(1),
    });

    await ctx.db.insert("comments", {
      threadId: thread3Id,
      content: "We should link this to the billing docs page once it's published.",
      createdBy: sarahId,
      createdAt: ts(1),
      updatedAt: ts(1),
      isEdited: false,
    });

    // ── Project Members ──────────────────────────────────────────────

    await ctx.db.insert("projectMembers", {
      projectId: acmeProjectId,
      userId: alexId,
      role: "admin",
      createdAt: ts(60),
      updatedAt: ts(60),
    });

    await ctx.db.insert("projectMembers", {
      projectId: acmeProjectId,
      userId: sarahId,
      role: "editor",
      createdAt: ts(55),
      updatedAt: ts(55),
    });

    await ctx.db.insert("projectMembers", {
      projectId: acmeProjectId,
      userId: jordanId,
      role: "viewer",
      createdAt: ts(30),
      updatedAt: ts(30),
    });

    // ── Deployments for Acme Platform Docs ───────────────────────────

    const liveDeploymentId = await ctx.db.insert("deployments", {
      projectId: acmeProjectId,
      branchId: acmeMainBranchId,
      status: "ready",
      target: "production",
      url: "https://docs.acme.com",
      createdBy: alexId,
      createdAt: ts(0, 4),
      updatedAt: ts(0, 3),
    });

    await ctx.db.insert("deployments", {
      projectId: acmeProjectId,
      branchId: acmeMainBranchId,
      status: "ready",
      target: "production",
      url: "https://docs.acme.com",
      createdBy: sarahId,
      createdAt: ts(3),
      updatedAt: ts(3),
    });

    await ctx.db.insert("deployments", {
      projectId: acmeProjectId,
      branchId: acmeMainBranchId,
      status: "ready",
      target: "production",
      url: "https://docs.acme.com",
      createdBy: alexId,
      createdAt: ts(7),
      updatedAt: ts(7),
    });

    await ctx.db.insert("deployments", {
      projectId: acmeProjectId,
      branchId: newApiDocsBranchId,
      status: "ready",
      target: "preview",
      url: "https://feature-new-api-docs.preview.inkloom.dev",
      createdBy: sarahId,
      createdAt: ts(2),
      updatedAt: ts(2),
    });

    // Deployment config
    await ctx.db.insert("deploymentConfigs", {
      projectId: acmeProjectId,
      liveDeploymentId,
      productionUrl: "https://docs.acme.com",
      createdAt: ts(60),
      updatedAt: ts(0, 4),
    });

    // ── Branch Snapshot (for merge diff) ─────────────────────────────

    await ctx.db.insert("branchSnapshots", {
      branchId: newApiDocsBranchId,
      sourceBranchId: acmeMainBranchId,
      pageHashes: JSON.stringify({}),
      folderPaths: JSON.stringify(["/api-reference"]),
      createdAt: ts(5),
    });

    // ── Project 2: Acme SDK Reference (published, building) ──────────

    const sdkProjectId = await ctx.db.insert("projects", {
      workosOrgId: "test_org_01",
      name: "Acme SDK Reference",
      slug: "acme-sdk-reference",
      description: "Auto-generated SDK reference documentation for all Acme client libraries.",
      isPublic: true,
      plan: "pro",
      settings: {
        theme: "midnight",
        primaryColor: "#3B82F6",
        fonts: { heading: "Inter", body: "Inter", code: "JetBrains Mono" },
        defaultThemeMode: "dark",
      },
      createdBy: "seed_user_sarah",
      createdAt: ts(30),
      updatedAt: ts(0, 2),
    });

    const sdkMainBranchId = await ctx.db.insert("branches", {
      projectId: sdkProjectId,
      name: "main",
      isDefault: true,
      isLocked: false,
      createdBy: sarahId,
      createdAt: ts(30),
      updatedAt: ts(0, 2),
    });

    await ctx.db.patch(sdkProjectId, { defaultBranchId: sdkMainBranchId });

    const jsClientFolderId = await ctx.db.insert("folders", {
      branchId: sdkMainBranchId,
      name: "JavaScript Client",
      slug: "javascript",
      position: 0,
      path: "/javascript",
      icon: "braces",
      createdAt: ts(28),
      updatedAt: ts(5),
    });

    const pythonClientFolderId = await ctx.db.insert("folders", {
      branchId: sdkMainBranchId,
      name: "Python Client",
      slug: "python",
      position: 1,
      path: "/python",
      icon: "terminal",
      createdAt: ts(28),
      updatedAt: ts(3),
    });

    await createPage({
      branchId: sdkMainBranchId,
      folderId: jsClientFolderId,
      title: "Installation",
      slug: "installation",
      path: "/javascript/installation",
      position: 0,
      isPublished: true,
      description: "Install and configure the Acme JavaScript SDK.",
      content: toContent([
        heading(1, text("JavaScript SDK Installation")),
        paragraph(text("Install the official Acme JavaScript/TypeScript SDK using your preferred package manager.")),
        codeBlock("bash", "# npm\nnpm install @acme/sdk\n\n# yarn\nyarn add @acme/sdk\n\n# pnpm\npnpm add @acme/sdk"),
        heading(2, text("Requirements")),
        bulletItem(text("Node.js 18 or later")),
        bulletItem(text("TypeScript 5.0+ (optional but recommended)")),
        heading(2, text("Quick Setup")),
        codeBlock("typescript", 'import { AcmeClient } from "@acme/sdk";\n\nconst client = new AcmeClient({\n  apiKey: process.env.ACME_API_KEY,\n});'),
      ]),
      createdAt: ts(28),
      updatedAt: ts(5),
      updatedBy: sarahId,
    });

    await createPage({
      branchId: sdkMainBranchId,
      folderId: jsClientFolderId,
      title: "Configuration",
      slug: "configuration",
      path: "/javascript/configuration",
      position: 1,
      isPublished: true,
      description: "Configure timeouts, retries, and custom headers.",
      content: toContent([
        heading(1, text("Configuration")),
        paragraph(text("The Acme SDK supports extensive configuration for production environments.")),
        codeBlock("typescript", 'const client = new AcmeClient({\n  apiKey: process.env.ACME_API_KEY,\n  baseUrl: "https://api.acme.dev/v1",\n  timeout: 10_000,\n  maxRetries: 3,\n  headers: {\n    "X-Custom-Header": "my-value",\n  },\n});'),
      ]),
      createdAt: ts(26),
      updatedAt: ts(4),
      updatedBy: sarahId,
    });

    await createPage({
      branchId: sdkMainBranchId,
      folderId: pythonClientFolderId,
      title: "Installation",
      slug: "installation",
      path: "/python/installation",
      position: 0,
      isPublished: true,
      description: "Install the Acme Python SDK.",
      content: toContent([
        heading(1, text("Python SDK Installation")),
        codeBlock("bash", "pip install acme-sdk\n\n# Or with poetry\npoetry add acme-sdk"),
        heading(2, text("Requirements")),
        bulletItem(text("Python 3.10 or later")),
        bulletItem(text("pip 21+ or Poetry 1.2+")),
      ]),
      createdAt: ts(25),
      updatedAt: ts(3),
      updatedBy: jordanId,
    });

    // Building deployment for SDK Reference
    await ctx.db.insert("deployments", {
      projectId: sdkProjectId,
      branchId: sdkMainBranchId,
      status: "building",
      target: "production",
      buildPhase: "generating",
      createdBy: sarahId,
      createdAt: ts(0, 0),
      updatedAt: ts(0, 0),
    });

    await ctx.db.insert("projectMembers", {
      projectId: sdkProjectId,
      userId: sarahId,
      role: "admin",
      createdAt: ts(30),
      updatedAt: ts(30),
    });

    await ctx.db.insert("projectMembers", {
      projectId: sdkProjectId,
      userId: alexId,
      role: "editor",
      createdAt: ts(28),
      updatedAt: ts(28),
    });

    // ── Project 3: Internal Engineering Handbook (draft, private) ────

    const handbookProjectId = await ctx.db.insert("projects", {
      workosOrgId: "test_org_01",
      name: "Engineering Handbook",
      slug: "engineering-handbook",
      description: "Internal engineering standards, runbooks, and onboarding materials for the Acme team.",
      isPublic: false,
      plan: "pro",
      settings: {
        theme: "forest",
        primaryColor: "#22C55E",
        accessControl: { mode: "login_required" },
      },
      createdBy: "seed_user_jordan",
      createdAt: ts(15),
      updatedAt: ts(0, 6),
    });

    const handbookMainBranchId = await ctx.db.insert("branches", {
      projectId: handbookProjectId,
      name: "main",
      isDefault: true,
      isLocked: false,
      createdBy: jordanId,
      createdAt: ts(15),
      updatedAt: ts(0, 6),
    });

    await ctx.db.patch(handbookProjectId, { defaultBranchId: handbookMainBranchId });

    const onboardingFolderId = await ctx.db.insert("folders", {
      branchId: handbookMainBranchId,
      name: "Onboarding",
      slug: "onboarding",
      position: 0,
      path: "/onboarding",
      icon: "graduation-cap",
      createdAt: ts(15),
      updatedAt: ts(5),
    });

    await createPage({
      branchId: handbookMainBranchId,
      folderId: onboardingFolderId,
      title: "Welcome to Acme Engineering",
      slug: "welcome",
      path: "/onboarding/welcome",
      position: 0,
      isPublished: false,
      description: "Your first-week guide to the Acme engineering team.",
      icon: "heart-handshake",
      content: toContent([
        heading(1, text("Welcome to Acme Engineering!")),
        paragraph(text("Congratulations on joining the team! This handbook contains everything you need to get productive in your first week.")),
        heading(2, text("First Day Checklist")),
        bulletItem(text("Set up your development environment (see "), link("Dev Setup", "/onboarding/dev-setup"), text(")")),
        bulletItem(text("Join #engineering on Slack")),
        bulletItem(text("Review the code review guidelines")),
        bulletItem(text("Ship your first PR (we have a tradition!)")),
        callout("tip", text("Don't worry about breaking things — we have staging environments, feature flags, and rollback capabilities. Move fast and learn.")),
      ]),
      createdAt: ts(15),
      updatedAt: ts(5),
      updatedBy: jordanId,
    });

    await createPage({
      branchId: handbookMainBranchId,
      folderId: onboardingFolderId,
      title: "Development Setup",
      slug: "dev-setup",
      path: "/onboarding/dev-setup",
      position: 1,
      isPublished: false,
      description: "Configure your local development environment for Acme projects.",
      icon: "wrench",
      content: toContent([
        heading(1, text("Development Environment Setup")),
        heading(2, text("Prerequisites")),
        bulletItem(text("macOS 14+ or Ubuntu 22.04+")),
        bulletItem(text("Homebrew (macOS) or apt (Linux)")),
        bulletItem(text("16GB RAM minimum")),
        heading(2, text("Quick Setup")),
        codeBlock("bash", "# Clone the monorepo\ngit clone git@github.com:acme/acme.git\ncd acme\n\n# Install dependencies\npnpm install\n\n# Set up environment variables\ncp .env.example .env.local\n\n# Start all services\npnpm dev"),
        callout("info", text("The dev server starts on port 3000. You'll also need Convex running locally — see the Convex section below.")),
      ]),
      createdAt: ts(14),
      updatedAt: ts(3),
      updatedBy: jordanId,
    });

    await ctx.db.insert("projectMembers", {
      projectId: handbookProjectId,
      userId: jordanId,
      role: "admin",
      createdAt: ts(15),
      updatedAt: ts(15),
    });

    await ctx.db.insert("projectMembers", {
      projectId: handbookProjectId,
      userId: alexId,
      role: "editor",
      createdAt: ts(14),
      updatedAt: ts(14),
    });

    await ctx.db.insert("projectMembers", {
      projectId: handbookProjectId,
      userId: sarahId,
      role: "viewer",
      createdAt: ts(12),
      updatedAt: ts(12),
    });

    // ── Project 4: Acme Blog (published, free tier) ──────────────────

    const blogProjectId = await ctx.db.insert("projects", {
      workosOrgId: "test_org_01",
      name: "Acme Developer Blog",
      slug: "acme-dev-blog",
      description: "Engineering blog with technical deep-dives, launch announcements, and tutorials.",
      isPublic: true,
      plan: "free",
      settings: {
        theme: "ember",
        primaryColor: "#F97316",
        socialLinks: [
          { platform: "x", url: "https://x.com/acmedev" },
          { platform: "github", url: "https://github.com/acme" },
        ],
      },
      createdBy: "seed_user_alex",
      createdAt: ts(20),
      updatedAt: ts(1),
    });

    const blogMainBranchId = await ctx.db.insert("branches", {
      projectId: blogProjectId,
      name: "main",
      isDefault: true,
      isLocked: false,
      createdBy: alexId,
      createdAt: ts(20),
      updatedAt: ts(1),
    });

    await ctx.db.patch(blogProjectId, { defaultBranchId: blogMainBranchId });

    await createPage({
      branchId: blogMainBranchId,
      title: "Introducing Acme Platform v2.4",
      slug: "introducing-v2-4",
      path: "/introducing-v2-4",
      position: 0,
      isPublished: true,
      description: "Real-time collaboration, branch permissions, and OpenAPI auto-sync — here's what's new.",
      icon: "sparkles",
      content: toContent([
        heading(1, text("Introducing Acme Platform v2.4")),
        paragraph(text("Today we're excited to announce Acme Platform v2.4, our biggest release yet. This update brings real-time collaboration, branch-level permissions, and automatic OpenAPI synchronization.")),
        heading(2, text("Real-Time Collaboration")),
        paragraph(text("Teams on the Ultimate plan can now see live cursors and edits from teammates as they happen. No more merge conflicts from simultaneous editing — changes are synchronized in real-time using CRDT technology.")),
        heading(2, text("Branch Permissions")),
        paragraph(text("Lock branches to specific roles to prevent accidental edits to production content. Combine with merge requests for a full editorial workflow.")),
        callout("info", text("Read the full release notes in our "), link("changelog", "/changelog"), text(".")),
      ]),
      createdAt: ts(1),
      updatedAt: ts(1),
      updatedBy: alexId,
    });

    await ctx.db.insert("projectMembers", {
      projectId: blogProjectId,
      userId: alexId,
      role: "admin",
      createdAt: ts(20),
      updatedAt: ts(20),
    });

    // ── Page Feedback (reactions on published pages) ──────────────────

    // Positive feedback on popular pages
    for (let i = 0; i < 12; i++) {
      await ctx.db.insert("pageFeedback", {
        projectId: acmeProjectId,
        pageSlug: "/getting-started/quickstart",
        reaction: "positive",
        sessionId: `session_${i}`,
        createdAt: ts(i),
      });
    }

    for (let i = 0; i < 3; i++) {
      await ctx.db.insert("pageFeedback", {
        projectId: acmeProjectId,
        pageSlug: "/getting-started/quickstart",
        reaction: "negative",
        sessionId: `session_neg_${i}`,
        createdAt: ts(i + 2),
      });
    }

    for (let i = 0; i < 8; i++) {
      await ctx.db.insert("pageFeedback", {
        projectId: acmeProjectId,
        pageSlug: "/guides/authentication",
        reaction: "positive",
        sessionId: `session_auth_${i}`,
        createdAt: ts(i),
      });
    }

    // ── Summary ──────────────────────────────────────────────────────

    return {
      summary: {
        users: 3,
        projects: 4,
        branches: 5,
        folders: 9,
        pages: 16,
        mergeRequests: 1,
        commentThreads: 3,
        comments: 5,
        deployments: 5,
        mrReviewThreads: 1,
      },
    };
  },
});
