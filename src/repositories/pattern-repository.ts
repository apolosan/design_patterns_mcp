/**
 * Pattern Repository Implementation
 * Concrete implementation of PatternRepository using SQLite
 */

import type { PatternRepository, SearchFilters, SearchResult } from './interfaces.js';
import type { Pattern } from '../models/pattern.js';
import type { DatabaseManager } from '../services/database-manager.js';
import { SqlValue } from '../services/statement-pool.js';

interface PatternRow {
  id: string;
  name: string;
  category: string;
  description: string;
  problem: string;
  solution: string;
  when_to_use: string;
  benefits: string;
  drawbacks: string;
  use_cases: string;
  complexity: string;
  tags: string;
  created_at: string;
  updated_at: string;
  also_known_as?: string;
  structure?: string;
  participants?: string;
  collaborations?: string;
  consequences?: string;
  implementation?: string;
  popularity?: number;
  metadata?: string;
}

interface ImplementationRow {
  id: string;
  pattern_id: string;
  language: string;
  approach: string;
  code: string;
  explanation: string;
  dependencies: string;
  created_at: string;
}

export class SqlitePatternRepository implements PatternRepository {
  constructor(private db: DatabaseManager) {}

  private mapRowToPattern(row: PatternRow, implementations: ImplementationRow[]): Pattern {
    const participants: string[] = row.participants ? JSON.parse(row.participants) : [];
    const alsoKnownAs: string[] | undefined = row.also_known_as ? JSON.parse(row.also_known_as) : undefined;
    const consequences: string[] | undefined = row.consequences ? JSON.parse(row.consequences) : undefined;
    const metadata: Record<string, unknown> | undefined = row.metadata ? JSON.parse(row.metadata) : undefined;
    const structure: string | undefined = row.structure || undefined;
    const collaborations: string[] | undefined = row.collaborations ? JSON.parse(row.collaborations) : undefined;

    const result: Pattern = {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      problem: row.problem ?? '',
      solution: row.solution ?? '',
      when_to_use: row.when_to_use ? JSON.parse(row.when_to_use) : [],
      benefits: row.benefits ? JSON.parse(row.benefits) : [],
      drawbacks: row.drawbacks ? JSON.parse(row.drawbacks) : [],
      use_cases: row.use_cases ? JSON.parse(row.use_cases) : [],
      complexity: row.complexity,
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      implementations: implementations.map(impl => ({
        id: impl.id,
        patternId: impl.pattern_id,
        language: impl.language,
        code: impl.code,
        explanation: impl.explanation,
        approach: impl.approach,
        dependencies: impl.dependencies ? JSON.parse(impl.dependencies) : [],
        complexity: undefined,
        createdAt: new Date(impl.created_at),
        updatedAt: new Date(impl.created_at),
      })),
      alsoKnownAs: alsoKnownAs as string[] | undefined,
      structure,
      participants,
      collaborations,
      consequences: consequences as string[] | undefined,
      implementation: row.implementation,
      popularity: row.popularity,
      metadata,
    };

    return result;
  }

  async findById(id: string): Promise<Pattern | null> {
    const patternRow = this.db.queryOne<PatternRow>(
      'SELECT * FROM patterns WHERE id = ?',
      [id]
    );
    
    if (!patternRow) {
      return null;
    }

    const implementations = this.db.query<ImplementationRow>(
      'SELECT * FROM pattern_implementations WHERE pattern_id = ? ORDER BY created_at ASC',
      [id]
    );

    return this.mapRowToPattern(patternRow, implementations);
  }

  async findByCategory(category: string): Promise<Pattern[]> {
    const rows = this.db.query<PatternRow>(
      'SELECT * FROM patterns WHERE category = ? ORDER BY name ASC',
      [category]
    );

    const patterns: Pattern[] = [];
    for (const row of rows) {
      const implementations = this.db.query<ImplementationRow>(
        'SELECT * FROM pattern_implementations WHERE pattern_id = ? ORDER BY created_at ASC',
        [row.id]
      );
      patterns.push(this.mapRowToPattern(row, implementations));
    }

    return patterns;
  }

