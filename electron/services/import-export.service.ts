import Papa from 'papaparse';
import {
  ImportIssueT,
  ImportIssueCode,
  ImportResultT,
  MovementDraftT,
  MovementFilter,
  TagT,
} from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';
import { parseSignedMoney, formatSignedMoney } from '@shared/money';
import { dateToISO, isoToDate } from '../repository/date-utils';
import { DatabaseService } from '../repository/database.service';
import { movementRepository } from '../repository/movement-repository.service';
import { categoryRepository } from '../repository/category-repository.service';
import { envelopeRepository } from '../repository/envelope-repository.service';
import { accountRepository } from '../repository/account-repository.service';
import { tagRepository } from '../repository/tag-repository.service';
import { periodicMovementRepository } from '../repository/periodic-movement-repository.service';
import { compoundMovementRepository } from '../repository/compound-movement-repository.service';
import { movementService } from './movement.service';
import { periodSummaryService } from './period-summary.service';

/** The light-CSV columns, in canonical order (used for export headers). */
const COLUMNS = [
  'name',
  'concept',
  'quantity',
  'date',
  'account',
  'category',
  'envelope',
  'tags',
  'notes',
  'anomalous',
  'template',
  'group',
] as const;

/** Columns an imported CSV must provide; everything else is optional (extra columns are ignored). */
const REQUIRED_COLUMNS = ['concept', 'quantity', 'date'];

const LIST_DELIM = '|'; // between envelope-split pairs and between tags
const ENV_AMOUNT_DELIM = ':'; // envelope name ↔ amount
const TAG_TYPE_DELIM = '/'; // tag type ↔ name
const DEFAULT_TAG_COLOR = '#94a3b8';
const DEFAULT_TAG_TYPE = 'imported'; // when a tag cell omits the `type/` prefix

/**
 * CSV import/export of movements (the light, flat format). This service is Electron-free: file
 * selection and disk I/O live in the IPC handler; here we only transform strings ↔ data and read/write
 * the database. See `docs`/the plan for the format and the locked design decisions.
 */
export class ImportExportService {
  // ---------------------------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------------------------

