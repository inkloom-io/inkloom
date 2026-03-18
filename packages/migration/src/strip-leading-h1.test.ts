import { describe, it, expect } from "vitest";
import { stripLeadingH1 } from "./strip-leading-h1.js";

describe("stripLeadingH1", () => {
  it("strips a leading H1 at the very start of content", () => {
    const content = "# Showcase\n\nSome body text here.";
    expect(stripLeadingH1(content)).toBe("Some body text here.");
  });

  it("strips a leading H1 preceded by blank lines", () => {
    const content = "\n\n# Showcase\n\nBody text.";
    expect(stripLeadingH1(content)).toBe("Body text.");
  });

  it("does NOT strip H2 or deeper headings", () => {
    const content = "## Not an H1\n\nBody text.";
    expect(stripLeadingH1(content)).toBe("## Not an H1\n\nBody text.");
  });

  it("does NOT strip H1 if there is content before it", () => {
    const content = "Some intro text.\n\n# Heading\n\nMore content.";
    expect(stripLeadingH1(content)).toBe(
      "Some intro text.\n\n# Heading\n\nMore content."
    );
  });

  it("returns content unchanged when there are no headings", () => {
    const content = "Just a paragraph.\n\nAnother paragraph.";
    expect(stripLeadingH1(content)).toBe("Just a paragraph.\n\nAnother paragraph.");
  });

  it("returns empty string when content is only an H1", () => {
    const content = "# Only Heading";
    expect(stripLeadingH1(content)).toBe("");
  });

  it("handles H1 with extra spaces after #", () => {
    const content = "#  Spaced Title\n\nBody.";
    expect(stripLeadingH1(content)).toBe("Body.");
  });

  it("does NOT strip ### or #### headings", () => {
    const content = "### H3 Heading\n\nBody.";
    expect(stripLeadingH1(content)).toBe("### H3 Heading\n\nBody.");
  });

  it("preserves content after the H1 correctly", () => {
    const content = "# Title\n\n## Section 1\n\nParagraph.\n\n## Section 2\n\nMore text.";
    expect(stripLeadingH1(content)).toBe(
      "## Section 1\n\nParagraph.\n\n## Section 2\n\nMore text."
    );
  });
});