  async search(filters: SearchFilters): Promise<SearchResult[]> {
    let sql = 'SELECT * FROM patterns WHERE 1=1';
    const params: SqlValue[] = [];

    if (filters.query) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR problem LIKE ? OR solution LIKE ?)';
      const searchTerm = `%${filters.query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.categories && filters.categories.length > 0) {
      const placeholders = filters.categories.map(() => '?').join(',');
      sql += ` AND category IN (${placeholders})`;
      params.push(...filters.categories.map(c => c as SqlValue));
    }

    if (filters.programmingLanguage) {
      sql += ` AND EXISTS (
        SELECT 1 FROM pattern_implementations 
        WHERE pattern_id = patterns.id AND language = ?
      )`;
      params.push(filters.programmingLanguage);
    }

    if (filters.complexity) {
      sql += ' AND complexity = ?';
      params.push(filters.complexity);
    }

    if (filters.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        sql += ` AND tags LIKE ?`;
        params.push(`%"${tag}"%`);
      }
    }

    sql += ' ORDER BY popularity DESC, name ASC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const rows = this.db.query<PatternRow>(sql, params);
    const results: SearchResult[] = [];

    for (const row of rows) {
      const implementations = this.db.query<ImplementationRow>(
        'SELECT * FROM pattern_implementations WHERE pattern_id = ?',
        [row.id]
      );
      const pattern = this.mapRowToPattern(row, implementations);
      const score = this.calculateSearchScore(pattern, filters);
      results.push({ pattern, score });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async findAll(): Promise<Pattern[]> {
    const rows = this.db.query<PatternRow>(
      'SELECT * FROM patterns ORDER BY category, name ASC'
    );

    const patterns: Pattern[] = [];
    for (const row of rows) {
      const implementations = this.db.query<ImplementationRow>(
        'SELECT * FROM pattern_implementations WHERE pattern_id = ?',
        [row.id]
      );
      patterns.push(this.mapRowToPattern(row, implementations));
    }

    return patterns;
  }

  async count(): Promise<number> {
    const result = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM patterns'
    );
    return Promise.resolve(result?.count ?? 0);
  }

  async countByCategory(): Promise<Record<string, number>> {
    const rows = this.db.query<{ category: string; count: number }>(
      'SELECT category, COUNT(*) as count FROM patterns GROUP BY category ORDER BY count DESC'
    );

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.category] = row.count;
    }

    return result;
  }

  async create(pattern: Pattern): Promise<Pattern> {
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO patterns (
        id, name, category, description, problem, solution,
        when_to_use, benefits, drawbacks, use_cases,
        complexity, tags, created_at, updated_at,
        also_known_as, structure, participants, collaborations,
        consequences, implementation, popularity, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params: SqlValue[] = [
      pattern.id,
      pattern.name,
      pattern.category,
      pattern.description,
      pattern.problem,
      pattern.solution,
      JSON.stringify(pattern.when_to_use),
      JSON.stringify(pattern.benefits),
      JSON.stringify(pattern.drawbacks),
      JSON.stringify(pattern.use_cases),
      pattern.complexity,
      JSON.stringify(pattern.tags),
      now,
      now,
      pattern.alsoKnownAs ? JSON.stringify(pattern.alsoKnownAs) : null,
      pattern.structure ?? null,
      pattern.participants && pattern.participants.length > 0 ? JSON.stringify(pattern.participants) : null,
      pattern.collaborations ? JSON.stringify(pattern.collaborations) : null,
      pattern.consequences ? JSON.stringify(pattern.consequences) : null,
      pattern.implementation ?? null,
      pattern.popularity ?? null,
      pattern.metadata ? JSON.stringify(pattern.metadata) : null,
    ];

    this.db.execute(sql, params);

    for (const impl of pattern.implementations) {
      const implSql = `
        INSERT INTO pattern_implementations (
          id, pattern_id, language, approach, code, explanation, dependencies, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      this.db.execute(implSql, [
        impl.id,
        impl.patternId,
        impl.language,
        impl.approach ?? '',
        impl.code,
        impl.explanation,
        impl.dependencies && impl.dependencies.length > 0 ? JSON.stringify(impl.dependencies) : null,
        new Date().toISOString(),
      ]);
    }

