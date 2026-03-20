import { describe, it, expect } from "vitest";

import { parseOpenApiSpec } from "../parse-spec";

// ---------------------------------------------------------------------------
// Minimal Mintlify-style spec with allOf, oneOf, and webhooks
// ---------------------------------------------------------------------------
const SPEC_WITH_ALLOF_AND_WEBHOOKS = JSON.stringify({
  openapi: "3.1.0",
  info: { title: "Plant Store", version: "1.0.0", description: "A plant API" },
  servers: [{ url: "https://api.example.com" }],
  paths: {
    "/plants": {
      get: {
        operationId: "listPlants",
        summary: "List all plants",
        tags: ["Plants"],
        responses: {
          "200": {
            description: "A list of plants",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Plant name" },
                      tag: { type: "string", description: "Plant tag" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: "createPlant",
        summary: "Create a plant",
        tags: ["Plants"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                allOf: [
                  {
                    type: "object",
                    required: ["name"],
                    properties: {
                      name: { type: "string", description: "Plant name" },
                      tag: { type: "string", description: "Plant tag" },
                    },
                  },
                  {
                    type: "object",
                    required: ["id"],
                    properties: {
                      id: { type: "integer", description: "Plant ID" },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          "200": { description: "Plant created" },
        },
      },
    },
    "/plants/{id}": {
      delete: {
        operationId: "deletePlant",
        summary: "Delete a plant",
        tags: ["Plants"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "Plant ID",
          },
        ],
        responses: {
          "200": { description: "Plant deleted" },
        },
      },
    },
  },
  webhooks: {
    "/plant/webhook": {
      post: {
        operationId: "plantWebhook",
        summary: "Plant event webhook",
        tags: ["Webhooks"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  event: { type: "string", description: "Event type" },
                  plantId: { type: "integer", description: "Plant ID" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Webhook acknowledged" },
        },
      },
    },
  },
});

describe("parseOpenApiSpec", () => {
  describe("allOf handling", () => {
    it("should flatten allOf composed schemas into merged fields", async () => {
      const result = await parseOpenApiSpec(SPEC_WITH_ALLOF_AND_WEBHOOKS);
      const createPlant = result.endpoints.find(
        (e) => e.operationId === "createPlant"
      );
      expect(createPlant).toBeDefined();
      if (!createPlant) return;

      const fields = createPlant.requestBody?.fields;
      expect(fields).toBeDefined();
      if (!fields) return;

      const fieldNames = fields.map((f) => f.name);
      expect(fieldNames).toContain("name");
      expect(fieldNames).toContain("tag");
      expect(fieldNames).toContain("id");

      // Check required flags
      const nameField = fields.find((f) => f.name === "name");
      const tagField = fields.find((f) => f.name === "tag");
      const idField = fields.find((f) => f.name === "id");
      expect(nameField?.required).toBe(true);
      expect(tagField?.required).toBe(false);
      expect(idField?.required).toBe(true);
    });
  });

  describe("oneOf/anyOf handling", () => {
    it("should use first variant of oneOf schema", async () => {
      const spec = JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Test", version: "1.0.0" },
        paths: {
          "/test": {
            post: {
              operationId: "testOneOf",
              summary: "Test oneOf",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      oneOf: [
                        {
                          type: "object",
                          required: ["type"],
                          properties: {
                            type: {
                              type: "string",
                              description: "Variant A type",
                            },
                            valueA: {
                              type: "string",
                              description: "Variant A value",
                            },
                          },
                        },
                        {
                          type: "object",
                          properties: {
                            type: {
                              type: "string",
                              description: "Variant B type",
                            },
                            valueB: {
                              type: "number",
                              description: "Variant B value",
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
              responses: { "200": { description: "OK" } },
            },
          },
        },
      });

      const result = await parseOpenApiSpec(spec);
      const endpoint = result.endpoints.find(
        (e) => e.operationId === "testOneOf"
      );
      expect(endpoint).toBeDefined();
      if (!endpoint) return;

      const fields = endpoint.requestBody?.fields;
      expect(fields).toBeDefined();
      if (!fields) return;

      // Should use first variant
      const fieldNames = fields.map((f) => f.name);
      expect(fieldNames).toContain("type");
      expect(fieldNames).toContain("valueA");
      expect(fieldNames).not.toContain("valueB");
    });
  });

  describe("webhooks processing", () => {
    it("should extract webhook endpoints from the webhooks section", async () => {
      const result = await parseOpenApiSpec(SPEC_WITH_ALLOF_AND_WEBHOOKS);

      // Should have 4 endpoints total: 3 paths + 1 webhook
      expect(result.endpoints).toHaveLength(4);

      const webhook = result.endpoints.find(
        (e) => e.operationId === "plantWebhook"
      );
      expect(webhook).toBeDefined();
      if (!webhook) return;

      expect(webhook.method).toBe("POST");
      expect(webhook.path).toBe("/plant/webhook");
      expect(webhook.tag).toBe("Webhooks");
      expect(webhook.summary).toBe("Plant event webhook");
    });

    it("should include webhook tag in tagGroups", async () => {
      const result = await parseOpenApiSpec(SPEC_WITH_ALLOF_AND_WEBHOOKS);

      const webhookTag = result.tagGroups.find((t) => t.tag === "Webhooks");
      expect(webhookTag).toBeDefined();
      expect(webhookTag?.endpointCount).toBe(1);
    });

    it("should default webhook tag to 'Webhooks' when no tags specified", async () => {
      const spec = JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Test", version: "1.0.0" },
        paths: {},
        webhooks: {
          onEvent: {
            post: {
              operationId: "onEvent",
              summary: "Event hook",
              responses: { "200": { description: "OK" } },
            },
          },
        },
      });

      const result = await parseOpenApiSpec(spec);
      const webhook = result.endpoints.find(
        (e) => e.operationId === "onEvent"
      );
      expect(webhook?.tag).toBe("Webhooks");
    });
  });
});
