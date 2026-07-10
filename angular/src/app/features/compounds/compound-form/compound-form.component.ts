import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { concat, forkJoin, Observable, of, switchMap, take, toArray } from 'rxjs';
import { CompoundMovementT, MovementT, NewCompoundFields } from '@shared/types';
import { ElectronService } from '../../../core/services/electron.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { DataRefreshService } from '../../../core/services/data-refresh.service';
import { DialogService } from '../../../core/services/dialog.service';
import { DialogRef } from '../../../core/services/dialog-ref';
import { DIALOG_DATA } from '../../../core/services/dialog.tokens';
import { EntitySelectComponent } from '../../../shared/components/entity-select/entity-select.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { MovementFormComponent } from '../../movements/movement-form/movement-form.component';
import { formatCents } from '../../../shared/utils';

export type CompoundFormData = { compound: CompoundMovementT };

type OwnerOption = { key: string; label: string };
const NO_OWNER = 'null';

/**
 * Create/edit a compound. Dialog-aware: opened via `<app-modal>` on the compounds page (emits
 * `saved`/`cancelled`) or via `DialogService` from the movements list (closes itself). Loads the
 * pool of movements itself so it works in both contexts.
 */
@Component({
  selector: 'app-compound-form',
  imports: [FormsModule, EntitySelectComponent, FormFieldComponent],
  templateUrl: './compound-form.component.html',
  styleUrl: './compound-form.component.scss',
})
export class CompoundFormComponent implements OnInit, OnDestroy {
  @Input() editing: CompoundMovementT | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private refresh = inject(DataRefreshService);
  private dialog = inject(DialogService);
  private destroyRef = inject(DestroyRef);
  protected dialogRef = inject(DialogRef<void>, { optional: true });
  private data = inject<CompoundFormData | null>(DIALOG_DATA, { optional: true });

  protected editingCompound: CompoundMovementT | null = null;
  protected movements: MovementT[] = [];
  private originalMemberIds: number[] = [];

  protected name = '';
  protected isCancelable = false;
  protected isAnomalous = false;
  protected notes = '';
  protected ownerKey = NO_OWNER;
  protected selectedMemberIds: number[] = [];
  protected saving = false;
  /** Set once a create/save succeeds — gates the on-destroy rollback of provisional movements. */
  private savedSuccessfully = false;
  /** Movements persisted via "+ New movement" this session; rolled back if the form is abandoned. */
  private createdOnTheSpotIds: number[] = [];

