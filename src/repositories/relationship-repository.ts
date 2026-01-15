/**
 * Relationship Repository Implementation
 * Concrete implementation of RelationshipRepository using SQLite
 */

import type { RelationshipRepository } from './interfaces.js';
import type {
  Relationship,
  RelationshipType,
  CreateRelationshipInput,
  UpdateRelationshipInput,
  RelationshipFilters,
  RelationshipWithPatterns,
} from '../models/relationship.js';
import type { DatabaseManager } from '../services/database-manager.js';

interface RelationshipRow {
  id: string;
  source_pattern_id: string;
  target_pattern_id: string;
  type: string;
  strength: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface RelationshipWithPatternsRow extends RelationshipRow {
  source_id: string;
  source_name: string;
  source_category: string;
  target_id: string;
  target_name: string;
  target_category: string;
}

export class SqliteRelationshipRepository implements RelationshipRepository {
  constructor(private db: DatabaseManager) {}

  private mapRowToRelationship(row: RelationshipRow): Relationship {
    return {
      id: row.id,
      sourcePatternId: row.source_pattern_id,
      targetPatternId: row.target_pattern_id,
      type: row.type as RelationshipType,
      strength: row.strength,
      description: row.description ?? '',
      createdAt: new Date(row.created_at),
    };
  }

  async findBySourceId(sourceId: string): Promise<Relationship[]> {
    const sql =
      'SELECT * FROM pattern_relationships WHERE source_pattern_id = ? ORDER BY strength DESC, created_at DESC';
    const rows = this.db.query<RelationshipRow>(sql, [sourceId]);
    return Promise.resolve(rows.map(row => this.mapRowToRelationship(row)));
  }

  async findByTargetId(targetId: string): Promise<Relationship[]> {
    const sql =
      'SELECT * FROM pattern_relationships WHERE target_pattern_id = ? ORDER BY strength DESC, created_at DESC';
    const rows = this.db.query<RelationshipRow>(sql, [targetId]);
    return Promise.resolve(rows.map(row => this.mapRowToRelationship(row)));
  }

  async findByType(type: string): Promise<Relationship[]> {
    const sql =
      'SELECT * FROM pattern_relationships WHERE type = ? ORDER BY strength DESC, created_at DESC';
    const rows = this.db.query<RelationshipRow>(sql, [type]);
    return Promise.resolve(rows.map(row => this.mapRowToRelationship(row)));
  }

  async findByPatternId(patternId: string): Promise<Relationship[]> {
    const sql = `
      SELECT * FROM pattern_relationships
      WHERE source_pattern_id = ? OR target_pattern_id = ?
      ORDER BY strength DESC, created_at DESC
    `;
    const rows = this.db.query<RelationshipRow>(sql, [patternId, patternId]);
    return Promise.resolve(rows.map(row => this.mapRowToRelationship(row)));
  }

  async findWithPatterns(filters?: RelationshipFilters): Promise<RelationshipWithPatterns[]> {
    let sql = `
      SELECT
        r.*,
        sp.id as source_id, sp.name as source_name, sp.category as source_category,
        tp.id as target_id, tp.name as target_name, tp.category as target_category
      FROM pattern_relationships r
      JOIN patterns sp ON r.source_pattern_id = sp.id
      JOIN patterns tp ON r.target_pattern_id = tp.id
      WHERE 1=1
    `;

    const params: (string | number)[] = [];

    if (filters?.sourcePatternId) {
      sql += ' AND r.source_pattern_id = ?';
      params.push(filters.sourcePatternId);
    }

    if (filters?.targetPatternId) {
      sql += ' AND r.target_pattern_id = ?';
      params.push(filters.targetPatternId);
    }

    if (filters?.type) {
      sql += ' AND r.type = ?';
      params.push(filters.type);
    }

    if (filters?.minStrength !== undefined) {
      sql += ' AND r.strength >= ?';
      params.push(filters.minStrength);
    }

    sql += ' ORDER BY r.strength DESC, r.created_at DESC';

    const rows = this.db.query<RelationshipWithPatternsRow>(sql, params);
    return Promise.resolve(rows.map(row => ({
      id: row.id,
      sourcePatternId: row.source_pattern_id,
      targetPatternId: row.target_pattern_id,
      type: row.type as RelationshipType,
      strength: row.strength,
      description: row.description ?? '',
      createdAt: new Date(row.created_at),
      sourcePattern: {
        id: row.source_id,
        name: row.source_name,
        category: row.source_category,
      },
      targetPattern: {
        id: row.target_id,
        name: row.target_name,
        category: row.target_category,
      },
    })));
  }

