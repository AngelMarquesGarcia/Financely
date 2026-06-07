import { DatabaseService } from '../repository/database.service';
import { categoryRepository } from '../repository/category-repository.service';
import { Category } from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';

const db = DatabaseService.getInstance().db;

export function createCategory(
  name: string,
  color?: string,
  emoji?: string,
  envelopeId: number | null = null,
): number | bigint {
  if (!name.trim()) throw new AppError(AppErrorCode.CATEGORY_NAME_REQUIRED);
  return categoryRepository.insertCategory({ name, color, emoji, envelopeId });
}

export function getAllCategories(): Category[] {
  return categoryRepository.getAllCategories();
}

export function getCategoryById(id: number): Category | undefined {
  return categoryRepository.getCategoryById(id);
}

export function updateCategory(category: Category): boolean {
  if (!category.name.trim()) throw new AppError(AppErrorCode.CATEGORY_NAME_REQUIRED);
  return categoryRepository.updateCategory(category);
}

export function deleteCategory(id: number): boolean {
  if (categoryRepository.isDefault(id)) {
    throw new AppError(AppErrorCode.CATEGORY_DELETE_DEFAULT);
  }
  const defaultId = categoryRepository.getDefault();
  if (defaultId == null) {
    throw new AppError(AppErrorCode.CATEGORY_NO_DEFAULT);
  }

  const tx = db.transaction((fromId: number, toId: number) => {
    categoryRepository.reassignMovements(fromId, toId);
    return categoryRepository.deleteCategory(fromId);
  });
  return tx(id, defaultId);
}

export function setDefaultCategory(id: number): void {
  categoryRepository.setDefault(id);
}
