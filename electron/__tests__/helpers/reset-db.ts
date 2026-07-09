import { DatabaseService } from '../../repository/database.service';

/**
 * Resets an integration-test database to a clean, demo-seeded state. Replaces the old habit of calling
 * `migrate()` (which used to drop + recreate + seed) now that `migrate()` is non-destructive: this
 * composes the two explicit lifecycle methods to reproduce the same fixture between tests.
 */
export function resetTestDb(): void {
  const db = DatabaseService.getInstance();
  db.dropAllTables();
  db.createExampleData();
}
