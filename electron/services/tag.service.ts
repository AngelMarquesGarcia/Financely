import { tagRepository } from '../repository/tag-repository.service';
import { TagT } from '@shared/types';
import { Tag } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';

export class TagService {
  create(type: string, name: string, color: string): number | bigint {
    if (!type.trim()) throw new AppError(AppErrorCode.TAG_TYPE_REQUIRED);
    if (!name.trim()) throw new AppError(AppErrorCode.TAG_NAME_REQUIRED);
    return tagRepository.insertTag({ type, name, color });
  }

  getAll(): TagT[] {
    return tagRepository.getAllTags();
  }

  getById(id: number): TagT | undefined {
    return tagRepository.getTagById(id);
  }

  update(tag: Tag): boolean {
    if (!tag.type.trim()) throw new AppError(AppErrorCode.TAG_TYPE_REQUIRED);
    if (!tag.name.trim()) throw new AppError(AppErrorCode.TAG_NAME_REQUIRED);
    return tagRepository.updateTag(tag);
  }

  delete(id: number): boolean {
    return tagRepository.deleteTag(id);
  }

  addToMovement(tagId: number, movementId: number): void {
    tagRepository.addTagToMovement(tagId, movementId);
  }

  removeFromMovement(tagId: number, movementId: number): void {
    tagRepository.removeTagFromMovement(tagId, movementId);
  }

  getForMovement(movementId: number): TagT[] {
    return tagRepository.getTagsForMovement(movementId);
  }

  getForMovements(movementIds: number[]): Record<number, TagT[]> {
    return tagRepository.getTagsForMovements(movementIds);
  }
}

export const tagService = new TagService();