  /**
   * Parses CSV text into committable movement drafts plus a list of issues. **Persists nothing** — it
   * is a pure preview utility; call `commitImport` to actually create the movements. References are
   * resolved to ids here (unmatched category/envelope fall back to the default buckets, recorded as
   * issues); unknown tags are flagged `id: null` and created later at commit time.
   */
  previewImport(csvContent: string, targetAccountId: number): ImportResultT {
    this.assertNoPendingTentatives(targetAccountId);
    const parsed = Papa.parse<Record<string, string>>(stripBom(csvContent), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const headers = parsed.meta.fields ?? [];
    for (const col of REQUIRED_COLUMNS) {
      if (!headers.includes(col)) throw new AppError(AppErrorCode.IMPORT_MISSING_COLUMNS);
    }

    // Resolution maps, built once. Names are matched case-insensitively (friendlier for hand-authored
    // files); category/envelope/account names are unique, tags are unique by (type, name).
    const catByName = lowerMap(categoryRepository.getAllCategories(), (c) => c.name, (c) => c.id);
    const envByName = lowerMap(envelopeRepository.getAllEnvelopes(), (e) => e.name, (e) => e.id);
    const tagByKey = new Map(
      tagRepository.getAllTags().map((t) => [tagKey(t.type, t.name), t] as const),
    );
    const templateNames = new Set(
      periodicMovementRepository.getAll().map((t) => t.name.toLowerCase()),
    );
    const groupNames = new Set(compoundMovementRepository.getAll().map((g) => g.name.toLowerCase()));

    const defaultCatId = categoryRepository.getDefault();
    const defaultEnvId = envelopeRepository.getDefaultForAccount(targetAccountId);

    const drafts: MovementDraftT[] = [];
    const issues: ImportIssueT[] = [];
    const add = (row: number, code: ImportIssueCode, detail?: string) =>
      issues.push({ row, code, detail });

    parsed.data.forEach((raw, row) => {
      const cell = (key: string) => (raw[key] ?? '').trim();

      // Identity: name falls back to concept; both blank is unusable.
      const concept = cell('concept') || null;
      const name = cell('name') || concept || '';
      if (!name) return add(row, 'NAME_MISSING');

      // Amount (signed decimal) → cents + sign.
      let quantityCents: number;
      let isPositive: boolean;
      try {
        ({ quantityCents, isPositive } = parseSignedMoney(cell('quantity')));
      } catch {
        return add(row, 'AMOUNT_INVALID', cell('quantity'));
      }
      if (!Number.isInteger(quantityCents) || quantityCents <= 0) {
        return add(row, 'AMOUNT_INVALID', cell('quantity'));
      }

      // Date: YYYY-MM-DD or YYYY-MM (month-only → day 01).
      const date = parseImportDate(cell('date'));
      if (!date) return add(row, 'DATE_INVALID', cell('date'));

      // Category by unique name; unmatched → default bucket (+issue when a name was actually given).
      const catRaw = cell('category');
      let categoryId = catRaw ? catByName.get(catRaw.toLowerCase()) : undefined;
      if (categoryId == null) {
        if (defaultCatId == null) return add(row, 'CATEGORY_NOT_FOUND', catRaw);
        categoryId = defaultCatId;
        if (catRaw) add(row, 'CATEGORY_NOT_FOUND', catRaw);
      }

      // Envelope(s): single name (full amount) or `Name:amount|Name:amount` split.
      const envResult = this.parseEnvelopes(cell('envelope'), quantityCents, envByName, defaultEnvId);
      if (envResult.error) {
        return add(row, envResult.error, envResult.detail);
      }
      if (envResult.fallback) add(row, 'ENVELOPE_NOT_FOUND', envResult.fallback);

      // Tags: `type/name` items; unknown ones are flagged to be created at commit.
      const tags: MovementDraftT['tags'] = [];
      for (const item of splitUnescaped(cell('tags'), LIST_DELIM)) {
        const parsed = this.parseTag(item);
        if (!parsed) continue;
        const existing = tagByKey.get(tagKey(parsed.type, parsed.name));
        if (existing) {
          tags.push({ type: existing.type, name: existing.name, id: existing.id });
        } else {
          tags.push({ ...parsed, id: null });
          add(row, 'TAG_WILL_CREATE', `${parsed.type}${TAG_TYPE_DELIM}${parsed.name}`);
        }
      }

      // Template / group: informational labels; note when they cannot be resolved.
      const templateName = cell('template') || null;
      if (templateName && !templateNames.has(templateName.toLowerCase())) {
        add(row, 'TEMPLATE_NOT_FOUND', templateName);
      }
      const groupName = cell('group') || null;
      if (groupName && !groupNames.has(groupName.toLowerCase())) {
        add(row, 'GROUP_NOT_FOUND', groupName);
      }

      drafts.push({
        name,
        concept,
        quantityCents,
        isPositive,
        date,
        categoryName: catRaw,
        categoryId,
        envelopes: envResult.envelopes,
        tags,
        additionalNotes: cell('notes') || null,
        isAnomalous: parseBool(cell('anomalous')),
        templateName,
        groupName,
      });
    });

    return { drafts, issues };
  }

  /**
   * Persists preview drafts as real movements in a single transaction (all-or-nothing). Reuses
   * `movementService.create` (validation + period-summary hooks + overflow redirect), auto-creates any
   * `id: null` tags, and re-attaches template/group associations by name when they still exist. Drafts
   * are inserted oldest-first to keep the tentative-guard chain sane. Returns the number created.
   */
  commitImport(drafts: MovementDraftT[], targetAccountId: number): number {
    this.assertNoPendingTentatives(targetAccountId);
    const db = DatabaseService.getInstance().db;

    const tagIdByKey = new Map(
      tagRepository.getAllTags().map((t) => [tagKey(t.type, t.name), t.id] as const),
    );
    const templateIdByName = lowerMap(
      periodicMovementRepository.getAll(),
      (t) => t.name,
      (t) => t.id,
    );
    const groupIdByName = lowerMap(compoundMovementRepository.getAll(), (g) => g.name, (g) => g.id);

    const ordered = [...drafts].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());

    return db.transaction(() => {
      const touchedCompounds = new Set<number>();
      let count = 0;

      for (const d of ordered) {
        // Resolve/create tags.
        const tagIds: number[] = [];
        for (const t of d.tags) {
          let id = t.id ?? tagIdByKey.get(tagKey(t.type, t.name));
          if (id == null) {
            id = Number(
              tagRepository.insertTag({ type: t.type, name: t.name, color: DEFAULT_TAG_COLOR }),
            );
            tagIdByKey.set(tagKey(t.type, t.name), id);
          }
          tagIds.push(id);
        }

        // Envelope allocation (merge duplicate ids, e.g. two unmatched names sharing the default).
        const envelopeIdMap = new Map<number, number>();
        for (const e of d.envelopes) {
          envelopeIdMap.set(e.id, (envelopeIdMap.get(e.id) ?? 0) + e.amountCents);
        }

        const templateId = d.templateName
          ? templateIdByName.get(d.templateName.toLowerCase()) ?? null
          : null;

        const newId = Number(
          movementService.create(
            d.name,
            d.concept,
            d.quantityCents,
            d.isPositive,
            toDate(d.date),
            d.categoryId,
            envelopeIdMap,
            d.additionalNotes,
            d.isAnomalous,
            templateId,
            false,
            targetAccountId,
          ),
        );

        for (const tagId of tagIds) tagRepository.addTagToMovement(tagId, newId);

        // Best-effort compound re-attachment by name. Membership invariants (D2/D6/D12) are NOT
        // re-validated here — import assumes previously-valid data; the owner-month stats are refreshed
        // below so the compound-adjusted summary stays correct.
        if (d.groupName) {
          const groupId = groupIdByName.get(d.groupName.toLowerCase());
          if (groupId != null) {
            movementRepository.setParent(newId, groupId);
            touchedCompounds.add(groupId);
          }
        }

        count++;
      }

      for (const groupId of touchedCompounds) {
        const compound = compoundMovementRepository.getById(groupId);
        if (compound != undefined) periodSummaryService.touchCompoundOwnerPeriods(compound);
      }

      return count;
    })();
  }

