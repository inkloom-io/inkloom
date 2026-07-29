import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import type { WorkerEnv } from "./env";
import { ApiError } from "./http";
import { assetsRoutes } from "./routes/assets";
import { branchesRoutes } from "./routes/branches";
import { commentsRoutes } from "./routes/comments";
import { deploymentsRoutes } from "./routes/deployments";
import { dashboardRoutes } from "./routes/dashboard";
import { foldersRoutes } from "./routes/folders";
import { mergeRequestRoutes } from "./routes/merge-requests";
import { mergeRequestDiffRoutes } from "./routes/merge-request-diff";
import { mrReviewRoutes } from "./routes/mr-reviews";
import { pagesRoutes } from "./routes/pages";
import { pageFeedbackRoutes } from "./routes/page-feedback";
import { projectsRoutes } from "./routes/projects";
import { searchRoutes } from "./routes/search";
import { usersRoutes } from "./routes/users";

const app = new Hono<WorkerEnv>();

app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: (origin, context) => {
      const configured = context.env.DATA_API_ALLOWED_ORIGINS?.split(",")
        .map((value: string) => value.trim())
        .filter(Boolean);
      if (!configured?.length) {
        return origin;
      }
      return configured.includes(origin) ? origin : configured[0]!;
    },
    allowHeaders: ["Authorization", "Content-Type", "X-D1-Bookmark"],
    exposeHeaders: ["X-D1-Bookmark"],
    credentials: true,
  })
);

app.use("/v1/*", async (context, next) => {
  const expected = context.env.DATA_API_TOKEN;
  if (!expected) {
    await next();
    return;
  }

  if (context.req.header("Authorization") !== `Bearer ${expected}`) {
    return context.json(
      { error: { code: "unauthorized", message: "Invalid API token." } },
      401
    );
  }

  await next();
});

app.get("/health", (context) =>
  context.json({
    ok: true,
    service: "inkloom-data",
    storage: "cloudflare-d1",
  })
);

const routes = app
  .route("/v1/users", usersRoutes)
  .route("/v1/projects", projectsRoutes)
  .route("/v1/branches", branchesRoutes)
  .route("/v1/comments", commentsRoutes)
  .route("/v1/deployments", deploymentsRoutes)
  .route("/v1/dashboard", dashboardRoutes)
  .route("/v1/folders", foldersRoutes)
  .route("/v1/merge-requests", mergeRequestRoutes)
  .route("/v1/merge-request-diff", mergeRequestDiffRoutes)
  .route("/v1/mr-reviews", mrReviewRoutes)
  .route("/v1/pages", pagesRoutes)
  .route("/v1/page-feedback", pageFeedbackRoutes)
  .route("/v1/search", searchRoutes)
  .route("/v1/assets", assetsRoutes);

app.notFound((context) =>
  context.json(
    { error: { code: "not_found", message: "Route not found." } },
    404
  )
);

app.onError((error, context) => {
  if (error instanceof ApiError) {
    return context.json(
      { error: { code: error.code, message: error.message } },
      error.status
    );
  }

  console.error(error);
  return context.json(
    {
      error: {
        code: "internal_error",
        message: "An unexpected data service error occurred.",
      },
    },
    500
  );
});

export type CoreDataApi = typeof routes;
export default app;
