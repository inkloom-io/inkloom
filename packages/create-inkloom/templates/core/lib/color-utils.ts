/**
 * Compute a contrast foreground color (black or white) for a given background.
 * Uses WCAG relative luminance. Accepts HSL (e.g. "hsl(210 40% 98%)") or hex (e.g. "#ffffff").
 * Returns an HSL string: black for light backgrounds, white for dark backgrounds.
 */
export function computeContrastForeground(color: string): string {
  let r: number, g: number, b: number;

  const hslMatch = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (hslMatch && hslMatch[1] && hslMatch[2] && hslMatch[3]) {
    // Convert HSL to linear RGB
    const h = parseInt(hslMatch[1], 10) / 360;
    const s = parseInt(hslMatch[2], 10) / 100;
    const l = parseInt(hslMatch[3], 10) / 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
  } else {
    // Assume hex
    const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (hexMatch && hexMatch[1] && hexMatch[2] && hexMatch[3]) {
      r = parseInt(hexMatch[1], 16) / 255;
      g = parseInt(hexMatch[2], 16) / 255;
      b = parseInt(hexMatch[3], 16) / 255;
    } else {
      // Fallback: assume dark background, use white
      return "hsl(0 0% 100%)";
    }
  }

  // sRGB to linear RGB for luminance calculation
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // WCAG threshold: luminance > 0.179 means light background → use black text
  return luminance > 0.179 ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)";
}
