import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "path";
import {
  detectMimeType,
  scanContentForImages,
  scanGitbookAssetsDir,
  collectAssets,
} from "./assets.js";

// ── detectMimeType ──

describe("detectMimeType", () => {
  it("detects common image types", () => {
    expect(detectMimeType("photo.png")).toBe("image/png");
    expect(detectMimeType("photo.jpg")).toBe("image/jpeg");
    expect(detectMimeType("photo.jpeg")).toBe("image/jpeg");
    expect(detectMimeType("anim.gif")).toBe("image/gif");
    expect(detectMimeType("icon.svg")).toBe("image/svg+xml");
    expect(detectMimeType("pic.webp")).toBe("image/webp");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(detectMimeType("file.xyz")).toBe("application/octet-stream");
    expect(detectMimeType("noext")).toBe("application/octet-stream");
  });

  it("strips query params and fragments from URLs", () => {
    expect(detectMimeType("https://example.com/img.png?w=100")).toBe("image/png");
    expect(detectMimeType("img.jpg#section")).toBe("image/jpeg");
  });

  it("is case-insensitive on extension", () => {
    expect(detectMimeType("image.PNG")).toBe("image/png");
    expect(detectMimeType("image.JPG")).toBe("image/jpeg");
  });
});

// ── scanContentForImages ──

describe("scanContentForImages", () => {
  it("finds markdown images", () => {
    const content = `
Some text
![Alt text](./images/photo.png)
More text
![](https://example.com/banner.jpg)
    `;
    const urls = scanContentForImages(content);
    expect(urls).toContain("./images/photo.png");
    expect(urls).toContain("https://example.com/banner.jpg");
  });

  it("finds JSX Image components", () => {
    const content = `
<Image src="/assets/hero.webp" alt="Hero" />
<img src="https://cdn.example.com/logo.svg" />
    `;
    const urls = scanContentForImages(content);
    expect(urls).toContain("/assets/hero.webp");
    expect(urls).toContain("https://cdn.example.com/logo.svg");
  });

  it("finds both markdown and JSX images in the same content", () => {
    const content = `
# Hello
![photo](./photo.png)
<Image src="https://cdn.example.com/banner.jpg" />
    `;
    const urls = scanContentForImages(content);
    expect(urls).toHaveLength(2);
    expect(urls).toContain("./photo.png");
    expect(urls).toContain("https://cdn.example.com/banner.jpg");
  });

  it("deduplicates URLs", () => {
    const content = `
![a](./photo.png)
![b](./photo.png)
    `;
    const urls = scanContentForImages(content);
    expect(urls).toHaveLength(1);
  });

  it("finds base64 data URIs in markdown images", () => {
    const content = `![icon](data:image/png;base64,iVBORw0KGgo=)`;
    const urls = scanContentForImages(content);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^data:image\/png;base64,/);
  });

  it("returns empty array for content with no images", () => {
    const content = "# Just a heading\n\nSome paragraph text.";
    expect(scanContentForImages(content)).toEqual([]);
  });

  it("ignores markdown images inside fenced code blocks", () => {
    const content = `
Some text

\`\`\`md
![title](/path/image.jpg)
\`\`\`

![real](./real-image.png)
    `;
    const urls = scanContentForImages(content);
    expect(urls).toEqual(["./real-image.png"]);
  });

  it("ignores JSX images inside fenced code blocks", () => {
    const content = `
Some text

\`\`\`html
<img height="200" src="/path/image.jpg" />
\`\`\`

<img src="./real-image.png" />
    `;
    const urls = scanContentForImages(content);
    expect(urls).toEqual(["./real-image.png"]);
  });

  it("ignores images inside inline code spans", () => {
    const content = `
Use \`![alt](/example.png)\` for markdown images.

![real](./actual.png)
    `;
    const urls = scanContentForImages(content);
    expect(urls).toEqual(["./actual.png"]);
  });

  it("ignores images inside tilde fenced code blocks", () => {
    const content = `
~~~md
![example](/path/image.jpg)
~~~

![real](./real.png)
    `;
    const urls = scanContentForImages(content);
    expect(urls).toEqual(["./real.png"]);
  });

  it("collects images from normal text while skipping code blocks with multiple examples", () => {
    const content = `
# Images and embeds

Here's how to add images:

\`\`\`md
![title](/path/image.jpg)
\`\`\`

\`\`\`html
<img height="200" src="/path/image.jpg" />
\`\`\`

And here is a real image:

![banner](./images/banner.png)
<Image src="https://cdn.example.com/logo.svg" alt="Logo" />
    `;
    const urls = scanContentForImages(content);
    expect(urls).toHaveLength(2);
    expect(urls).toContain("./images/banner.png");
    expect(urls).toContain("https://cdn.example.com/logo.svg");
    expect(urls).not.toContain("/path/image.jpg");
  });
});

// ── scanGitbookAssetsDir ──

describe("scanGitbookAssetsDir", () => {
  it("returns empty array when .gitbook/assets does not exist", () => {
    const result = scanGitbookAssetsDir("/nonexistent/path");
    expect(result).toEqual([]);
  });
});

// ── collectAssets ──

