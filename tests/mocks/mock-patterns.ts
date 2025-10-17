/**
 * Mock pattern data for testing
 * Provides sample patterns for integration tests
 */

interface MockPattern {
  id: string;
  name: string;
  category: string;
  description: string;
  complexity: string;
  examples: string[];
  tags: string[];
}

export const MOCK_PATTERNS: MockPattern[] = [
  // GoF Patterns (23)
  { id: 'singleton', name: 'Singleton', category: 'GoF', description: 'Ensure single instance', complexity: 'Low', examples: ['typescript', 'python', 'java'], tags: ['creational', 'single-instance'] },
  { id: 'factory-method', name: 'Factory Method', category: 'GoF', description: 'Create objects without specifying class', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['creational', 'factory'] },
  { id: 'abstract-factory', name: 'Abstract Factory', category: 'GoF', description: 'Create families of related objects', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['creational', 'factory'] },
  { id: 'builder', name: 'Builder', category: 'GoF', description: 'Construct complex objects step by step', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['creational', 'builder'] },
  { id: 'prototype', name: 'Prototype', category: 'GoF', description: 'Clone existing objects', complexity: 'Low', examples: ['typescript', 'python', 'java'], tags: ['creational', 'cloning'] },
  { id: 'adapter', name: 'Adapter', category: 'GoF', description: 'Convert interface to another', complexity: 'Low', examples: ['typescript', 'python', 'java'], tags: ['structural', 'interface'] },
  { id: 'bridge', name: 'Bridge', category: 'GoF', description: 'Separate abstraction from implementation', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['structural', 'abstraction'] },
  { id: 'composite', name: 'Composite', category: 'GoF', description: 'Treat individual and composite objects uniformly', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['structural', 'tree'] },
  { id: 'decorator', name: 'Decorator', category: 'GoF', description: 'Add responsibilities to objects dynamically', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['structural', 'decoration'] },
  { id: 'facade', name: 'Facade', category: 'GoF', description: 'Provide unified interface to subsystem', complexity: 'Low', examples: ['typescript', 'python', 'java'], tags: ['structural', 'interface'] },
  { id: 'flyweight', name: 'Flyweight', category: 'GoF', description: 'Share objects to support large numbers', complexity: 'High', examples: ['typescript', 'python', 'java'], tags: ['structural', 'sharing'] },
  { id: 'proxy', name: 'Proxy', category: 'GoF', description: 'Provide surrogate for another object', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['structural', 'surrogate'] },
  { id: 'chain-of-responsibility', name: 'Chain of Responsibility', category: 'GoF', description: 'Pass request along handler chain', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'chain'] },
  { id: 'command', name: 'Command', category: 'GoF', description: 'Encapsulate request as object', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'command'] },
  { id: 'iterator', name: 'Iterator', category: 'GoF', description: 'Access elements sequentially', complexity: 'Low', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'iteration'] },
  { id: 'mediator', name: 'Mediator', category: 'GoF', description: 'Define communication between objects', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'communication'] },
  { id: 'memento', name: 'Memento', category: 'GoF', description: 'Capture and restore object state', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'state'] },
  { id: 'observer', name: 'Observer', category: 'GoF', description: 'Define dependency between objects', complexity: 'Low', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'notification'] },
  { id: 'state', name: 'State', category: 'GoF', description: 'Alter behavior when state changes', complexity: 'Medium', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'state'] },
  { id: 'strategy', name: 'Strategy', category: 'GoF', description: 'Define family of algorithms', complexity: 'Low', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'algorithm'] },
  { id: 'template-method', name: 'Template Method', category: 'GoF', description: 'Define algorithm skeleton', complexity: 'Low', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'algorithm'] },
  { id: 'visitor', name: 'Visitor', category: 'GoF', description: 'Define operations on object structure', complexity: 'High', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'operation'] },
  { id: 'interpreter', name: 'Interpreter', category: 'GoF', description: 'Define grammar representation', complexity: 'High', examples: ['typescript', 'python', 'java'], tags: ['behavioral', 'grammar'] },

  // Architectural Patterns
  { id: 'clean-architecture', name: 'Clean Architecture', category: 'Architectural', description: 'Separate concerns with layers', complexity: 'High', examples: ['typescript', 'python'], tags: ['architectural', 'layers'] },
  { id: 'hexagonal-architecture', name: 'Hexagonal Architecture', category: 'Architectural', description: 'Isolate core logic from external concerns', complexity: 'High', examples: ['typescript', 'java'], tags: ['architectural', 'ports-adapters'] },
  { id: 'onion-architecture', name: 'Onion Architecture', category: 'Architectural', description: 'Layered architecture with dependency inversion', complexity: 'High', examples: ['typescript', 'csharp'], tags: ['architectural', 'layers'] },
  { id: 'ddd-strategic', name: 'Domain-Driven Design (Strategic)', category: 'Architectural', description: 'Model complex business domains', complexity: 'High', examples: ['typescript', 'java'], tags: ['architectural', 'domain'] },
  { id: 'ddd-tactical', name: 'Domain-Driven Design (Tactical)', category: 'Architectural', description: 'Implement DDD building blocks', complexity: 'High', examples: ['typescript', 'java'], tags: ['architectural', 'domain'] },

  // Cloud-Native Patterns
  { id: 'circuit-breaker', name: 'Circuit Breaker', category: 'Cloud-Native', description: 'Handle service failures gracefully', complexity: 'Medium', examples: ['typescript', 'java'], tags: ['cloud', 'resilience'] },
  { id: 'bulkhead', name: 'Bulkhead', category: 'Cloud-Native', description: 'Isolate resources to prevent cascading failures', complexity: 'Medium', examples: ['typescript', 'java'], tags: ['cloud', 'isolation'] },
  { id: 'service-discovery', name: 'Service Discovery', category: 'Cloud-Native', description: 'Find and connect to services dynamically', complexity: 'Medium', examples: ['typescript', 'java'], tags: ['cloud', 'discovery'] },
  { id: 'api-gateway', name: 'API Gateway', category: 'Cloud-Native', description: 'Single entry point for microservices', complexity: 'Medium', examples: ['typescript', 'java'], tags: ['cloud', 'gateway'] },
  { id: 'saga', name: 'Saga', category: 'Cloud-Native', description: 'Manage distributed transactions', complexity: 'High', examples: ['typescript', 'java'], tags: ['cloud', 'transactions'] },

  // AI/ML Patterns
  { id: 'rag', name: 'Retrieval Augmented Generation', category: 'AI/ML', description: 'Enhance generation with retrieved knowledge', complexity: 'High', examples: ['python', 'typescript'], tags: ['ai', 'retrieval'] },
  { id: 'reflection', name: 'Reflection Pattern', category: 'AI/ML', description: 'AI systems that analyze their own reasoning', complexity: 'High', examples: ['python', 'typescript'], tags: ['ai', 'reflection'] },
  { id: 'tool-use', name: 'Tool Use Pattern', category: 'AI/ML', description: 'AI systems that use external tools', complexity: 'High', examples: ['python', 'typescript'], tags: ['ai', 'tools'] },
  { id: 'planning', name: 'Planning Pattern', category: 'AI/ML', description: 'AI systems that plan complex tasks', complexity: 'High', examples: ['python', 'typescript'], tags: ['ai', 'planning'] },

  // Functional Patterns
  { id: 'monad', name: 'Monad', category: 'Functional', description: 'Handle computations with context', complexity: 'High', examples: ['typescript', 'haskell'], tags: ['functional', 'monad'] },
  { id: 'functor', name: 'Functor', category: 'Functional', description: 'Apply functions to wrapped values', complexity: 'Medium', examples: ['typescript', 'haskell'], tags: ['functional', 'mapping'] },
  { id: 'memoization', name: 'Memoization', category: 'Functional', description: 'Cache function results', complexity: 'Low', examples: ['typescript', 'python'], tags: ['functional', 'caching'] },

  // Reactive Patterns
  { id: 'observable', name: 'Observable', category: 'Reactive', description: 'Push-based data streams', complexity: 'Medium', examples: ['typescript', 'java'], tags: ['reactive', 'streams'] },
  { id: 'subject', name: 'Subject', category: 'Reactive', description: 'Observable that can multicast', complexity: 'Medium', examples: ['typescript', 'java'], tags: ['reactive', 'multicast'] },
  { id: 'backpressure', name: 'Backpressure', category: 'Reactive', description: 'Handle fast producers and slow consumers', complexity: 'High', examples: ['typescript', 'java'], tags: ['reactive', 'flow-control'] },

  // Anti-Patterns
  { id: 'god-object', name: 'God Object', category: 'Anti-Pattern', description: 'Object that knows too much or does too much', complexity: 'High', examples: ['typescript', 'java'], tags: ['anti-pattern', 'complexity'] },
  { id: 'spaghetti-code', name: 'Spaghetti Code', category: 'Anti-Pattern', description: 'Code with complex and tangled control structures', complexity: 'High', examples: ['typescript', 'python'], tags: ['anti-pattern', 'complexity'] }
];

export function getMockPatternsByCategory(category: string): MockPattern[] {
  return MOCK_PATTERNS.filter(p => p.category === category);
}

function getMockPatternById(id: string): MockPattern | undefined {
  return MOCK_PATTERNS.find(p => p.id === id);
}

export function getAllMockCategories(): string[] {
  return [...new Set(MOCK_PATTERNS.map(p => p.category))];
}

export function getMockPatternsCount(): number {
  return MOCK_PATTERNS.length;
}