import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { Tag } from '@shared/types';
import { TagsListComponent } from './tags-list/tags-list.component';

@Component({
  selector: 'app-tags',
  imports: [TagsListComponent],
  templateUrl: './tags.component.html',
  styleUrl: './tags.component.scss',
})
export class TagsComponent implements OnInit {
  private electron = inject(ElectronService);
  private errors = inject(ErrorReporter);
  private destroyRef = inject(DestroyRef);

  tags: Tag[] = [];

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.electron
      .getAllTags()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => (this.tags = list));
  }
}