  ngOnInit(): void {
    this.editingCompound = this.data?.compound ?? this.editing;
    const compound = this.editingCompound;

    forkJoin({
      movements: this.electron.getAllMovements(),
      children: compound
        ? this.electron.getCompoundMovementChildren(compound.id)
        : of<MovementT[]>([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ movements, children }) => {
          this.movements = movements;
          if (compound) {
            this.name = compound.name;
            this.isCancelable = compound.isCancelable;
            this.isAnomalous = compound.isAnomalous;
            this.notes = compound.notes ?? '';
            this.selectedMemberIds = children.map((m) => m.id);
            this.originalMemberIds = [...this.selectedMemberIds];
            this.ownerKey =
              compound.ownerYear != null && compound.ownerMonth != null
                ? `${compound.ownerYear}-${compound.ownerMonth}`
                : NO_OWNER;
          } else {
            this.ownerKey = this.defaultOwnerKey();
          }
        },
        error: (e) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  // ── member picker ───────────────────────────────────────────────────────────

  /** Candidate movements for the popover: plain, unattached, single-envelope, same account (and, for a
   *  cancelable compound, the same envelope as the current members). Already-selected ones are chips. */
  protected eligibilityFilter = (m: MovementT): boolean => {
    if (m.parentId != null || m.envelopeIdMap.size !== 1 || m.templateId != null || m.isTentative) {
      return false;
    }
    const account = this.selectedAccountId();
    if (account != null && m.accountId !== account) return false;
    if (this.isCancelable) {
      const env = this.selectedEnvelopeId();
      if (env != null && this.onlyEnvelope(m) !== env) return false;
    }
    return true;
  };

  protected memberLabel = (m: MovementT): string => {
    const sign = m.isPositive ? '+' : '-';
    return `${m.name} — ${this.formatDate(m.date)} (${sign}${formatCents(m.quantityCents)} €)`;
  };

  protected onMembersChange(ids: number[]): void {
    this.selectedMemberIds = ids;
    // The owner month must stay one of the members' months (or "Yearly").
    if (this.ownerKey !== NO_OWNER && !this.ownerOptions.some((o) => o.key === this.ownerKey)) {
      this.ownerKey = this.defaultOwnerKey();
    }
  }

  /**
   * Creates a movement "on the spot" by reusing the full MovementForm in a dialog, then auto-selects
   * whatever new, eligible movement appeared (diffing the pool — the form closes with no result).
   */
  protected addNewMovement(): void {
    const before = new Set(this.movements.map((m) => m.id));
    this.dialog
      .open<MovementFormComponent, undefined, void>(MovementFormComponent)
      .afterClosed()
      .pipe(
        take(1),
        switchMap(() => this.electron.getAllMovements()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((movements) => {
        this.movements = movements;
        const created = movements.filter((m) => !before.has(m.id));
        this.createdOnTheSpotIds.push(...created.map((m) => m.id));
        const eligible = created.filter((m) => this.eligibilityFilter(m));
        if (eligible.length > 0) {
          this.onMembersChange([...this.selectedMemberIds, ...eligible.map((m) => m.id)]);
        }
      });
  }

  /** Roll back provisional "+ New movement" creations unless the compound was actually created/saved. */
  ngOnDestroy(): void {
    if (this.savedSuccessfully || this.createdOnTheSpotIds.length === 0) return;
    // Fire-and-forget (the component is being torn down); notify once the deletions land so the
    // reloaded lists no longer show the abandoned movements.
    forkJoin(this.createdOnTheSpotIds.map((id) => this.electron.deleteMovement(id))).subscribe({
      next: () => this.refresh.notifyMovementsChanged(),
      error: () => this.refresh.notifyMovementsChanged(),
    });
  }

  protected get ownerOptions(): OwnerOption[] {
    const seen = new Map<string, OwnerOption>();
    for (const m of this.selectedMembers()) {
      const d = this.asDate(m.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        });
      }
    }
    return [...seen.values()].sort((a, b) => this.keyTime(a.key) - this.keyTime(b.key));
  }

  protected readonly NO_OWNER = NO_OWNER;

  // ── save / cancel ────────────────────────────────────────────────────────────

  protected get canSave(): boolean {
    return this.name.trim().length > 0 && this.selectedMemberIds.length >= 2 && !this.saving;
  }

  protected save(): void {
    if (!this.canSave) return;
    this.saving = true;
    const { ownerYear, ownerMonth } = this.parseOwner();
    const fields: NewCompoundFields = {
      name: this.name.trim(),
      isCancelable: this.isCancelable,
      isAnomalous: this.isAnomalous,
      notes: this.notes.trim() || null,
      ownerYear,
      ownerMonth,
    };

    const op$: Observable<unknown> = this.editingCompound
      ? this.saveEdit(this.editingCompound, fields)
      : this.electron.createCompoundMovement(fields, this.selectedMemberIds, []);

    op$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving = false;
        this.savedSuccessfully = true;
        this.notify.success(this.editingCompound ? 'Compound updated.' : 'Compound created.');
        this.refresh.notifyMovementsChanged();
        this.finish();
      },
      error: (e) => {
        this.saving = false;
        this.notify.error(this.errorText.resolve(e.message));
      },
    });
  }

  /** Persist attribute edits, then apply the membership diff (adds before removes so a transient dip
   *  below two members never dissolves the compound mid-update). */
  private saveEdit(compound: CompoundMovementT, fields: NewCompoundFields) {
    const added = this.selectedMemberIds.filter((id) => !this.originalMemberIds.includes(id));
    const removed = this.originalMemberIds.filter((id) => !this.selectedMemberIds.includes(id));
    const ops = [
      this.electron.updateCompoundMovement({ ...compound, ...fields }),
      ...added.map((id) => this.electron.addMemberToCompound(compound.id, id)),
      ...removed.map((id) => this.electron.removeMemberFromCompound(compound.id, id)),
    ];
    return concat(...ops).pipe(toArray());
  }

  protected cancel(): void {
    this.finish(true);
  }

  private finish(cancelled = false): void {
    if (this.dialogRef) this.dialogRef.close();
    else if (cancelled) this.cancelled.emit();
    else this.saved.emit();
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private selectedMembers(): MovementT[] {
    return this.selectedMemberIds
      .map((id) => this.movements.find((m) => m.id === id))
      .filter((m): m is MovementT => m != null);
  }

  private selectedAccountId(): number | null {
    return this.selectedMembers()[0]?.accountId ?? null;
  }

  private selectedEnvelopeId(): number | null {
    const first = this.selectedMembers()[0];
    return first ? this.onlyEnvelope(first) : null;
  }

  private onlyEnvelope(m: MovementT): number {
    return [...m.envelopeIdMap.keys()][0];
  }

  private defaultOwnerKey(): string {
    return this.ownerOptions[0]?.key ?? NO_OWNER;
  }

  private parseOwner(): { ownerYear: number | null; ownerMonth: number | null } {
    if (this.ownerKey === NO_OWNER) return { ownerYear: null, ownerMonth: null };
    const [year, month] = this.ownerKey.split('-').map(Number);
    return { ownerYear: year, ownerMonth: month };
  }

  private keyTime(key: string): number {
    const [year, month] = key.split('-').map(Number);
    return year * 12 + month;
  }

  private asDate(date: unknown): Date {
    return date instanceof Date ? date : new Date(String(date));
  }

  private formatDate(date: unknown): string {
    const d = this.asDate(date);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mo}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