describe("collectAssets", () => {
  let mockFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockFetch = vi.fn() as unknown as typeof globalThis.fetch;
  });

  function makeFetchResponse(body: Buffer | string, options: { ok?: boolean; status?: number; contentType?: string } = {}): Response {
    const { ok = true, status = 200, contentType = "image/png" } = options;
    return {
      ok,
      status,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
      },
      arrayBuffer: async () => {
        const buf = typeof body === "string" ? Buffer.from(body) : body;
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      },
    } as unknown as Response;
  }

  it("fetches absolute URLs via HTTP", async () => {
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    vi.mocked(mockFetch).mockResolvedValue(makeFetchResponse(imageBuffer));

    const contents = ["![hero](https://example.com/hero.png)"];
    const result = await collectAssets(contents, "/tmp/source", { fetchFn: mockFetch });

    expect(vi.mocked(mockFetch)).toHaveBeenCalledWith("https://example.com/hero.png");
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].originalUrl).toBe("https://example.com/hero.png");
    expect(result.assets[0].buffer).toBeDefined();
    expect(result.assets[0].filename).toBe("hero.png");
    expect(result.assets[0].mimeType).toBe("image/png");
    expect(result.warnings).toHaveLength(0);
  });

  it("handles HTTP fetch failures gracefully", async () => {
    vi.mocked(mockFetch).mockResolvedValue(makeFetchResponse("", { ok: false, status: 404 }));

    const contents = ["![broken](https://example.com/missing.png)"];
    const result = await collectAssets(contents, "/tmp/source", { fetchFn: mockFetch });

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].originalUrl).toBe("https://example.com/missing.png");
    expect(result.assets[0].buffer).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Failed to fetch");
    expect(result.warnings[0]).toContain("404");
  });

  it("handles network errors gracefully", async () => {
    vi.mocked(mockFetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const contents = ["![err](https://unreachable.example.com/img.png)"];
    const result = await collectAssets(contents, "/tmp/source", { fetchFn: mockFetch });

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].buffer).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("ECONNREFUSED");
  });

  it("decodes base64 data URIs", async () => {
    const base64Content = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
    const dataUri = `data:image/png;base64,${base64Content}`;
    const contents = [`![icon](${dataUri})`];

    const result = await collectAssets(contents, "/tmp/source", { fetchFn: mockFetch });

    expect(vi.mocked(mockFetch)).not.toHaveBeenCalled();
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].buffer).toBeDefined();
    expect(result.assets[0].mimeType).toBe("image/png");
    expect(result.assets[0].buffer?.length).toBe(4);
    expect(result.warnings).toHaveLength(0);
  });

  it("reads relative paths from filesystem", async () => {
    // Use the actual vitest.config.ts file as a "local asset" for testing
    const sourceDir = join(import.meta.dirname ?? ".", "..");
    const contents = ["![config](vitest.config.ts)"];

    const result = await collectAssets(contents, sourceDir, { fetchFn: mockFetch });

    expect(vi.mocked(mockFetch)).not.toHaveBeenCalled();
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].originalUrl).toBe("vitest.config.ts");
    expect(result.assets[0].buffer).toBeDefined();
    expect(result.warnings).toHaveLength(0);
  });

  it("warns on missing local files without failing", async () => {
    const contents = ["![missing](./does-not-exist.png)"];
    const result = await collectAssets(contents, "/tmp/nonexistent-source", { fetchFn: mockFetch });

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].buffer).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Local file not found");
  });

  it("deduplicates across multiple content strings", async () => {
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    vi.mocked(mockFetch).mockResolvedValue(makeFetchResponse(imageBuffer));

    const contents = [
      "![a](https://example.com/shared.png)",
      "![b](https://example.com/shared.png)",
    ];
    const result = await collectAssets(contents, "/tmp/source", { fetchFn: mockFetch });

    expect(vi.mocked(mockFetch)).toHaveBeenCalledTimes(1);
    expect(result.assets).toHaveLength(1);
  });

  it("handles mixed URL types in a single pass", async () => {
    const imageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic
    vi.mocked(mockFetch).mockResolvedValue(makeFetchResponse(imageBuffer, { contentType: "image/jpeg" }));

    const base64Content = Buffer.from([0x89, 0x50]).toString("base64");
    const dataUri = `data:image/png;base64,${base64Content}`;

    const contents = [
      `![remote](https://cdn.example.com/photo.jpg)\n![inline](${dataUri})\n![missing](./nope.png)`,
    ];

    const result = await collectAssets(contents, "/tmp/source", { fetchFn: mockFetch });

    expect(result.assets).toHaveLength(3);

    // Remote
    const remote = result.assets.find((a) => a.originalUrl === "https://cdn.example.com/photo.jpg");
    expect(remote).toBeDefined();
    expect(remote?.buffer).toBeDefined();
    expect(remote?.mimeType).toBe("image/jpeg");

    // Data URI
    const inline = result.assets.find((a) => a.originalUrl.startsWith("data:"));
    expect(inline).toBeDefined();
    expect(inline?.buffer).toBeDefined();
    expect(inline?.mimeType).toBe("image/png");

    // Missing local
    const missing = result.assets.find((a) => a.originalUrl === "./nope.png");
    expect(missing).toBeDefined();
    expect(missing?.buffer).toBeUndefined();

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Local file not found");
  });

  it("uses content-type header from HTTP response for mime type", async () => {
    const imageBuffer = Buffer.from([0x00]);
    vi.mocked(mockFetch).mockResolvedValue(
      makeFetchResponse(imageBuffer, { contentType: "image/webp; charset=utf-8" })
    );

    const contents = ["![img](https://example.com/image)"];
    const result = await collectAssets(contents, "/tmp/source", { fetchFn: mockFetch });

    expect(result.assets[0].mimeType).toBe("image/webp");
  });

  it("processes JSX Image components", async () => {
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    vi.mocked(mockFetch).mockResolvedValue(makeFetchResponse(imageBuffer));

    const contents = ['<Image src="https://example.com/jsx-hero.png" alt="Hero" />'];
    const result = await collectAssets(contents, "/tmp/source", { fetchFn: mockFetch });

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].originalUrl).toBe("https://example.com/jsx-hero.png");
    expect(result.assets[0].buffer).toBeDefined();
  });
});
