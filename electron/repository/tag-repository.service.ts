import { TagT } from '@shared/types';
import { DatabaseService } from './database.service';
import { tables } from '../constants';

export class TagRepository {
  private readonly db = DatabaseService.getInstance().db;

  insertTag(tag: Omit<TagT, 'id'>): number | bigint {
    return this.db
      .prepare(`INSERT INTO ${tables.tags} (type, name, color) VALUES (:type, :name, :color)`)
      .run(tag).lastInsertRowid;
  }

  getAllTags(): TagT[] {
    return this.db.prepare(`SELECT * FROM ${tables.tags}`).all() as TagT[];
  }

  getTagById(id: number): TagT | undefined {
    return this.db
      .prepare(`SELECT * FROM ${tables.tags} WHERE id = ?`)
      .get(id) as TagT | undefined;
  }

  updateTag(tag: TagT): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ${tables.tags} SET type = :type, name = :name, color = :color WHERE id = :id`,
        )
        .run(tag).changes > 0
    );
  }

  deleteTag(id: number): boolean {
    return this.db.prepare(`DELETE FROM ${tables.tags} WHERE id = ?`).run(id).changes === 1;
  }

  addTagToMovement(tagId: number, movementId: number): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO ${tables.movementTags} (movement_id, tag_id) VALUES (?, ?)`,
      )
      .run(movementId, tagId);
  }

  removeTagFromMovement(tagId: number, movementId: number): void {
    this.db
      .prepare(`DELETE FROM ${tables.movementTags} WHERE movement_id = ? AND tag_id = ?`)
      .run(movementId, tagId);
  }

  getTagsForMovement(movementId: number): TagT[] {
    return this.db
      .prepare(
        `SELECT ${tables.tags}.* FROM ${tables.tags}
         JOIN ${tables.movementTags} ON ${tables.tags}.id = ${tables.movementTags}.tag_id
         WHERE ${tables.movementTags}.movement_id = ?`,
      )
      .all(movementId) as TagT[];
  }

  getTagsForMovements(movementIds: number[]): Record<number, TagT[]> {
    if (movementIds.length === 0) return {};
    const placeholders = movementIds.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT ${tables.movementTags}.movement_id as movementId, ${tables.tags}.*
         FROM ${tables.tags}
         JOIN ${tables.movementTags} ON ${tables.tags}.id = ${tables.movementTags}.tag_id
         WHERE ${tables.movementTags}.movement_id IN (${placeholders})`,
      )
      .all(...movementIds) as (TagT & { movementId: number })[];
    const map: Record<number, TagT[]> = {};
    for (const row of rows) {
      const { movementId, ...tag } = row;
      (map[movementId] ??= []).push(tag);
    }
    return map;
  }
}

export const tagRepository = new TagRepository();
