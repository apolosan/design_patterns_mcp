/**
 * Type declarations for optional dependencies
 * These modules are loaded conditionally and may not be installed
 */

declare module 'redis' {
  export function createClient(opts: unknown): unknown;
}

declare module 'ioredis' {
  export default class Redis {
    constructor(opts: unknown);
  }
}

declare module 'lz4js' {
  export function compress(buffer: Buffer): Uint8Array;
  export function decompress(buffer: Uint8Array): Uint8Array;
}

declare module 'zstd-codec' {
  export class Compressor {
    compress(buffer: Buffer): Uint8Array;
  }
  export class Decompressor {
    decompress(buffer: Buffer): Uint8Array;
    static new(): Decompressor;
  }
}