    const created = await this.findById(pattern.id);
    if (!created) throw new Error(`Pattern ${pattern.id} not found after creation`);
    return created;
  }

  async update(id: string, pattern: Partial<Pattern>): Promise<Pattern> {
    const updates: string[] = [];
    const params: SqlValue[] = [];

    if (pattern.name !== undefined) {
      updates.push('name = ?');
      params.push(pattern.name);
    }

    if (pattern.category !== undefined) {
      updates.push('category = ?');
      params.push(pattern.category);
    }

    if (pattern.description !== undefined) {
      updates.push('description = ?');
      params.push(pattern.description);
    }

    if (pattern.problem !== undefined) {
      updates.push('problem = ?');
      params.push(pattern.problem);
    }

    if (pattern.solution !== undefined) {
      updates.push('solution = ?');
      params.push(pattern.solution);
    }

    if (pattern.when_to_use !== undefined) {
      updates.push('when_to_use = ?');
      params.push(JSON.stringify(pattern.when_to_use));
    }

    if (pattern.benefits !== undefined) {
      updates.push('benefits = ?');
      params.push(JSON.stringify(pattern.benefits));
    }

    if (pattern.drawbacks !== undefined) {
      updates.push('drawbacks = ?');
      params.push(JSON.stringify(pattern.drawbacks));
    }

    if (pattern.use_cases !== undefined) {
      updates.push('use_cases = ?');
      params.push(JSON.stringify(pattern.use_cases));
    }

    if (pattern.complexity !== undefined) {
      updates.push('complexity = ?');
      params.push(pattern.complexity);
    }

    if (pattern.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(pattern.tags));
    }

    if (pattern.popularity !== undefined) {
      updates.push('popularity = ?');
      params.push(pattern.popularity);
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Pattern ${id} not found`);
      return existing;
    }

    params.push(id);

    const sql = `UPDATE patterns SET ${updates.join(', ')} WHERE id = ?`;
    this.db.execute(sql, params);

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Pattern ${id} not found after update`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.db.execute('DELETE FROM patterns WHERE id = ?', [id]);
  }

  async findByIds(ids: string[]): Promise<Pattern[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM patterns WHERE id IN (${placeholders}) ORDER BY name ASC`;

    const rows = this.db.query<PatternRow>(sql, ids.map(id => id as SqlValue));
    const patterns: Pattern[] = [];

    for (const row of rows) {
      const implementations = this.db.query<ImplementationRow>(
        'SELECT * FROM pattern_implementations WHERE pattern_id = ?',
        [row.id]
      );
      patterns.push(this.mapRowToPattern(row, implementations));
    }

    return patterns;
  }

  async findByTags(tags: string[]): Promise<Pattern[]> {
    if (tags.length === 0) return [];

    const results = new Map<string, Pattern>();

    for (const tag of tags) {
      const rows = this.db.query<PatternRow>(
        'SELECT * FROM patterns WHERE tags LIKE ?',
        [`%"${tag}"%`]
      );

      for (const row of rows) {
        if (!results.has(row.id)) {
          const implementations = this.db.query<ImplementationRow>(
            'SELECT * FROM pattern_implementations WHERE pattern_id = ?',
            [row.id]
          );
          results.set(row.id, this.mapRowToPattern(row, implementations));
        }
      }
    }

    return Array.from(results.values());
  }

  async exists(id: string): Promise<boolean> {
    const result = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM patterns WHERE id = ?',
      [id]
    );
    return Promise.resolve((result?.count ?? 0) > 0);
  }

  async save(pattern: Pattern): Promise<Pattern> {
    const exists = await this.exists(pattern.id);
    if (exists) {
      return this.update(pattern.id, pattern);
    } else {
      return this.create(pattern);
    }
  }

  private calculateSearchScore(pattern: Pattern, filters: SearchFilters): number {
    let score = pattern.popularity ?? 0;

    if (filters.query) {
      const lowerQuery = filters.query.toLowerCase();

      if (pattern.name.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }
      if (pattern.description.toLowerCase().includes(lowerQuery)) {
        score += 5;
      }
      if (pattern.problem.toLowerCase().includes(lowerQuery)) {
        score += 3;
      }
      if (pattern.solution.toLowerCase().includes(lowerQuery)) {
        score += 3;
      }
    }

    if (filters.tags) {
      const matchingTags = pattern.tags.filter(tag => filters.tags!.includes(tag));
      score += matchingTags.length * 2;
    }

    if (filters.category && pattern.category === filters.category) {
      score += 5;
    }

    if (filters.programmingLanguage) {
      const hasLanguage = pattern.implementations.some(
        impl => impl.language === filters.programmingLanguage
      );
      if (hasLanguage) score += 5;
    }

    return score;
  }

  async findAllSummaries(): Promise<Array<{id: string; name: string; category: string; description: string; complexity: string; tags: string}>> {
    const sql = 'SELECT id, name, category, description, complexity, tags FROM patterns ORDER BY name ASC';
    return this.db.query<{
      id: string;
      name: string;
      category: string;
      description: string;
      complexity: string;
      tags: string;
    }>(sql);
  }

  async findRelatedPatterns(sourcePatternId: string, types: string[] = ['alternative', 'similar']): Promise<Array<{target_pattern_id: string; type: string; description: string}>> {
    const placeholders = types.map(() => '?').join(',');
    const sql = `
      SELECT target_pattern_id, type, description
      FROM pattern_relationships
      WHERE source_pattern_id = ? AND type IN (${placeholders})
    `;
    return this.db.query<{
      target_pattern_id: string;
      type: string;
      description: string;
    }>(sql, [sourcePatternId, ...types]);
  }

  async findImplementations(patternId: string, language?: string): Promise<Array<{id: string; language: string; code: string; explanation: string}>> {
    let sql = 'SELECT id, language, code, explanation FROM pattern_implementations WHERE pattern_id = ?';
    const params: (string | SqlValue)[] = [patternId];

    if (language) {
      sql += ' AND language = ?';
      params.push(language);
    }

    sql += ' ORDER BY language, created_at DESC';
    return this.db.query<{
      id: string;
      language: string;
      code: string;
      explanation: string;
    }>(sql, params as SqlValue[]);
  }
}