  /** Symmetric to the export guard: refuse to import into an account that still holds unreviewed
   *  (tentative) movements — the user must confirm or cancel those first. */
  private assertNoPendingTentatives(accountId: number): void {
    if (movementRepository.hasAnyTentativeInAccount(accountId)) {
      throw new AppError(AppErrorCode.IMPORT_ACCOUNT_HAS_TENTATIVE);
    }
  }

  /** Parses one envelope cell into resolved allocations. Returns a blocking `error` code, or the
   *  allocations plus the (first) unmatched name that fell back to the default envelope. */
  private parseEnvelopes(
    cell: string,
    quantityCents: number,
    envByName: Map<string, number>,
    defaultEnvId: number | undefined,
  ): {
    envelopes: MovementDraftT['envelopes'];
    error?: ImportIssueCode;
    detail?: string;
    fallback?: string;
  } {
    // Empty → whole amount to the account's default envelope.
    if (!cell) {
      if (defaultEnvId == null) return { envelopes: [], error: 'ENVELOPE_NOT_FOUND' };
      return { envelopes: [{ name: '', id: defaultEnvId, amountCents: quantityCents }] };
    }

    const parts = splitUnescaped(cell, LIST_DELIM)
      .map((p) => p.trim())
      .filter(Boolean);
    const envelopes: MovementDraftT['envelopes'] = [];
    let fallback: string | undefined;

    for (const part of parts) {
      const [namePart, amountPart] = splitOnceUnescaped(part, ENV_AMOUNT_DELIM);
      const name = unescapeAll(namePart).trim();
      let id = envByName.get(name.toLowerCase());
      if (id == null) {
        if (defaultEnvId == null) return { envelopes: [], error: 'ENVELOPE_NOT_FOUND', detail: name };
        id = defaultEnvId;
        fallback ??= name;
      }

      let amountCents: number;
      if (amountPart != null && amountPart.trim() !== '') {
        try {
          amountCents = parseSignedMoney(amountPart).quantityCents;
        } catch {
          return { envelopes: [], error: 'SPLIT_SUM_MISMATCH', detail: part };
        }
      } else if (parts.length === 1) {
        amountCents = quantityCents; // single envelope, no explicit amount → full quantity
      } else {
        return { envelopes: [], error: 'SPLIT_SUM_MISMATCH', detail: `missing amount for "${name}"` };
      }
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return { envelopes: [], error: 'SPLIT_SUM_MISMATCH', detail: part };
      }
      envelopes.push({ name, id, amountCents });
    }

