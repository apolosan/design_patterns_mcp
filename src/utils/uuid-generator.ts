import { createHash } from 'node:crypto';

export interface UUIDv7Options {
  timestamp?: number;
}

export interface UUIDv8Options {
  timestamp?: number;
  customEpoch?: number;
}

export interface ULIDOptions {
  timestamp?: number;
  randomness?: Uint8Array;
}

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

export function generateUUIDv7(options: UUIDv7Options = {}): string {
  const timestamp = BigInt(options.timestamp ?? Date.now());
  const tsHex = timestamp.toString(16).padStart(16, '0');
  const randHex = randomHex(20);
  
  const part1 = tsHex.substring(0, 8);
  const part2 = tsHex.substring(8, 12);
  const part3 = '7' + randHex.substring(0, 3);
  const part4 = '8' + randHex.substring(4, 7);
  const part5 = randHex.substring(8, 20);
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export function generateUUIDv8(options: UUIDv8Options = {}): string {
  const timestamp = BigInt(options.timestamp ?? Date.now());
  const customEpoch = BigInt(options.customEpoch ?? 0);
  const ts = timestamp - customEpoch;
  const tsHex = ts.toString(16).padStart(16, '0');
  const randHex = randomHex(20);
  
  const part1 = tsHex.substring(0, 8);
  const part2 = tsHex.substring(8, 12);
  const part3 = '8' + randHex.substring(0, 3);
  const part4 = '8' + randHex.substring(4, 7);
  const part5 = randHex.substring(8, 20);
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export function generateULID(options: ULIDOptions = {}): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const ENCODING_LEN = ENCODING.length;
  const TIMESTAMP_LEN = 10;

  let timestamp = options.timestamp ?? Date.now();
  const randomness = options.randomness ?? new Uint8Array(16);

  if (options.randomness === undefined) {
    for (let i = 0; i < 16; i++) {
      randomness[i] = Math.floor(Math.random() * 256);
    }
  }

  let id = '';

  for (let i = 0; i < TIMESTAMP_LEN; i++) {
    const mod = timestamp % ENCODING_LEN;
    timestamp = Math.floor(timestamp / ENCODING_LEN);
    id = ENCODING[mod] + id;
  }

  for (let i = 0; i < 16; i++) {
    const charIndex = randomness[i] % ENCODING_LEN;
    id += ENCODING[charIndex];
  }

  return id;
}

export class UUIDGenerator {
  private static instance: UUIDGenerator;

  private constructor() {}

  static getInstance(): UUIDGenerator {
    if (!UUIDGenerator.instance) {
      UUIDGenerator.instance = new UUIDGenerator();
    }
    return UUIDGenerator.instance;
  }

  v7(options: UUIDv7Options = {}): string {
    return generateUUIDv7(options);
  }

  v8(options: UUIDv8Options = {}): string {
    return generateUUIDv8(options);
  }

  ulid(options: ULIDOptions = {}): string {
    return generateULID(options);
  }

  deterministic(value: string, namespace: string = 'default'): string {
    const combined = `${namespace}:${value}`;
    const hash = createHash('sha256').update(combined).digest('hex');
    const ts = BigInt('0x' + hash.substring(0, 16));
    
    const tsHex = ts.toString(16).padStart(16, '0');
    const randHex = hash.substring(0, 20);
    
    const part1 = tsHex.substring(0, 8);
    const part2 = tsHex.substring(8, 12);
    const part3 = '7' + randHex.substring(0, 3);
    const part4 = '8' + randHex.substring(4, 7);
    const part5 = randHex.substring(8, 20);
    
    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
  }
}
