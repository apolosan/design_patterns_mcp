import { describe, it, expect, beforeEach } from 'vitest';
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { PatternAnalyzer } from '../../src/services/pattern-analyzer';

describe('Code Analysis Pattern Detection', () => {
  let analyzer: PatternAnalyzer;

  beforeEach(() => {
    analyzer = new PatternAnalyzer();
  });

  it('should detect Singleton pattern in code', () => {
    const singletonCode = `
      class Logger {
        private static instance: Logger;
        private constructor() {}

        public static getInstance(): Logger {
          if (!Logger.instance) {
            Logger.instance = new Logger();
          }
          return Logger.instance;
        }
      }
    `;

    const result = analyzer.analyzeCode(singletonCode, 'typescript');

    expect(result.identifiedPatterns).toContainEqual(
      expect.objectContaining({
        pattern: 'Singleton',
        category: 'Creational',
      })
    );

    const singletonPattern = result.identifiedPatterns.find(p => p.pattern === 'Singleton');
    expect(singletonPattern!.confidence).toBeGreaterThan(0.4);
  });

  it('should detect Factory pattern in code', () => {
    const factoryCode = `
      abstract class Product {
        abstract operation(): string;
      }

      class ConcreteProductA extends Product {
        operation(): string {
          return "Product A";
        }
      }

      abstract class Creator {
        abstract createProduct(): Product;

        someOperation(): string {
          const product = this.createProduct();
          return product.operation();
        }
      }

      class ConcreteCreator extends Creator {
        createProduct(): Product {
          return new ConcreteProductA();
        }
      }
    `;

    const result = analyzer.analyzeCode(factoryCode, 'typescript');

    expect(result.identifiedPatterns).toContainEqual(
      expect.objectContaining({
        pattern: 'Factory Method',
        category: 'Creational',
      })
    );
  });

  it('should detect Observer pattern in code', () => {
    const observerCode = `
      interface Observer {
        update(message: string): void;
      }

      class ConcreteObserver implements Observer {
        update(message: string): void {
        }
      }

      class Subject {
        private observers: Observer[] = [];

        addObserver(observer: Observer): void {
          this.observers.push(observer);
        }

        notify(message: string): void {
          for (const observer of this.observers) {
            observer.update(message);
          }
        }
      }
    `;

    const result = analyzer.analyzeCode(observerCode, 'typescript');

    expect(result.identifiedPatterns).toContainEqual(
      expect.objectContaining({
        pattern: 'Observer',
        category: 'Behavioral',
      })
    );
  });

  it('should handle multiple languages', () => {
    const pythonCode = `
      class Singleton:
          _instance = None

          def __new__(cls):
              if cls._instance is None:
                  cls._instance = super().__new__(cls)
              return cls._instance
    `;

    const result = analyzer.analyzeCode(pythonCode, 'python');

    // Should still detect patterns even for unsupported languages
    expect(result).toHaveProperty('identifiedPatterns');
    expect(result).toHaveProperty('suggestedPatterns');
    expect(result).toHaveProperty('improvements');
  });

  it('should provide pattern improvement suggestions', () => {
    const badCode = `
      class GodObject {
        private data1: string;
        private data2: number;
        private data3: boolean;
        private data4: any[];
        private data5: Map<string, any>;
        private data6: Set<string>;
        private data7: Date;
        private data8: RegExp;
        private data9: Promise<any>;
        private data10: Error;

        constructor() {
          this.data1 = "";
          this.data2 = 0;
          this.data3 = false;
          this.data4 = [];
          this.data5 = new Map();
          this.data6 = new Set();
          this.data7 = new Date();
          this.data8 = /test/;
          this.data9 = Promise.resolve();
          this.data10 = new Error();
        }

        method1() { return this.data1; }
        method2() { return this.data2; }
        method3() { return this.data3; }
        method4() { return this.data4; }
        method5() { return this.data5; }
        method6() { return this.data6; }
        method7() { return this.data7; }
        method8() { return this.data8; }
        method9() { return this.data9; }
        method10() { return this.data10; }
        method11() { return this.data1 + this.data2; }
        method12() { return this.data3 && this.data4.length > 0; }
        method13() { this.data5.set('key', 'value'); }
        method14() { return this.data6.has('item'); }
        method15() { return this.data7.getTime(); }
        method16() { return this.data8.test('string'); }
        method17() { return this.data9.then(() => 'done'); }
        method18() { throw this.data10; }
        method19() { return this.data1.toUpperCase(); }
        method20() { return this.data2 * 2; }
        method21() { return !this.data3; }
      }
    `;

    const result = analyzer.analyzeCode(badCode, 'typescript');

    expect(result.antiPatterns).toBeDefined();
    expect(result.antiPatterns!.length).toBeGreaterThan(0);

    const godObjectAntiPattern = result.antiPatterns!.find(ap => ap.pattern === 'God Object');
    expect(godObjectAntiPattern).toBeDefined();
    expect(godObjectAntiPattern!.severity).toBe('high');
  });

  it('should suggest patterns for improvement', () => {
    const codeWithIssues = `
      if (type === 'A') {
        return new ProductA();
      } else if (type === 'B') {
        return new ProductB();
      } else if (type === 'C') {
        return new ProductC();
      } else {
        return new ProductD();
      }
    `;

    const result = analyzer.analyzeCode(codeWithIssues, 'typescript');

    expect(result.suggestedPatterns.length).toBeGreaterThan(0);

    const factorySuggestion = result.suggestedPatterns.find(s => s.pattern === 'Factory Method');
    expect(factorySuggestion).toBeDefined();
    expect(factorySuggestion!.confidence).toBeGreaterThan(0.5);
  });

  it('should generate improvement suggestions', () => {
    const poorCode = `
      function doEverything() {
        // 100 lines of mixed logic
        let x = 1;
        let y = 2;
        let z = 3;
        // ... lots of code without comments
        if (x > 0) {
          if (y > 0) {
            if (z > 0) {
            }
          }
        }
        // No error handling
        return x + y + z;
      }
    `;

    const result = analyzer.analyzeCode(poorCode, 'typescript');

    expect(result.improvements.length).toBeGreaterThan(0);
    expect(result.improvements).toContain('Add error handling to improve robustness');
  });
});
