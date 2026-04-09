/**
 * Boost the lightness of an "H S% L%" string to at least minL.
 * Used to ensure brand colors are readable on dark backgrounds.
 */
export function adjustLightnessForDark(hsl: string, minL = 62): string {
  const match = hsl.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) return hsl;
  const [, h, s, l] = match;
  const lightness = parseInt(l);
  if (lightness >= minL) return hsl;
  return `${h} ${s}% ${minL}%`;
}

/**
 * Determine whether black or white text is more readable on an HSL color.
 * Accepts the "H S% L%" format returned by hexToHsl / adjustLightnessForDark.
 */
export function contrastForegroundFromHsl(hsl: string): string {
  const match = hsl.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) return '0 0% 100%';
  const lightness = parseInt(match[3]);
  return lightness > 55 ? '0 0% 11%' : '0 0% 100%';
}

/** Convert a hex color string to Tailwind-compatible "H S% L%" format */
export function hexToHsl(hex: string): string | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Determine whether black or white text is more readable on a given hex background */
export function contrastForeground(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '0 0% 11%' : '0 0% 100%';
}