    const sum = envelopes.reduce((acc, e) => acc + e.amountCents, 0);
    if (sum !== quantityCents) {
      return { envelopes: [], error: 'SPLIT_SUM_MISMATCH', detail: `${sum} != ${quantityCents}` };
    }
    return { envelopes, fallback };
  }

  /** Parses a `type/name` tag item; falls back to a default type when no `/` is present. */
  private parseTag(item: string): { type: string; name: string } | null {
    const trimmed = item.trim();
    if (!trimmed) return null;
    const [typePart, namePart] = splitOnceUnescaped(trimmed, TAG_TYPE_DELIM);
    if (namePart == null) {
      const name = unescapeAll(typePart).trim();
      return name ? { type: DEFAULT_TAG_TYPE, name } : null;
    }
    const type = unescapeAll(typePart).trim() || DEFAULT_TAG_TYPE;
    const name = unescapeAll(namePart).trim();
    return name ? { type, name } : null;
  }

  // ---------------------------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------------------------

  /**
   * Serializes the movements matching `filter` (undefined = all) as light CSV. Rejects the export if
   * any selected movement is tentative — the user must confirm those first. Ids are resolved to names
   * (splits rendered as the `Name:amount|…` mini-syntax; tags as `type/name`).
   */
  exportMovements(filter?: MovementFilter): string {
    const movements = movementRepository.getAllMovements(filter);
    if (movements.some((m) => m.isTentative)) {
      throw new AppError(AppErrorCode.EXPORT_CONTAINS_TENTATIVE);
    }

    const catById = idMap(categoryRepository.getAllCategories(), (c) => c.id, (c) => c.name);
    const envById = idMap(envelopeRepository.getAllEnvelopes(), (e) => e.id, (e) => e.name);
    const accById = idMap(accountRepository.getAllAccounts(), (a) => a.id, (a) => a.name);
    const tplById = idMap(periodicMovementRepository.getAll(), (t) => t.id, (t) => t.name);
    const grpById = idMap(compoundMovementRepository.getAll(), (g) => g.id, (g) => g.name);
    const tagsByMovement = tagRepository.getTagsForMovements(movements.map((m) => m.id));

    const rows = movements.map((m) => ({
      name: m.name,
      concept: m.concept ?? '',
      quantity: formatSignedMoney(m.quantityCents, m.isPositive),
      date: dateToISO(m.date),
      account: accById.get(m.accountId) ?? '',
      category: catById.get(m.categoryId) ?? '',
      envelope: formatEnvelopes(m.envelopeIdMap, envById),
      tags: formatTags(tagsByMovement[m.id] ?? []),
      notes: m.additionalNotes ?? '',
      anomalous: m.isAnomalous ? 'true' : 'false',
      template: m.templateId != null ? tplById.get(m.templateId) ?? '' : '',
      group: m.parentId != null ? grpById.get(m.parentId) ?? '' : '',
    }));

    return Papa.unparse(rows, { columns: [...COLUMNS] });
  }
}

// -----------------------------------------------------------------------------------------------
// Helpers (module-private)
// -----------------------------------------------------------------------------------------------

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function parseBool(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'x';
}

/** Accepts `YYYY-MM-DD` and `YYYY-MM` (day defaults to 01); returns a TZ-stable Date or null. */
function parseImportDate(s: string): Date | null {
  const t = s.trim();
  let iso: string | undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) iso = t;
  else if (/^\d{4}-\d{2}$/.test(t)) iso = `${t}-01`;
  if (!iso) return null;
  const d = isoToDate(iso);
  return isNaN(d.getTime()) ? null : d;
}

function tagKey(type: string, name: string): string {
  return `${type.toLowerCase()} ${name.toLowerCase()}`;
}

/** Builds a lowercased-name → value map from a list (last write wins on collision). */
function lowerMap<T, V>(items: T[], name: (t: T) => string, value: (t: T) => V): Map<string, V> {
  return new Map(items.map((t) => [name(t).toLowerCase(), value(t)] as const));
}

function idMap<T, V>(items: T[], id: (t: T) => number, value: (t: T) => V): Map<number, V> {
  return new Map(items.map((t) => [id(t), value(t)] as const));
}

function formatEnvelopes(map: Map<number, number>, envById: Map<number, string>): string {
  const entries = [...map.entries()];
  if (entries.length === 1) {
    return escapeSpecials(envById.get(entries[0][0]) ?? '', LIST_DELIM + ENV_AMOUNT_DELIM);
  }
  return entries
    .map(
      ([id, amount]) =>
        `${escapeSpecials(envById.get(id) ?? '', LIST_DELIM + ENV_AMOUNT_DELIM)}${ENV_AMOUNT_DELIM}${formatSignedMoney(amount, true)}`,
    )
    .join(LIST_DELIM);
}

function formatTags(tags: TagT[]): string {
  return tags
    .map(
      (t) =>
        `${escapeSpecials(t.type, LIST_DELIM + TAG_TYPE_DELIM)}${TAG_TYPE_DELIM}${escapeSpecials(t.name, LIST_DELIM + TAG_TYPE_DELIM)}`,
    )
    .join(LIST_DELIM);
}

/** Backslash-escapes `\` and any character in `specials`. */
function escapeSpecials(input: string, specials: string): string {
  let out = '';
  for (const ch of input) {
    if (ch === '\\' || specials.includes(ch)) out += '\\';
    out += ch;
  }
  return out;
}

/** Splits on unescaped `delim`, preserving backslash escapes inside each segment. */
function splitUnescaped(input: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\\' && i + 1 < input.length) {
      cur += ch + input[i + 1];
      i++;
      continue;
    }
    if (ch === delim) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Splits at the first unescaped `delim`; both sides keep their escapes (caller unescapes). */
function splitOnceUnescaped(input: string, delim: string): [string, string | null] {
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\\') {
      i++;
      continue;
    }
    if (input[i] === delim) return [input.slice(0, i), input.slice(i + 1)];
  }
  return [input, null];
}

function unescapeAll(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\\' && i + 1 < input.length) {
      out += input[i + 1];
      i++;
    } else {
      out += input[i];
    }
  }
  return out;
}

export const importExportService = new ImportExportService();
