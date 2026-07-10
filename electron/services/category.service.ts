import { DatabaseService } from '../repository/database.service';
import { categoryRepository } from '../repository/category-repository.service';
import { CategoryT } from '@shared/types';
import { Category } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';

export class CategoryService {
  private readonly db = DatabaseService.getInstance().db;

  create(
    name: string,
    color?: string,
    emoji?: string,
    envelopeId: number | null = null,
  ): number | bigint {
    if (!name.trim()) throw new AppError(AppErrorCode.CATEGORY_NAME_REQUIRED);
    return categoryRepository.insertCategory({ name, color, emoji, envelopeId });
  }

  getAll(): CategoryT[] {
    return categoryRepository.getAllCategories();
  }

  getById(id: number): CategoryT | undefined {
    return categoryRepository.getCategoryById(id);
  }

  update(category: Category): boolean {
    if (!category.name.trim()) throw new AppError(AppErrorCode.CATEGORY_NAME_REQUIRED);
    return categoryRepository.updateCategory(category);
  }

  delete(id: number): boolean {
    if (categoryRepository.isDefault(id)) {
      throw new AppError(AppErrorCode.CATEGORY_DELETE_DEFAULT);
    }
    const defaultId = categoryRepository.getDefault();
    if (defaultId == null) {
      throw new AppError(AppErrorCode.CATEGORY_NO_DEFAULT);
    }

    const tx = this.db.transaction((fromId: number, toId: number) => {
      categoryRepository.reassignMovements(fromId, toId);
      return categoryRepository.deleteCategory(fromId);
    });
    return tx(id, defaultId);
  }

  setDefault(id: number): void {
    categoryRepository.setDefault(id);
  }
}

export const categoryService = new CategoryService();
