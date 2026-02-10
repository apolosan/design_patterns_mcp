import { describe, test, expect } from 'vitest';
import {
  isValidHex,
  isValidRgb,
  isValidHsl,
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  rgbToHsl,
  hslToRgb,
  lighten,
  darken,
  saturate,
  desaturate,
  invert,
  getLuminance,
  getContrastRatio,
  getTextColor,
  parseColor,
  randomHex,
  randomPastel,
  interpolate,
  mix
} from '../../src/utils/color-utils.js';

describe('Color Utilities', () => {
  describe('Validation Functions', () => {
    test('isValidHex returns true for valid 6-digit hex', () => {
      expect(isValidHex('#FF0000')).toBe(true);
      expect(isValidHex('FF0000')).toBe(true);
      expect(isValidHex('#abcdef')).toBe(true);
    });

    test('isValidHex returns true for valid 3-digit hex', () => {
      expect(isValidHex('#F00')).toBe(true);
      expect(isValidHex('F00')).toBe(true);
      expect(isValidHex('#abc')).toBe(true);
    });

    test('isValidHex returns false for invalid hex', () => {
      expect(isValidHex('#GG0000')).toBe(false);
      expect(isValidHex('GGGGGG')).toBe(false);
      expect(isValidHex('#FF00')).toBe(false);
      expect(isValidHex('')).toBe(false);
    });

    test('isValidRgb validates RGB values correctly', () => {
      expect(isValidRgb(0, 0, 0)).toBe(true);
      expect(isValidRgb(255, 255, 255)).toBe(true);
      expect(isValidRgb(128, 128, 128)).toBe(true);
      expect(isValidRgb(-1, 0, 0)).toBe(false);
      expect(isValidRgb(256, 0, 0)).toBe(false);
    });

    test('isValidHsl validates HSL values correctly', () => {
      expect(isValidHsl(0, 0, 0)).toBe(true);
      expect(isValidHsl(359, 100, 100)).toBe(true);
      expect(isValidHsl(180, 50, 50)).toBe(true);
      expect(isValidHsl(-1, 0, 0)).toBe(false);
      expect(isValidHsl(360, 0, 0)).toBe(false);
      expect(isValidHsl(0, 101, 0)).toBe(false);
      expect(isValidHsl(0, 0, 101)).toBe(false);
    });
  });

  describe('HEX <-> RGB Conversions', () => {
    test('hexToRgb converts 6-digit hex correctly', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    test('hexToRgb converts 3-digit hex correctly', () => {
      expect(hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#0F0')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#00F')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    });

    test('hexToRgb returns null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull();
      expect(isValidHex('#GGGGGG')).toBe(false);
    });

    test('rgbToHex converts correctly', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#FF0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00FF00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000FF');
      expect(rgbToHex(128, 128, 128)).toBe('#808080');
    });

    test('hexToRgb and rgbToHex are inverse operations', () => {
      const testCases = [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 128, g: 64, b: 32 }
      ];

      for (const { r, g, b } of testCases) {
        const hex = rgbToHex(r, g, b);
        const backToRgb = hexToRgb(hex);
        expect(backToRgb).toEqual({ r, g, b });
      }
    });
  });

  describe('HEX <-> HSL Conversions', () => {
    test('hexToHsl converts primary colors correctly', () => {
      expect(hexToHsl('#FF0000')).toEqual({ h: 0, s: 100, l: 50 });
      expect(hexToHsl('#00FF00')).toEqual({ h: 120, s: 100, l: 50 });
      expect(hexToHsl('#0000FF')).toEqual({ h: 240, s: 100, l: 50 });
    });

    test('hexToHsl converts grayscale correctly', () => {
      expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 });
      expect(hexToHsl('#FFFFFF')).toEqual({ h: 0, s: 0, l: 100 });
      expect(hexToHsl('#808080')).toEqual({ h: 0, s: 0, l: 50 });
    });

    test('hexToHsl returns null for invalid hex', () => {
      expect(hexToHsl('invalid')).toBeNull();
    });

    test('hslToHex converts correctly', () => {
      expect(hslToHex(0, 100, 50)).toBe('#FF0000');
      expect(hslToHex(120, 100, 50)).toBe('#00FF00');
      expect(hslToHex(240, 100, 50)).toBe('#0000FF');
    });

    test('hslToHex returns null for invalid HSL', () => {
      expect(hslToHex(-1, 50, 50)).toBeNull();
      expect(hslToHex(0, 101, 50)).toBeNull();
      expect(hslToHex(0, 50, 101)).toBeNull();
    });

    test('hexToHsl and hslToHex are inverse operations', () => {
      const testCases = [
        { h: 0, s: 0, l: 0 },
        { h: 0, s: 0, l: 100 },
        { h: 0, s: 100, l: 50 },
        { h: 120, s: 100, l: 50 },
        { h: 240, s: 100, l: 50 },
        { h: 180, s: 50, l: 60 }
      ];

      for (const { h, s, l } of testCases) {
        const hex = hslToHex(h, s, l);
        const backToHsl = hexToHsl(hex ?? '#000000');
        expect(backToHsl).toEqual({ h, s, l });
      }
    });
  });

  describe('RGB <-> HSL Conversions', () => {
    test('rgbToHsl converts correctly', () => {
      expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
      expect(rgbToHsl(0, 255, 0)).toEqual({ h: 120, s: 100, l: 50 });
      expect(rgbToHsl(0, 0, 255)).toEqual({ h: 240, s: 100, l: 50 });
    });

    test('rgbToHsl returns null for invalid RGB', () => {
      expect(rgbToHsl(-1, 0, 0)).toBeNull();
      expect(rgbToHsl(256, 0, 0)).toBeNull();
    });

    test('hslToRgb converts correctly', () => {
      expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 });
      expect(hslToRgb(120, 100, 50)).toEqual({ r: 0, g: 255, b: 0 });
      expect(hslToRgb(240, 100, 50)).toEqual({ r: 0, g: 0, b: 255 });
    });

    test('hslToRgb returns null for invalid HSL', () => {
      expect(hslToRgb(-1, 50, 50)).toBeNull();
      expect(hslToRgb(0, 101, 50)).toBeNull();
    });
  });

  describe('Color Manipulation', () => {
    test('lighten lightens colors correctly', () => {
      expect(lighten('#000000', 20)).toBe('#333333');
      expect(lighten('#808080', 10)).toBe('#999999');
      expect(lighten('#FFFFFF', 20)).toBe('#FFFFFF');
    });

    test('lighten returns null for invalid hex', () => {
      expect(lighten('invalid', 20)).toBeNull();
    });

    test('darken darkens colors correctly', () => {
      expect(darken('#FFFFFF', 20)).toBe('#CCCCCC');
      expect(darken('#808080', 10)).toBe('#666666');
      expect(darken('#000000', 20)).toBe('#000000');
    });

    test('darken returns null for invalid hex', () => {
      expect(darken('invalid', 20)).toBeNull();
    });

    test('saturate saturates colors correctly', () => {
      expect(saturate('#808080', 20)).toBe('#996666');
    });

    test('desaturate desaturates colors correctly', () => {
      expect(desaturate('#FF0000', 50)).toBe('#BF4040');
    });

    test('invert inverts colors correctly', () => {
      expect(invert('#FFFFFF')).toBe('#000000');
      expect(invert('#000000')).toBe('#FFFFFF');
      expect(invert('#FF0000')).toBe('#00FFFF');
    });

    test('invert returns null for invalid hex', () => {
      expect(invert('invalid')).toBeNull();
    });
  });

  describe('Luminance and Contrast', () => {
    test('getLuminance returns correct values', () => {
      expect(getLuminance(0, 0, 0)).toBe(0);
      expect(getLuminance(255, 255, 255)).toBe(1);
    });

    test('getContrastRatio calculates correctly', () => {
      const ratio = getContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeGreaterThan(20);
    });

    test('getContrastRatio returns null for invalid hex', () => {
      expect(getContrastRatio('invalid', '#FFFFFF')).toBeNull();
      expect(getContrastRatio('#000000', 'invalid')).toBeNull();
    });

    test('getTextColor returns appropriate text color', () => {
      expect(getTextColor('#FFFFFF')).toBe('black');
      expect(getTextColor('#000000')).toBe('white');
      expect(getTextColor('#808080')).toBe('black');
    });
  });

  describe('parseColor', () => {
    test('parses valid hex', () => {
      const result = parseColor('#FF0000');
      expect(result.isValid).toBe(true);
      expect(result.rgb).toEqual({ r: 255, g: 0, b: 0 });
      expect(result.hex).toBe('#FF0000');
    });

    test('parses rgb() format', () => {
      const result = parseColor('rgb(255, 0, 0)');
      expect(result.isValid).toBe(true);
      expect(result.rgb).toEqual({ r: 255, g: 0, b: 0 });
    });

    test('returns invalid for unrecognized format', () => {
      const result = parseColor('not-a-color');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Random Colors', () => {
    test('randomHex returns valid hex', () => {
      for (let i = 0; i < 10; i++) {
        const hex = randomHex();
        expect(isValidHex(hex)).toBe(true);
      }
    });

    test('randomPastel returns valid pastel hex', () => {
      for (let i = 0; i < 10; i++) {
        const hex = randomPastel();
        expect(isValidHex(hex)).toBe(true);
      }
    });
  });

  describe('Color Interpolation', () => {
    test('interpolate mixes colors correctly', () => {
      const result = interpolate('#000000', '#FFFFFF', 0.5);
      expect(result).toBe('#808080');
    });

    test('interpolate returns start color at factor 0', () => {
      expect(interpolate('#000000', '#FFFFFF', 0)).toBe('#000000');
    });

    test('interpolate returns end color at factor 1', () => {
      expect(interpolate('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    });

    test('interpolate clamps factor between 0 and 1', () => {
      expect(interpolate('#000000', '#FFFFFF', -0.5)).toBe('#000000');
      expect(interpolate('#000000', '#FFFFFF', 1.5)).toBe('#FFFFFF');
    });

    test('interpolate returns null for invalid hex', () => {
      expect(interpolate('invalid', '#FFFFFF', 0.5)).toBeNull();
      expect(interpolate('#000000', 'invalid', 0.5)).toBeNull();
    });

    test('mix is alias for interpolate', () => {
      expect(mix('#000000', '#FFFFFF', 0.5)).toBe(interpolate('#000000', '#FFFFFF', 0.5));
    });
  });
});
