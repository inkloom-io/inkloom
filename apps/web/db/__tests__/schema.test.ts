import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  coreSchema,
  pages,
  projects,
  searchIndex,
  users,
} from "../schema";

describe("core D1 schema", () => {
  it("contains the complete standalone table set", () => {
    expect(Object.keys(coreSchema)).toHaveLength(22);
    expect(getTableName(users)).toBe("users");
    expect(getTableName(projects)).toBe("projects");
    expect(getTableName(pages)).toBe("pages");
    expect(getTableName(searchIndex)).toBe("search_index");
  });

  it("does not expose platform-only tables", () => {
    expect(coreSchema).not.toHaveProperty("organizations");
    expect(coreSchema).not.toHaveProperty("generationJobs");
    expect(coreSchema).not.toHaveProperty("apiKeys");
  });
});
