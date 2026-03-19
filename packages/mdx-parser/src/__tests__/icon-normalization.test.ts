import { describe, it, expect } from "vitest";
import { normalizeIconAttr } from "../mdx-to-blocknote.js";
import { mdxToBlockNote } from "../mdx-to-blocknote.js";

describe("normalizeIconAttr", () => {
  it("prefixes bare icon names with lucide:", () => {
    expect(normalizeIconAttr("copy")).toBe("lucide:copy");
    expect(normalizeIconAttr("book-open")).toBe("lucide:book-open");
    expect(normalizeIconAttr("terminal")).toBe("lucide:terminal");
    expect(normalizeIconAttr("rocket")).toBe("lucide:rocket");
    expect(normalizeIconAttr("shield")).toBe("lucide:shield");
  });

  it("returns already-prefixed values as-is", () => {
    expect(normalizeIconAttr("lucide:copy")).toBe("lucide:copy");
    expect(normalizeIconAttr("lucide:book-open")).toBe("lucide:book-open");
  });

  it("returns emojis as-is", () => {
    expect(normalizeIconAttr("🚀")).toBe("🚀");
    expect(normalizeIconAttr("📚")).toBe("📚");
    expect(normalizeIconAttr("⚡")).toBe("⚡");
  });

  it("returns undefined for undefined input", () => {
    expect(normalizeIconAttr(undefined)).toBeUndefined();
  });

  it("returns empty string for empty string input", () => {
    expect(normalizeIconAttr("")).toBe("");
  });

  it("does not prefix strings starting with uppercase", () => {
    expect(normalizeIconAttr("Copy")).toBe("Copy");
  });

  it("does not prefix strings with spaces", () => {
    expect(normalizeIconAttr("my icon")).toBe("my icon");
  });
});

describe("icon normalization in mdxToBlockNote", () => {
  it("normalizes Accordion icon to lucide: prefix", () => {
    const mdx = `<AccordionGroup>\n<Accordion icon="copy" title="Test">\nContent\n</Accordion>\n</AccordionGroup>`;
    const blocks = mdxToBlockNote(mdx);
    const accordion = blocks.find((b) => b.type === "accordion");
    expect(accordion).toBeDefined();
    expect(accordion?.props?.icon).toBe("lucide:copy");
  });

  it("normalizes Card icon to lucide: prefix", () => {
    const mdx = `<Card icon="terminal" title="Test">\nContent\n</Card>`;
    const blocks = mdxToBlockNote(mdx);
    const card = blocks.find((b) => b.type === "card");
    expect(card).toBeDefined();
    expect(card?.props?.icon).toBe("lucide:terminal");
  });

  it("normalizes Tab icon to lucide: prefix", () => {
    const mdx = `<Tabs>\n<Tab icon="rocket" title="Test">\nContent\n</Tab>\n</Tabs>`;
    const blocks = mdxToBlockNote(mdx);
    const tab = blocks.find((b) => b.type === "tab");
    expect(tab).toBeDefined();
    expect(tab?.props?.icon).toBe("lucide:rocket");
  });

  it("normalizes Step icon to lucide: prefix", () => {
    const mdx = `<Steps>\n<Step icon="shield" title="Test">\nContent\n</Step>\n</Steps>`;
    const blocks = mdxToBlockNote(mdx);
    const step = blocks.find((b) => b.type === "step");
    expect(step).toBeDefined();
    expect(step?.props?.icon).toBe("lucide:shield");
  });

  it("preserves already-prefixed icons", () => {
    const mdx = `<AccordionGroup>\n<Accordion icon="lucide:copy" title="Test">\nContent\n</Accordion>\n</AccordionGroup>`;
    const blocks = mdxToBlockNote(mdx);
    const accordion = blocks.find((b) => b.type === "accordion");
    expect(accordion?.props?.icon).toBe("lucide:copy");
  });

  it("preserves emoji icons", () => {
    const mdx = `<AccordionGroup>\n<Accordion icon="🚀" title="Test">\nContent\n</Accordion>\n</AccordionGroup>`;
    const blocks = mdxToBlockNote(mdx);
    const accordion = blocks.find((b) => b.type === "accordion");
    expect(accordion?.props?.icon).toBe("🚀");
  });

  it("does not add icon prop when no icon attribute present", () => {
    const mdx = `<AccordionGroup>\n<Accordion title="Test">\nContent\n</Accordion>\n</AccordionGroup>`;
    const blocks = mdxToBlockNote(mdx);
    const accordion = blocks.find((b) => b.type === "accordion");
    expect(accordion).toBeDefined();
    expect(accordion?.props?.icon).toBeUndefined();
  });
});
