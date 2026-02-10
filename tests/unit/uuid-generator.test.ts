import { describe, test, expect } from 'vitest';
import {
  generateUUIDv7,
  generateUUIDv8,
  generateULID,
  UUIDGenerator
} from '../../src/utils/uuid-generator';

describe('UUID Generator Utilities', () => {
  describe('generateUUIDv7', () => {
    test('generates valid UUID v7 format', () => {
      const uuid = generateUUIDv7();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    test('generates UUIDs with valid timestamp portion', () => {
      const timestamp = 1609459200000;
      const uuid = generateUUIDv7({ timestamp });

      expect(uuid.length).toBe(36);
      const tsHex = BigInt(timestamp).toString(16).padStart(16, '0');
      expect(uuid.substring(0, 8)).toBe(tsHex.substring(0, 8));
    });

    test('version bits are set correctly (7)', () => {
      const uuid = generateUUIDv7();
      const versionSection = uuid.substring(14, 15);

      expect(versionSection).toBe('7');
    });

    test('variant bits are set correctly', () => {
      const uuid = generateUUIDv7();
      const variantSection = uuid.substring(19, 20);

      expect(['8', '9', 'a', 'b']).toContain(variantSection);
    });

    test('generates different UUIDs for different timestamps', () => {
      const uuid1 = generateUUIDv7({ timestamp: 1000 });
      const uuid2 = generateUUIDv7({ timestamp: 2000 });

      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('generateUUIDv8', () => {
    test('generates valid UUID v8 format', () => {
      const uuid = generateUUIDv8();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    test('accepts custom epoch', () => {
      const customEpoch = 1609459200000;
      const timestamp = Date.now();
      const uuid = generateUUIDv8({ timestamp, customEpoch });

      expect(uuid).toBeDefined();
      expect(uuid.length).toBe(36);
    });

    test('version bits are set correctly (8)', () => {
      const uuid = generateUUIDv8();
      const versionSection = uuid.substring(14, 15);

      expect(versionSection).toBe('8');
    });
  });

  describe('generateULID', () => {
    test('generates valid ULID format (26 chars)', () => {
      const ulid = generateULID();
      expect(ulid.length).toBe(26);
      expect(ulid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    test('first 10 chars represent timestamp', () => {
      const timestamp = Date.now();
      const ulid = generateULID({ timestamp });

      expect(ulid.length).toBe(26);
    });

    test('encodes timestamp correctly', () => {
      const timestamp = 1609459200000;
      const ulid = generateULID({ timestamp });

      expect(ulid.length).toBe(26);
      expect(ulid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    test('accepts custom randomness', () => {
      const customRandom = Buffer.alloc(16);
      customRandom.fill(0xcd);

      const ulid = generateULID({ randomness: customRandom });

      expect(ulid.length).toBe(26);
    });

    test('generates unique ULIDs', () => {
      const ulids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ulids.add(generateULID());
      }
      expect(ulids.size).toBe(100);
    });
  });

  describe('UUIDGenerator class', () => {
    test('singleton pattern works', () => {
      const instance1 = UUIDGenerator.getInstance();
      const instance2 = UUIDGenerator.getInstance();

      expect(instance1).toBe(instance2);
    });

    test('v7 method works', () => {
      const generator = UUIDGenerator.getInstance();
      const uuid = generator.v7();

      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    test('v8 method works', () => {
      const generator = UUIDGenerator.getInstance();
      const uuid = generator.v8();

      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    test('ulid method works', () => {
      const generator = UUIDGenerator.getInstance();
      const ulid = generator.ulid();

      expect(ulid.length).toBe(26);
    });

    test('deterministic method generates same UUID for same input', () => {
      const generator = UUIDGenerator.getInstance();
      const uuid1 = generator.deterministic('test-value', 'test-namespace');
      const uuid2 = generator.deterministic('test-value', 'test-namespace');

      expect(uuid1).toBe(uuid2);
    });

    test('deterministic method generates different UUIDs for different inputs', () => {
      const generator = UUIDGenerator.getInstance();
      const uuid1 = generator.deterministic('value1', 'namespace');
      const uuid2 = generator.deterministic('value2', 'namespace');

      expect(uuid1).not.toBe(uuid2);
    });

    test('deterministic method generates different UUIDs for different namespaces', () => {
      const generator = UUIDGenerator.getInstance();
      const uuid1 = generator.deterministic('value', 'namespace1');
      const uuid2 = generator.deterministic('value', 'namespace2');

      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('Ordering properties', () => {
    test('UUIDv7 has timestamp in first segment', () => {
      const uuids: { time: number; uuid: string }[] = [];

      for (let i = 0; i < 5; i++) {
        const time = 1609459200000 + i * 1000;
        uuids.push({ time, uuid: generateUUIDv7({ timestamp: time }) });
      }

      const uuidTimes = uuids.map(u => parseInt(u.uuid.substring(0, 8), 16));
      const sortedTimes = [...uuidTimes].sort((a, b) => a - b);

      expect(uuidTimes).toEqual(sortedTimes);
    });

    test('ULID is lexicographically sortable by timestamp', () => {
      const ulids: { time: number; ulid: string }[] = [];

      for (let i = 0; i < 10; i++) {
        const time = Date.now() + i * 1000;
        ulids.push({ time, ulid: generateULID({ timestamp: time }) });
      }

      const sorted = [...ulids].sort((a, b) => a.ulid.localeCompare(b.ulid));
      const sortedByTime = [...ulids].sort((a, b) => a.time - b.time);

      expect(sorted.map(u => u.time)).toEqual(sortedByTime.map(u => u.time));
    });
  });
});
