/**
 * Pattern Repository Implementation
 * Concrete implementation of PatternRepository using SQLite
 */

import type { PatternRepository, SearchFilters, SearchResult } from './interfaces.js';
import type { Pattern } from '../models/pattern.js';
import type { DatabaseManager } from '../services/database-manager.js';
import { parseTags } from '../utils/parse-tags.js';

interface PatternRow {
  id: string;
  name: string;
  category: string;
  description: string;
  problem: string;
  solution: string;
  when_to_use?: string;
  benefits?: string;
  drawbacks?: string;
  complexity?: string;
  structure?: string;
  participants?: string;
  collaborations?: string;
  consequences?: string;
  implementation?: string;
  use_cases?: string;
  examples?: string;
  related_patterns?: string;
  also_known_as?: string;
  tags?: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

export class SqlitePatternRepository implements PatternRepository {
  constructor(private db: DatabaseManager) {}

  private validateId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid pattern ID: ID must be a non-empty string');
    }
    if (id.length > 255) {
      throw new Error('Invalid pattern ID: ID must not exceed 255 characters');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error('Invalid pattern ID: ID must contain only alphanumeric characters, hyphens, and underscores');
    }
  }

  private validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid pattern name: name must be a non-empty string');
    }
    if (name.length > 255) {
      throw new Error('Invalid pattern name: name must not exceed 255 characters');
    }
  }

  private sanitizeWildcards(value: string): string {
    return value.replace(/[%_]/g, '\\$&');
  }

  async findById(id: string): Promise<Pattern | null> {
    this.validateId(id);
    const query = 'SELECT * FROM patterns WHERE id = ?';
    const row = this.db.get<PatternRow>(query, [id]);
    return row ? this.mapRowToPattern(row) : null;
  }

  async findByName(name: string): Promise<Pattern | null> {
    this.validateName(name);
    const query = 'SELECT * FROM patterns WHERE name = ? COLLATE NOCASE';
    const row = this.db.get<PatternRow>(query, [name]);
    return row ? this.mapRowToPattern(row) : null;
  }

  async findAll(filters?: SearchFilters): Promise<Pattern[]> {
    let query = 'SELECT * FROM patterns WHERE 1=1';
    const params: any[] = [];

    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters?.complexity) {
      query += ' AND json_extract(metadata, "$.complexity") = ?';
      params.push(filters.complexity);
    }

    if (filters?.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map(() => 'tags LIKE ?').join(' AND ');
      query += ` AND (${tagConditions})`;
      filters.tags.forEach(tag => params.push(`%${tag}%`));
    }

    query += ' ORDER BY name';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const rows = this.db.all<PatternRow>(query, params);
    return rows.map(row => this.mapRowToPattern(row));
  }

  async save(pattern: Pattern): Promise<Pattern> {
    const query = `
      INSERT INTO patterns (
        id, name, category, description, problem, solution,
        structure, participants, collaborations, consequences,
        implementation, use_cases, examples, related_patterns,
        also_known_as, tags, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const now = new Date().toISOString();
    const params = [
      pattern.id,
      pattern.name,
      pattern.category,
      pattern.description,
      pattern.problem,
      pattern.solution,
      pattern.structure || null,
      pattern.participants || null,
      pattern.collaborations || null,
      pattern.consequences || null,
      pattern.implementation || null,
      pattern.useCases || null,
      pattern.examples || null,
      pattern.relatedPatterns ? JSON.stringify(pattern.relatedPatterns) : null,
      pattern.alsoKnownAs ? JSON.stringify(pattern.alsoKnownAs) : null,
      pattern.tags ? pattern.tags.join(',') : null,
      pattern.metadata ? JSON.stringify(pattern.metadata) : null,
      pattern.createdAt || now,
      pattern.updatedAt || now
    ];

    this.db.run(query, params);
    return { ...pattern, createdAt: pattern.createdAt || now, updatedAt: pattern.updatedAt || now };
  }

  async update(id: string, pattern: Partial<Pattern>): Promise<Pattern | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    const fields = [
      'name', 'category', 'description', 'problem', 'solution',
      'structure', 'participants', 'collaborations', 'consequences',
      'implementation', 'use_cases', 'examples'
    ];

    fields.forEach(field => {
      if (field in pattern) {
        updates.push(`${field} = ?`);
        params.push((pattern as any)[field === 'use_cases' ? 'useCases' : field]);
      }
    });

    if (pattern.relatedPatterns) {
      updates.push('related_patterns = ?');
      params.push(JSON.stringify(pattern.relatedPatterns));
    }

    if (pattern.alsoKnownAs) {
      updates.push('also_known_as = ?');
      params.push(JSON.stringify(pattern.alsoKnownAs));
    }

    if (pattern.tags) {
      updates.push('tags = ?');
      params.push(pattern.tags.join(','));
    }

    if (pattern.metadata) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(pattern.metadata));
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);

    const query = `UPDATE patterns SET ${updates.join(', ')} WHERE id = ?`;
    this.db.run(query, params);

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM patterns WHERE id = ?';
    const result = this.db.run(query, [id]);
    return result.changes > 0;
  }

  async findByCategory(category: string, limit?: number): Promise<Pattern[]> {
    let query = 'SELECT * FROM patterns WHERE category = ? ORDER BY name';
    const params: any[] = [category];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.all<PatternRow>(query, params);
    return rows.map(row => this.mapRowToPattern(row));
  }

  async findByTags(tags: string[], matchAll: boolean = false): Promise<Pattern[]> {
    if (tags.length === 0) return [];

    tags.forEach(tag => {
      if (!tag || typeof tag !== 'string' || tag.length > 100) {
        throw new Error('Invalid tag: tags must be non-empty strings not exceeding 100 characters');
      }
    });

    let query: string;
    const params: string[] = [];

    if (matchAll) {
      const conditions = tags.map(() => 'tags LIKE ?').join(' AND ');
      query = `SELECT * FROM patterns WHERE ${conditions}`;
      tags.forEach(tag => params.push(`%${this.sanitizeWildcards(tag)}%`));
    } else {
      const conditions = tags.map(() => 'tags LIKE ?').join(' OR ');
      query = `SELECT * FROM patterns WHERE ${conditions}`;
      tags.forEach(tag => params.push(`%${this.sanitizeWildcards(tag)}%`));
    }

    const rows = this.db.all<PatternRow>(query, params);
    return rows.map(row => this.mapRowToPattern(row));
  }

  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    const searchQuery = `
      SELECT p.*, 
        (CASE 
          WHEN name LIKE ? THEN 10
          WHEN description LIKE ? THEN 5
          WHEN problem LIKE ? OR solution LIKE ? THEN 3
          ELSE 1
        END) as score
      FROM patterns p
      WHERE name LIKE ? 
        OR description LIKE ?
        OR problem LIKE ?
        OR solution LIKE ?
        OR tags LIKE ?
    `;

    const searchTerm = `%${query}%`;
    const params = Array(9).fill(searchTerm);

    if (filters?.category) {
      params.push(filters.category);
    }

    let fullQuery = searchQuery;
    if (filters?.category) {
      fullQuery += ' AND category = ?';
    }

    fullQuery += ' ORDER BY score DESC, name';

    if (filters?.limit) {
      fullQuery += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.all<PatternRow & { score: number }>(fullQuery, params);
    
    return rows.map(row => ({
      pattern: this.mapRowToPattern(row),
      score: row.score / 10, // Normalize score to 0-1
      highlights: this.getHighlights(row, query)
    }));
  }

  async findByIds(ids: string[]): Promise<Pattern[]> {
    if (ids.length === 0) return [];

    ids.forEach(id => this.validateId(id));

    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT * FROM patterns WHERE id IN (${placeholders})`;
    
    const rows = this.db.all<PatternRow>(query, ids);
    return rows.map(row => this.mapRowToPattern(row));
  }

  async saveMany(patterns: Pattern[]): Promise<Pattern[]> {
    const saved: Pattern[] = [];
    
    for (const pattern of patterns) {
      const savedPattern = await this.save(pattern);
      saved.push(savedPattern);
    }

    return saved;
  }

  async count(filters?: SearchFilters): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM patterns WHERE 1=1';
    const params: any[] = [];

    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters?.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map(() => 'tags LIKE ?').join(' AND ');
      query += ` AND (${tagConditions})`;
      filters.tags.forEach(tag => params.push(`%${tag}%`));
    }

    const result = this.db.get<{ count: number }>(query, params);
    return result?.count || 0;
  }

  async exists(id: string): Promise<boolean> {
    const query = 'SELECT 1 FROM patterns WHERE id = ? LIMIT 1';
    const result = this.db.get(query, [id]);
    return !!result;
  }

  private mapRowToPattern(row: PatternRow): Pattern {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      problem: row.problem,
      solution: row.solution,
      when_to_use: row.when_to_use ? (typeof row.when_to_use === 'string' ? JSON.parse(row.when_to_use) : row.when_to_use) : [],
      benefits: row.benefits ? (typeof row.benefits === 'string' ? JSON.parse(row.benefits) : row.benefits) : [],
      drawbacks: row.drawbacks ? (typeof row.drawbacks === 'string' ? JSON.parse(row.drawbacks) : row.drawbacks) : [],
      use_cases: row.use_cases ? JSON.parse(row.use_cases) : [],
      implementations: [],
      relatedPatterns: row.related_patterns ? JSON.parse(row.related_patterns) : undefined,
      complexity: row.complexity || 'Medium',
      popularity: 0.5,
      tags: row.tags ? parseTags(row.tags) : [],
      structure: row.structure,
      participants: row.participants,
      collaborations: row.collaborations,
      consequences: row.consequences,
      implementation: row.implementation,
      useCases: row.use_cases ? (typeof row.use_cases === 'string' ? JSON.parse(row.use_cases) : row.use_cases) : [],
      examples: row.examples ? (typeof row.examples === 'string' ? JSON.parse(row.examples) : row.examples) : undefined,
      alsoKnownAs: row.also_known_as ? JSON.parse(row.also_known_as) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private getHighlights(row: PatternRow, query: string): string[] {
    const highlights: string[] = [];
    const searchTerm = query.toLowerCase();

    if (row.name.toLowerCase().includes(searchTerm)) {
      highlights.push(`Name: ${row.name}`);
    }
    if (row.description.toLowerCase().includes(searchTerm)) {
      const snippet = this.extractSnippet(row.description, searchTerm);
      highlights.push(`Description: ...${snippet}...`);
    }
    if (row.problem && row.problem.toLowerCase().includes(searchTerm)) {
      const snippet = this.extractSnippet(row.problem, searchTerm);
      highlights.push(`Problem: ...${snippet}...`);
    }

    return highlights;
  }

  private extractSnippet(text: string, searchTerm: string, contextLength: number = 50): string {
    const index = text.toLowerCase().indexOf(searchTerm);
    if (index === -1) return '';

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + searchTerm.length + contextLength);
    
    return text.substring(start, end);
  }
}