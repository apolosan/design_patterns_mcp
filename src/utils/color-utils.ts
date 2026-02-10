/**
 * Color Utilities - Color manipulation and conversion utilities
 * 
 * Provides color format conversions (HEX, RGB, HSL) and manipulations
 * like lighten, darken, and contrast calculations.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface RGBA extends RGB {
  a: number;
}

export interface HSLA extends HSL {
  a: number;
}

export interface ColorResult {
  hex: string;
  rgb: RGB;
  hsl: HSL;
  isValid: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseHex(hex: string): number | null {
  const trimmed = hex.replace(/^#/, '');
  if (trimmed.length === 6) {
    return parseInt(trimmed, 16);
  }
  if (trimmed.length === 3) {
    const expanded = trimmed.split('').map(c => c + c).join('');
    return parseInt(expanded, 16);
  }
  return null;
}

export function isValidHex(hex: string): boolean {
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

export function isValidRgb(r: number, g: number, b: number): boolean {
  return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255;
}

export function isValidHsl(h: number, s: number, l: number): boolean {
  return h >= 0 && h < 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
}

export function hexToRgb(hex: string): RGB | null {
  const parsed = parseHex(hex);
  if (parsed === null) {
    return null;
  }
  
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  
  return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => {
    const hex = Math.round(clamp(n, 0, 255)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToHsl(hex: string): HSL | null {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

export function hslToHex(h: number, s: number, l: number): string | null {
  const rgb = hslToRgb(h, s, l);
  if (!rgb) {
    return null;
  }
  
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export function rgbToHsl(r: number, g: number, b: number): HSL | null {
  if (!isValidRgb(r, g, b)) {
    return null;
  }
  
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

export function hslToRgb(h: number, s: number, l: number): RGB | null {
  if (!isValidHsl(h, s, l)) {
    return null;
  }
  
  h /= 360;
  s /= 100;
  l /= 100;
  
  let r: number;
  let g: number;
  let b: number;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

export function lighten(hex: string, amount: number): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return null;
  }
  
  const newL = clamp(hsl.l + amount, 0, 100);
  return hslToHex(hsl.h, hsl.s, newL);
}

export function darken(hex: string, amount: number): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return null;
  }
  
  const newL = clamp(hsl.l - amount, 0, 100);
  return hslToHex(hsl.h, hsl.s, newL);
}

export function saturate(hex: string, amount: number): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return null;
  }
  
  const newS = clamp(hsl.s + amount, 0, 100);
  return hslToHex(hsl.h, newS, hsl.l);
}

export function desaturate(hex: string, amount: number): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return null;
  }
  
  const newS = clamp(hsl.s - amount, 0, 100);
  return hslToHex(hsl.h, newS, hsl.l);
}

export function invert(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  
  return rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
}

export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  if (!rgb1 || !rgb2) {
    return null;
  }
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

export function getTextColor(bgHex: string): 'black' | 'white' {
  const rgb = hexToRgb(bgHex);
  if (!rgb) {
    return 'black';
  }
  
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.179 ? 'black' : 'white';
}

export function parseColor(input: string): ColorResult {
  const trimmed = input.trim().toLowerCase();
  
  if (isValidHex(trimmed)) {
    const rgb = hexToRgb(trimmed);
    const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : { h: 0, s: 0, l: 0 };
    return {
      hex: rgbToHex(rgb?.r ?? 0, rgb?.g ?? 0, rgb?.b ?? 0),
      rgb: rgb ?? { r: 0, g: 0, b: 0 },
      hsl: hsl ?? { h: 0, s: 0, l: 0 },
      isValid: true
    };
  }
  
  const rgbMatch = trimmed.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    if (isValidRgb(r, g, b)) {
      const hslResult = rgbToHsl(r, g, b);
      const hsl = hslResult ?? { h: 0, s: 0, l: 0 };
      return {
        hex: rgbToHex(r, g, b),
        rgb: { r, g, b },
        hsl: hsl,
        isValid: true
      };
    }
  }
  
  return {
    hex: '#000000',
    rgb: { r: 0, g: 0, b: 0 },
    hsl: { h: 0, s: 0, l: 0 },
    isValid: false
  };
}

export function randomHex(): string {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return rgbToHex(r, g, b);
}

export function randomPastel(): string {
  const h = Math.floor(Math.random() * 360);
  const s = 70 + Math.floor(Math.random() * 20);
  const l = 80 + Math.floor(Math.random() * 10);
  const rgb = hslToRgb(h, s, l);
  return rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : '#FFFFFF';
}

export function interpolate(
  hex1: string,
  hex2: string,
  factor: number
): string | null {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  if (!rgb1 || !rgb2) {
    return null;
  }
  
  const clamped = clamp(factor, 0, 1);
  const r = rgb1.r + (rgb2.r - rgb1.r) * clamped;
  const g = rgb1.g + (rgb2.g - rgb1.g) * clamped;
  const b = rgb1.b + (rgb2.b - rgb1.b) * clamped;
  
  return rgbToHex(r, g, b);
}

export function mix(
  hex1: string,
  hex2: string,
  weight: number = 0.5
): string | null {
  return interpolate(hex1, hex2, weight);
}
