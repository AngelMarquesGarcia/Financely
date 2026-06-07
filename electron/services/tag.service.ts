import { tagRepository } from '../repository/tag-repository.service';
import { Tag } from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';

export function createTag(type: string, name: string, color: string): number | bigint {
  if (!type.trim()) throw new AppError(AppErrorCode.TAG_TYPE_REQUIRED);
  if (!name.trim()) throw new AppError(AppErrorCode.TAG_NAME_REQUIRED);
  return tagRepository.insertTag({ type, name, color });
}

export function getAllTags(): Tag[] {
  return tagRepository.getAllTags();
}

export function getTagById(id: number): Tag | undefined {
  return tagRepository.getTagById(id);
}

export function updateTag(tag: Tag): boolean {
  if (!tag.type.trim()) throw new AppError(AppErrorCode.TAG_TYPE_REQUIRED);
  if (!tag.name.trim()) throw new AppError(AppErrorCode.TAG_NAME_REQUIRED);
  return tagRepository.updateTag(tag);
}

export function deleteTag(id: number): boolean {
  return tagRepository.deleteTag(id);
}

export function addTagToMovement(tagId: number, movementId: number): void {
  tagRepository.addTagToMovement(tagId, movementId);
}

export function removeTagFromMovement(tagId: number, movementId: number): void {
  tagRepository.removeTagFromMovement(tagId, movementId);
}

export function getTagsForMovement(movementId: number): Tag[] {
  return tagRepository.getTagsForMovement(movementId);
}

export function getTagsForMovements(movementIds: number[]): Record<number, Tag[]> {
  return tagRepository.getTagsForMovements(movementIds);
}