  async save(input: CreateRelationshipInput): Promise<Relationship> {
    // Validate that source pattern exists
    const sourceExists = await this.patternExists(input.sourcePatternId);
    if (!sourceExists) {
      throw new Error(`Source pattern '${input.sourcePatternId}' does not exist`);
    }

    // Validate that target pattern exists
    const targetExists = await this.patternExists(input.targetPatternId);
    if (!targetExists) {
      throw new Error(`Target pattern '${input.targetPatternId}' does not exist`);
    }

    // Check if relationship already exists
    const exists = await this.exists(input.sourcePatternId, input.targetPatternId);
    if (exists) {
      throw new Error(
        `Relationship between ${input.sourcePatternId} and ${input.targetPatternId} already exists`
      );
    }

    const id = crypto.randomUUID();
    const strength = input.strength ?? 1.0;

    const sql = `
      INSERT INTO pattern_relationships (
        id, source_pattern_id, target_pattern_id, type, strength, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      input.sourcePatternId,
      input.targetPatternId,
      input.type,
      strength,
      input.description,
      new Date().toISOString(),
    ];

    this.db.execute(sql, params);

    return {
      id,
      sourcePatternId: input.sourcePatternId,
      targetPatternId: input.targetPatternId,
      type: input.type,
      strength,
      description: input.description,
      createdAt: new Date(),
    };
  }

  async update(id: string, input: UpdateRelationshipInput): Promise<Relationship | null> {
    // First check if relationship exists
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (input.type !== undefined) {
      updates.push('type = ?');
      params.push(input.type);
    }

    if (input.strength !== undefined) {
      updates.push('strength = ?');
      params.push(input.strength);
    }

    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }

    if (updates.length === 0) {
      return existing; // No changes
    }

    const sql = `UPDATE pattern_relationships SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    this.db.execute(sql, params);

    // Return updated relationship
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const sql = 'DELETE FROM pattern_relationships WHERE id = ?';
    this.db.run(sql, [id]);
    return Promise.resolve();
  }

  async deleteById(id: string): Promise<boolean> {
    // Check if relationship exists before deletion
    const existsBefore = await this.findById(id);
    if (!existsBefore) {
      return false;
    }

    const sql = 'DELETE FROM pattern_relationships WHERE id = ?';
    this.db.run(sql, [id]);

    // Verify deletion
    const existsAfter = await this.findById(id);
    return !existsAfter;
  }

  async exists(sourceId: string, targetId: string): Promise<boolean> {
    const sql =
      'SELECT COUNT(*) as count FROM pattern_relationships WHERE source_pattern_id = ? AND target_pattern_id = ?';
    const result = this.db.queryOne<{ count: number }>(sql, [sourceId, targetId]);
    return Promise.resolve((result?.count ?? 0) > 0);
  }

  async patternExists(patternId: string): Promise<boolean> {
    const sql = 'SELECT COUNT(*) as count FROM patterns WHERE id = ?';
    const result = this.db.queryOne<{ count: number }>(sql, [patternId]);
    return Promise.resolve((result?.count ?? 0) > 0);
  }

  async findById(id: string): Promise<Relationship | null> {
    const sql = 'SELECT * FROM pattern_relationships WHERE id = ?';
    const row = this.db.queryOne<RelationshipRow>(sql, [id]);
    return Promise.resolve(row ? this.mapRowToRelationship(row) : null);
  }

  async count(filters?: RelationshipFilters): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM pattern_relationships WHERE 1=1';
    const params: (string | number)[] = [];

    if (filters?.sourcePatternId) {
      sql += ' AND source_pattern_id = ?';
      params.push(filters.sourcePatternId);
    }

    if (filters?.targetPatternId) {
      sql += ' AND target_pattern_id = ?';
      params.push(filters.targetPatternId);
    }

    if (filters?.type) {
      sql += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters?.minStrength !== undefined) {
      sql += ' AND strength >= ?';
      params.push(filters.minStrength);
    }

    const result = this.db.queryOne<{ count: number }>(sql, params);
    return Promise.resolve(result?.count ?? 0);
  }

  async create(relationship: CreateRelationshipInput): Promise<Relationship> {
    const sql = `
      INSERT INTO pattern_relationships (source_pattern_id, target_pattern_id, relationship_type, strength, description)
      VALUES (?, ?, ?, ?, ?)
    `;
    this.db.run(sql, [
      relationship.sourcePatternId,
      relationship.targetPatternId,
      relationship.type,
      relationship.strength ?? 0.5,
      relationship.description,
    ]);

    const lastId = this.db.queryOne<{ id: string }>('SELECT last_insert_rowid() as id');
    const created = await this.findById(lastId?.id ?? '');
    if (!created) {
      throw new Error('Failed to create relationship');
    }
    return created;
  }

  async findAll(): Promise<Relationship[]> {
    const sql = 'SELECT * FROM pattern_relationships ORDER BY created_at DESC';
    const rows = this.db.query<RelationshipRow>(sql);
    return Promise.resolve(rows.map(row => this.mapRowToRelationship(row)));
  }
}
