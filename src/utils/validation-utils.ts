/**
 * Validation & Sanitization Utilities
 * 
 * Provides type-safe validation and sanitization functions for strings,
 * emails, URLs, and general input validation.
 * 
 * @module validation-utils
 * @version 1.0.0
 * @created 2025-02-10
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const URL_REGEX = /^https:\/\/[^\s]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEMVER_REGEX = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?$/;
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|[0-9a-fA-F]{1,4}:[0-9a-fA-F]{1,4}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){0,3}[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){0,2}[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){0,1}[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}|::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,6}|[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,5}::|(?:[0-9a-fA-F]{1,4}:){2}[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){3}[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){4}[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){5}[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){6}[0-9a-fA-F]{1,4}::$/;
const HEX_REGEX = /^[0-9a-fA-F]+$/;
const BASE64_REGEX = /^[A-Za-z0-9+/]+=*$/;
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const WHITESPACE_REGEX = /\s+/g;
const MULTIPLE_SPACES_REGEX = / {2,}/g;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

export interface EmailValidationResult extends ValidationResult {
  localPart?: string;
  domain?: string;
}

export interface UrlValidationResult extends ValidationResult {
  protocol?: string;
  hostname?: string;
  pathname?: string;
}

export interface VersionValidationResult extends ValidationResult {
  major?: number;
  minor?: number;
  patch?: number;
  prerelease?: string;
  build?: string;
}

export function isValidEmail(value: string): EmailValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a non-empty string' };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Email cannot be empty' };
  }
  
  if (trimmed.length > 254) {
    return { isValid: false, error: 'Email exceeds maximum length of 254 characters' };
  }
  
  const [localPart, domain] = trimmed.split('@');
  
  if (!localPart || !domain) {
    return { isValid: false, error: 'Email must contain exactly one @ symbol' };
  }
  
  if (localPart.length > 64) {
    return { isValid: false, error: 'Local part exceeds maximum length of 64 characters' };
  }
  
  if (domain.length > 253) {
    return { isValid: false, error: 'Domain exceeds maximum length of 253 characters' };
  }
  
  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  return {
    isValid: true,
    localPart,
    domain
  };
}

export function isValidUrl(value: string): UrlValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a non-empty string' };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length === 0) {
    return { isValid: false, error: 'URL cannot be empty' };
  }
  
  if (trimmed.length > 2048) {
    return { isValid: false, error: 'URL exceeds maximum length of 2048 characters' };
  }
  
  if (!URL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'URL must use HTTPS protocol' };
  }
  
  try {
    const url = new URL(trimmed);
    
    return {
      isValid: true,
      protocol: url.protocol,
      hostname: url.hostname,
      pathname: url.pathname
    };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

export function isValidUuid(value: string): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a non-empty string' };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length !== 36) {
    return { isValid: false, error: 'UUID must be exactly 36 characters' };
  }
  
  if (!UUID_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid UUID format' };
  }
  
  return { isValid: true };
}

export function isValidSemver(value: string): VersionValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a non-empty string' };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Version cannot be empty' };
  }
  
  if (trimmed.length > 512) {
    return { isValid: false, error: 'Version string exceeds maximum length' };
  }
  
  if (!SEMVER_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid semantic version format' };
  }
  
  const [versionPart, buildPart] = trimmed.split('+');
  const [prereleasePart, ...restPrerelease] = versionPart.split('-');
  const [major, minor, patch] = prereleasePart.split('.').map(Number);
  
  const prerelease = restPrerelease.length > 0 ? restPrerelease.join('-') : undefined;
  
  return {
    isValid: true,
    major,
    minor,
    patch,
    prerelease,
    build: buildPart
  };
}

export function isValidIpv4(value: string): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a non-empty string' };
  }
  
  const trimmed = value.trim();
  
  if (!IPV4_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid IPv4 address format' };
  }
  
  return { isValid: true };
}

export function isValidIpv6(value: string): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a non-empty string' };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length === 0) {
    return { isValid: false, error: 'IPv6 address cannot be empty' };
  }
  
  if (trimmed.length > 45) {
    return { isValid: false, error: 'IPv6 address exceeds maximum length' };
  }
  
  if (!IPV6_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid IPv6 address format' };
  }
  
  return { isValid: true };
}

export function isValidHex(value: string, options?: { allowPrefix?: boolean; caseSensitive?: boolean }): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a non-empty string' };
  }
  
  let input = value.trim();
  
  if (input.length === 0) {
    return { isValid: false, error: 'Hex value cannot be empty' };
  }
  
  if (options?.allowPrefix !== false && input.startsWith('#')) {
    input = input.slice(1);
  }
  
  if (options?.caseSensitive === true) {
    if (!/^[0-9a-fA-F]+$/.test(input)) {
      return { isValid: false, error: 'Invalid hex format (case-sensitive)' };
    }
  } else {
    if (!/^[0-9a-fA-F]+$/.test(input)) {
      return { isValid: false, error: 'Invalid hex format' };
    }
  }
  
  const len = input.length;
  const isValidLength = len % 2 === 0 || len === 3 || len === 4;
  
  if (!isValidLength) {
    return { isValid: false, error: 'Hex length must be even, 3, or 4 characters' };
  }
  
  return { isValid: true };
}

export function isValidBase64(value: string, options?: { requirePadding?: boolean; maxLength?: number }): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a non-empty string' };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Base64 string cannot be empty' };
  }
  
  if (options?.maxLength && trimmed.length > options.maxLength) {
    return { isValid: false, error: `Base64 string exceeds maximum length of ${options.maxLength}` };
  }
  
  if (options?.requirePadding !== false) {
    if (trimmed.length % 4 !== 0) {
      return { isValid: false, error: 'Base64 string must have valid padding' };
    }
  }
  
  if (!BASE64_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid Base64 characters' };
  }
  
  return { isValid: true };
}

export function isStrongPassword(value: string, options?: { minLength?: number; requireUppercase?: boolean; requireLowercase?: boolean; requireDigit?: boolean; requireSpecial?: boolean }): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a non-empty string' };
  }
  
  const opts = { minLength: 8, requireUppercase: true, requireLowercase: true, requireDigit: true, requireSpecial: true, ...options };
  
  const trimmed = value;
  
  if (trimmed.length < opts.minLength!) {
    return { isValid: false, error: `Password must be at least ${opts.minLength} characters` };
  }
  
  if (opts.requireUppercase && !/[A-Z]/.test(trimmed)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  if (opts.requireLowercase && !/[a-z]/.test(trimmed)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }
  
  if (opts.requireDigit && !/\d/.test(trimmed)) {
    return { isValid: false, error: 'Password must contain at least one digit' };
  }
  
  if (opts.requireSpecial && !/[@$!%*?&]/.test(trimmed)) {
    return { isValid: false, error: 'Password must contain at least one special character (@$!%*?&)' };
  }
  
  return { isValid: true };
}

export function escapeHtml(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function unescapeHtml(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export function escapeSql(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  return value
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '')
    .replace(/;/g, '')
    .replace(/--/g, '- -')
    .replace(/\//g, '')
    .replace(/\*\//g, '');
}

export function sanitizeInput(value: string, options?: { trim?: boolean; removeExtraSpaces?: boolean; removeNewlines?: boolean; maxLength?: number }): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  const opts = { trim: true, removeExtraSpaces: true, removeNewlines: true, maxLength: undefined, ...options };
  
  let result = value;
  
  if (opts.removeNewlines) {
    result = result.replace(/\r?\n/g, ' ');
  }
  
  if (opts.trim) {
    result = result.trim();
  }
  
  if (opts.removeExtraSpaces) {
    result = result.replace(MULTIPLE_SPACES_REGEX, ' ');
  }
  
  if (opts.maxLength && result.length > opts.maxLength) {
    result = result.slice(0, opts.maxLength);
  }
  
  return result;
}

export function slugify(value: string, options?: { lowercase?: boolean; separator?: string; maxLength?: number }): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  const opts = { lowercase: true, separator: '-', maxLength: undefined, ...options };
  
  let result = value;
  
  if (opts.lowercase) {
    result = result.toLowerCase();
  }
  
  result = result
    .replace(/[^a-zA-Z0-9\s-_]/g, opts.separator!)
    .replace(WHITESPACE_REGEX, opts.separator!)
    .replace(new RegExp(`\\${opts.separator}{2,}`, 'g'), opts.separator!)
    .replace(new RegExp(`^\\${opts.separator}|\\${opts.separator}$`, 'g'), '');
  
  if (opts.maxLength && result.length > opts.maxLength) {
    result = result.slice(0, opts.maxLength);
    result = result.replace(new RegExp(`\\${opts.separator}$`), '');
  }
  
  return result;
}

export function truncate(value: string, maxLength: number, options?: { suffix?: string; preserveWords?: boolean }): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  if (maxLength <= 0) {
    return '';
  }
  
  const opts = { suffix: '...', preserveWords: false, ...options };
  
  if (value.length <= maxLength) {
    return value;
  }
  
  if (maxLength <= opts.suffix!.length) {
    return value.slice(0, maxLength);
  }
  
  let result = value.slice(0, maxLength - opts.suffix!.length);
  
  if (opts.preserveWords) {
    result = result.replace(/\s+\S*$/, '');
  }
  
  return result + opts.suffix!;
}

export function capitalize(value: string, options?: { allWords?: boolean }): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  if (options?.allWords) {
    return value
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return false;
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  
  return false;
}

export function normalizeNewlines(value: string, newline: '\n' | '\r\n' = '\n'): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, newline);
}

export function maskValue(value: string, options?: { visibleStart?: number; visibleEnd?: number; maskChar?: string }): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  const opts = { visibleStart: 0, visibleEnd: 0, maskChar: '*', ...options };
  
  if (value.length <= opts.visibleStart!) {
    return value;
  }
  
  if (opts.visibleEnd! > 0 && opts.visibleStart! + opts.visibleEnd! >= value.length) {
    return value;
  }
  
  const start = value.slice(0, opts.visibleStart!);
  const end = opts.visibleEnd! > 0 ? value.slice(-opts.visibleEnd!) : '';
  const maskLength = Math.max(0, value.length - opts.visibleStart! - opts.visibleEnd!);
  const mask = opts.maskChar!.repeat(maskLength);
  
  return start + mask + end;
}

export function validateRange(value: number, min: number, max: number): ValidationResult {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return { isValid: false, error: 'Value must be a valid number' };
  }
  
  if (value < min) {
    return { isValid: false, error: `Value must be at least ${min}` };
  }
  
  if (value > max) {
    return { isValid: false, error: `Value must be at most ${max}` };
  }
  
  return { isValid: true };
}

export function isInteger(value: unknown): boolean {
  return Number.isInteger(value);
}

export function isFloat(value: unknown): boolean {
  return typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value) && !Number.isInteger(value);
}

export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
