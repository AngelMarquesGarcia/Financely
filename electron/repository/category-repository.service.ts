import { CategoryT } from '@shared/types';
import { DatabaseService } from './database.service';
import { tables } from '../constants';

export class CategoryRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, name, color, emoji, envelope_id as envelopeId, is_default as isDefault`;
  private readonly selectColsWithCount = `c.id, c.name, c.color, c.emoji, c.envelope_id as envelopeId, c.is_default as isDefault, COUNT(m.id) as movementCount`;

  insertCategory(cat: Omit<CategoryT, 'id' | 'isDefault'>): number | bigint {
    const stmt = this.db.prepare(
      `INSERT INTO ${tables.categories} (name, color, emoji, envelope_id)
       VALUES (:name, :color, :emoji, :envelopeId)`,
    );
    return stmt.run({ emoji: null, ...cat }).lastInsertRowid;
  }

  getAllCategories(): CategoryT[] {
    return (
      this.db
        .prepare(
          `SELECT ${this.selectColsWithCount} FROM ${tables.categories} c
           LEFT JOIN ${tables.movements} m ON m.category_id = c.id
           GROUP BY c.id`,
        )
        .all() as RawCategory[]
    ).map(toCategory);
  }

  getCategoryById(id: number): CategoryT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.categories} WHERE id = ?`)
      .get(id) as RawCategory | undefined;
    return row ? toCategory(row) : undefined;
  }

  updateCategory(cat: CategoryT): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ${tables.categories}
           SET name = :name, color = :color, emoji = :emoji, envelope_id = :envelopeId
           WHERE id = :id`,
        )
        .run({ emoji: null, ...cat }).changes > 0
    );
  }

  deleteCategory(id: number): boolean {
    return this.db.prepare(`DELETE FROM ${tables.categories} WHERE id = ?`).run(id).changes === 1;
  }

  isDefault(id: number): boolean {
    const row = this.db
      .prepare(`SELECT is_default as isDefault FROM ${tables.categories} WHERE id = ?`)
      .get(id) as { isDefault: number } | undefined;
    return row?.isDefault === 1;
  }

  /** Returns the id of the default category, or undefined if none is set. */
  getDefault(): number | undefined {
    const row = this.db
      .prepare(`SELECT id FROM ${tables.categories} WHERE is_default = 1 LIMIT 1`)
      .get() as { id: number } | undefined;
    return row?.id;
  }

  /** Sets the given category as the only default. Transactional. */
  setDefault(id: number): void {
    const tx = this.db.transaction((targetId: number) => {
      this.db.prepare(`UPDATE ${tables.categories} SET is_default = 0 WHERE is_default = 1`).run();
      this.db.prepare(`UPDATE ${tables.categories} SET is_default = 1 WHERE id = ?`).run(targetId);
    });
    tx(id);
  }

  /** Reassigns all movements from one category to another. */
  reassignMovements(fromId: number, toId: number): void {
    this.db
      .prepare(`UPDATE ${tables.movements} SET category_id = ? WHERE category_id = ?`)
      .run(toId, fromId);
  }
}

type RawCategory = {
  id: number;
  name: string;
  color: string | null;
  emoji: string | null;
  envelopeId: number | null;
  isDefault: number;
  movementCount?: number;
};
function toCategory(r: RawCategory): CategoryT {
  return {
    id: r.id,
    name: r.name,
    color: r.color ?? undefined,
    emoji: r.emoji ?? undefined,
    envelopeId: r.envelopeId,
    isDefault: r.isDefault === 1,
    movementCount: r.movementCount ?? 0,
  };
}

export const categoryRepository = new CategoryRepository();
