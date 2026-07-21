// ============================================================================
// finance-lib.js — shared data layer + formatters for the Financely component
// library. Imported by the DC logic classes via `await import('./finance-lib.js')`.
//
// EVERY component pulls its data from the MOCK objects below. Each mock getter is
// annotated with the exact `window.*` IPC method it stands in for, so swapping to
// the real backend later is a one-line change. See docs/API_CONTRACT.md.
// Money is always integer cents. `month` is 0-indexed (Date.getMonth() convention).
// ============================================================================

/* ---- Theme tokens (kept in JS only for computed values; components inline these
   literals directly in their markup, per the design-component styling rules) ---- */
export const T = {
  ink: '#1b2430', inkSoft: '#5b6472', muted: '#98a1b0', faint: '#c3cad4',
  line: '#eceef2', lineSoft: '#f2f4f7', card: '#ffffff', canvas: '#f5f6f8',
  pos: '#1c8a4d', neg: '#d23b2b', blue: '#2f6bf6', indigo: '#6b5cf5',
  amber: '#e8a33d', tintBlue: '#eef3fe', tintGreen: '#eef7f1', tintIndigo: '#f3f1fe',
  tintAmber: '#fbf4e7', tintRed: '#fcefed',
};

/* Entity color palette (envelopes / categories / tags). Mirrors the spirit of
   shared/defaults.ts DEFAULT_COLOR_ORDER. */
export const PALETTE = [
  '#2f6bf6', '#1c8a4d', '#d23b2b', '#6b5cf5', '#e8a33d',
  '#0f9aa8', '#d1478c', '#7a8b3a', '#b4632a', '#3b5b8c',
];

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ---- Money -----------------------------------------------------------------
// European format: comma decimal, thin space grouping, trailing " €".
function groupInt(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}
export function fmtMoney(cents, { sign = false, plusForZero = false } = {}) {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  let out = `${groupInt(String(whole))},${frac}\u00a0€`;
  if (sign) out = (neg ? '\u2212' : (cents > 0 || plusForZero ? '+' : '')) + out;
  else if (neg) out = '\u2212' + out;
  return out;
}
// color for a signed amount
export function moneyColor(cents) { return cents > 0 ? T.pos : cents < 0 ? T.neg : T.ink; }

// ---- Dates -----------------------------------------------------------------
const NOW = new Date(2026, 0, 20); // pinned "today" for stable mock output (20 Jan 2026)
export function today() { return new Date(NOW); }
export function fmtRelDate(d) {
  const date = (d instanceof Date) ? d : new Date(d);
  const day0 = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  const dd = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((day0 - dd) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}
export function fmtDate(d) {
  const date = (d instanceof Date) ? d : new Date(d);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
export function fmtMonthYear(month, year, full = false) {
  return `${(full ? MONTHS : MONTHS_SHORT)[month]} ${full ? year : `'${String(year).slice(2)}`}`;
}

// ============================================================================
// MOCK DATA  — a small, coherent dataset (Jan 2026, "Main" account)
// ============================================================================
export const ACCOUNTS = [
  // window.accounts.getAll() -> AccountT[]
  { id: 1, name: 'Main', description: 'Everyday account', isDefault: true, startingBalance: 183700 },
  { id: 2, name: 'Savings', description: 'Rainy day', isDefault: false, startingBalance: 900000 },
];

export const ENVELOPES = [
  // window.envelopes.getAll() -> EnvelopeT[]
  { id: 1, name: 'Groceries', accountId: 1, isDefault: false, startingBalance: 20000, budgetCents: 40000, maxSavingsCents: null, overflowsTo: null, color: PALETTE[2] },
  { id: 2, name: 'Rent', accountId: 1, isDefault: false, startingBalance: 0, budgetCents: 90000, maxSavingsCents: null, overflowsTo: null, color: PALETTE[3] },
  { id: 3, name: 'Transport', accountId: 1, isDefault: false, startingBalance: 5000, budgetCents: 12000, maxSavingsCents: null, overflowsTo: null, color: PALETTE[0] },
  { id: 4, name: 'Savings pot', accountId: 1, isDefault: false, startingBalance: 120000, budgetCents: null, maxSavingsCents: 300000, overflowsTo: 5, color: PALETTE[1] },
  { id: 5, name: 'Main', accountId: 1, isDefault: true, startingBalance: 38700, budgetCents: null, maxSavingsCents: null, overflowsTo: null, color: PALETTE[9] },
  { id: 6, name: 'Fun', accountId: 1, isDefault: false, startingBalance: 8000, budgetCents: 15000, maxSavingsCents: null, overflowsTo: null, color: PALETTE[4] },
];

export const CATEGORIES = [
  // window.categories.getAll() -> CategoryT[]  (includes movementCount)
  { id: 1, name: 'Groceries', color: PALETTE[2], emoji: '🛒', envelopeId: 1, isDefault: false, movementCount: 24 },
  { id: 2, name: 'Salary', color: PALETTE[1], emoji: '💼', envelopeId: 5, isDefault: false, movementCount: 12 },
  { id: 3, name: 'Rent', color: PALETTE[3], emoji: '🏠', envelopeId: 2, isDefault: false, movementCount: 12 },
  { id: 4, name: 'Transport', color: PALETTE[0], emoji: '⛽', envelopeId: 3, isDefault: false, movementCount: 18 },
  { id: 5, name: 'Dining', color: PALETTE[8], emoji: '🍽️', envelopeId: 6, isDefault: false, movementCount: 9 },
  { id: 6, name: 'Subscriptions', color: PALETTE[5], emoji: '🎬', envelopeId: 6, isDefault: false, movementCount: 6 },
  { id: 7, name: 'Uncategorized', color: PALETTE[9], emoji: '❓', envelopeId: null, isDefault: true, movementCount: 3 },
];

export const TAGS = [
  // window.tags.getAll() -> TagT[]   type is a free grouping label
  { id: 1, type: 'context', name: 'Japan trip', color: PALETTE[0] },
  { id: 2, type: 'context', name: 'Work', color: PALETTE[3] },
  { id: 3, type: 'context', name: 'Reimbursable', color: PALETTE[1] },
  { id: 4, type: 'context', name: 'Gift', color: PALETTE[6] },
  { id: 5, type: 'context', name: 'Essential', color: PALETTE[4] },
];

const D = (y, m, d) => new Date(y, m, d);
export const MOVEMENTS = [
  // window.movements.getAll(filter?) -> MovementT[]
  // envelopeIdMap is a Map<envelopeId, amountCents>; a non-split has one entry.
  { id: 101, accountId: 1, name: 'Mercadona', concept: 'Weekly shop', quantityCents: 4780, isPositive: false, date: D(2026,0,20), categoryId: 1, additionalNotes: '', templateId: null, isTentative: false, isAnomalous: false, parentId: null, envelopeIdMap: [[1,4780]], tagIds: [5] },
  { id: 102, accountId: 1, name: 'Payroll — Vela Studio', concept: 'Monthly salary', quantityCents: 220000, isPositive: true, date: D(2026,0,20), categoryId: 2, additionalNotes: '', templateId: 9, isTentative: false, isAnomalous: false, parentId: null, envelopeIdMap: [[5,200000],[1,20000]], tagIds: [2] },
  { id: 103, accountId: 1, name: 'Spotify', concept: 'Subscription', quantityCents: 1099, isPositive: false, date: D(2026,0,19), categoryId: 6, additionalNotes: '', templateId: 10, isTentative: false, isAnomalous: false, parentId: null, envelopeIdMap: [[6,1099]], tagIds: [] },
  { id: 104, accountId: 1, name: 'Café Central', concept: 'Coffee with Ana', quantityCents: 720, isPositive: false, date: D(2026,0,19), categoryId: 5, additionalNotes: '', templateId: null, isTentative: false, isAnomalous: false, parentId: null, envelopeIdMap: [[6,720]], tagIds: [] },
  { id: 105, accountId: 1, name: 'Repsol — Gasolina', concept: 'Full tank', quantityCents: 6182, isPositive: false, date: D(2026,0,16), categoryId: 4, additionalNotes: 'Highway trip', templateId: null, isTentative: false, isAnomalous: false, parentId: null, envelopeIdMap: [[3,6182]], tagIds: [1] },
  { id: 106, accountId: 1, name: 'Rent — January', concept: 'Monthly rent', quantityCents: 90000, isPositive: false, date: D(2026,0,3), categoryId: 3, additionalNotes: '', templateId: 8, isTentative: false, isAnomalous: false, parentId: null, envelopeIdMap: [[2,90000]], tagIds: [5] },
  { id: 107, accountId: 1, name: 'Sofa — El Corte', concept: 'New living-room sofa', quantityCents: 129900, isPositive: false, date: D(2026,0,8), categoryId: 7, additionalNotes: 'One-off, unusually large', templateId: null, isTentative: false, isAnomalous: true, parentId: null, envelopeIdMap: [[5,129900]], tagIds: [] },
  // Compound children (Japan trip group #501)
  { id: 108, accountId: 1, name: 'Hotel — Kyoto', concept: '3 nights', quantityCents: 42000, isPositive: false, date: D(2026,0,11), categoryId: 5, additionalNotes: '', templateId: null, isTentative: false, isAnomalous: false, parentId: 501, envelopeIdMap: [[6,42000]], tagIds: [1] },
  { id: 109, accountId: 1, name: 'Flights — Osaka', concept: 'Return tickets', quantityCents: 61000, isPositive: false, date: D(2026,0,11), categoryId: 4, additionalNotes: '', templateId: null, isTentative: false, isAnomalous: false, parentId: 501, envelopeIdMap: [[6,61000]], tagIds: [1] },
  { id: 110, accountId: 1, name: 'JR Pass', concept: '7-day rail', quantityCents: 24000, isPositive: false, date: D(2026,0,12), categoryId: 4, additionalNotes: '', templateId: null, isTentative: false, isAnomalous: false, parentId: 501, envelopeIdMap: [[6,24000]], tagIds: [1] },
  // Tentative (generated, awaiting review)
  { id: 111, accountId: 1, name: 'Gym', concept: 'Membership', quantityCents: 3500, isPositive: false, date: D(2026,0,17), categoryId: 6, additionalNotes: '', templateId: 11, isTentative: true, isAnomalous: false, parentId: null, envelopeIdMap: [[6,3500]], tagIds: [] },
];

export const PERIODIC = [
  // window.periodicMovements.getAll() -> PeriodicMovementT[]
  { id: 8, accountId: 1, name: 'Rent', concept: 'Monthly rent', quantityCents: 90000, isPositive: false, dayOfMonth: 3, categoryId: 3, additionalNotes: '', active: true, startYear: 2024, startMonth: 0, lastCreatedYear: 2026, lastCreatedMonth: 0, envelopeIdMap: [[2,90000]], tagIds: [5] },
  { id: 9, accountId: 1, name: 'Payroll — Vela Studio', concept: 'Monthly salary', quantityCents: 220000, isPositive: true, dayOfMonth: 20, categoryId: 2, additionalNotes: '', active: true, startYear: 2023, startMonth: 5, lastCreatedYear: 2026, lastCreatedMonth: 0, envelopeIdMap: [[5,200000],[1,20000]], tagIds: [2] },
  { id: 10, accountId: 1, name: 'Spotify', concept: 'Subscription', quantityCents: 1099, isPositive: false, dayOfMonth: 19, categoryId: 6, additionalNotes: '', active: true, startYear: 2022, startMonth: 2, lastCreatedYear: 2026, lastCreatedMonth: 0, envelopeIdMap: [[6,1099]], tagIds: [] },
  { id: 11, accountId: 1, name: 'Gym', concept: 'Membership', quantityCents: 3500, isPositive: false, dayOfMonth: 17, categoryId: 6, additionalNotes: '', active: true, startYear: 2025, startMonth: 8, lastCreatedYear: 2026, lastCreatedMonth: 0, envelopeIdMap: [[6,3500]], tagIds: [] },
];

// Per-month instance status for a periodic movement's calendar grid (Detail view).
// status: 'received' | 'tentative' | 'cancelled' | 'pending' | 'early'
export const PERIODIC_YEAR_2026 = {
  9: [ // Payroll — Vela Studio
    'received','tentative','tentative','tentative','tentative','tentative',
    'pending','pending','pending','pending','pending','pending' ],
  8: [ // Rent
    'received','tentative','tentative','tentative','cancelled','tentative',
    'pending','pending','pending','pending','pending','pending' ],
};

export const COMPOUNDS = [
  // window.compoundMovements.getAll() -> CompoundMovementT[]
  { id: 501, accountId: 1, name: 'Japan trip', isCancelable: false, ownerYear: 2026, ownerMonth: 0, isAnomalous: false, notes: 'Two weeks in Japan, split across bookings.', childIds: [108,109,110] },
];

// window.periodSummaries.getByPeriod(accountId, envelopeId|null, year, month) -> PeriodSummaryT
// Account-level rollup for Main, Jan 2026 (envelopeId: null)
export const ACCOUNT_SUMMARY_JAN = {
  accountId: 1, accountName: 'Main', envelopeId: null, envelopeName: null, year: 2026, month: 0,
  cashFlowCents: 88000, totalIncomeCents: 220000, totalExpenseCents: 132000,
  avgExpenseCents: 18857, avgIncomeCents: 220000, avgMovementAmountCents: 25000, movementCount: 8,
  endingBalanceCents: 420000, netTransfersCents: -30000, budgetCents: null, maxSavingsCents: null,
  notes: 'Big one-off sofa purchase this month.', dirtyState: 'CLEAN', tentative: true,
  // stats mirrors
  periodicIncomeCents: 220000, periodicExpenseCents: 93000, irregularCents: -67500,
  entryBalanceCents: 183700,
};

// Single-envelope summary (Groceries, Jan 2026)
export const ENVELOPE_SUMMARY_GROCERIES_JAN = {
  accountId: 1, accountName: 'Main', envelopeId: 1, envelopeName: 'Groceries', year: 2026, month: 0,
  cashFlowCents: -32800, totalIncomeCents: 20000, totalExpenseCents: 52800,
  avgExpenseCents: 8800, avgIncomeCents: 20000, avgMovementAmountCents: 9130, movementCount: 7,
  endingBalanceCents: 12300, netTransfersCents: 5000, budgetCents: 40000, maxSavingsCents: null,
  notes: '', dirtyState: 'CLEAN', tentative: false, entryBalanceCents: 20100,
  transfersInCents: 5000, transfersOutCents: 0,
};

// Multi-envelope table (each envelope's Jan 2026 slice) for the multi PeriodSummary view
export const MULTI_ENVELOPE_JAN = [
  { envelopeId: 1, name: 'Groceries', color: PALETTE[2], cashFlowCents: -32800, budgetCents: 40000, endingBalanceCents: 12300, movementCount: 7 },
  { envelopeId: 2, name: 'Rent', color: PALETTE[3], cashFlowCents: -90000, budgetCents: 90000, endingBalanceCents: 0, movementCount: 1 },
  { envelopeId: 3, name: 'Transport', color: PALETTE[0], cashFlowCents: -6182, budgetCents: 12000, endingBalanceCents: 8818, movementCount: 3 },
  { envelopeId: 6, name: 'Fun', color: PALETTE[4], cashFlowCents: -12819, budgetCents: 15000, endingBalanceCents: 5181, movementCount: 5 },
  { envelopeId: 5, name: 'Main', color: PALETTE[9], cashFlowCents: 70100, budgetCents: null, endingBalanceCents: 393700, movementCount: 4 },
];

// window.movements.getFilterSummary(filter) -> FilterSummaryT { filters, aggregate, children[] }
// aggregate.summary is a BasicSummary — computed on the fly for an arbitrary selection (a tag, a
// category, a text search…). NOT a money pool: no budget, no transfers, no ending balance.
// BasicSummary fields (see electron/services/basic-summary.ts):
//   movementCount, totalIncomeCents, totalExpenseCents, cashFlowCents,
//   avgExpenseCents, avgIncomeCents, avgMovementAmountCents
export const BASIC_SUMMARY_JAPAN = {
  label: 'Japan trip', // free-form label describing the selection (here: tag "Japan trip")
  filterKind: 'tag',
  summary: {
    movementCount: 4,
    totalIncomeCents: 0,
    totalExpenseCents: 133182,
    cashFlowCents: -133182,
    avgExpenseCents: 33296,
    avgIncomeCents: 0,
    avgMovementAmountCents: 33296,
  },
  tentative: false,
};

export const BASIC_SUMMARY_SALARY = {
  label: 'Salary', // category slice
  filterKind: 'category',
  summary: {
    movementCount: 6,
    totalIncomeCents: 1320000,
    totalExpenseCents: 0,
    cashFlowCents: 1320000,
    avgExpenseCents: 0,
    avgIncomeCents: 220000,
    avgMovementAmountCents: 220000,
  },
  tentative: true,
};

// ---- lookup helpers --------------------------------------------------------
export const byId = (arr, id) => arr.find(x => x.id === id);
export const catOf = id => byId(CATEGORIES, id);
export const envOf = id => byId(ENVELOPES, id);
export const tagOf = id => byId(TAGS, id);
export function envMapEntries(m) { return m.map(([eid, cents]) => ({ envelope: envOf(eid), cents })); }
export function movementTotalOfCompound(c) {
  return c.childIds.reduce((s, id) => { const mv = byId(MOVEMENTS, id); return s + (mv ? (mv.isPositive ? mv.quantityCents : -mv.quantityCents) : 0); }, 0);
}

// ============================================================================
// CHART DATA LAYER
// The charts run off getFilterSummary(filter).children (the selected movement set).
// CHART_MOVEMENTS is a coherent 6-month selection (Aug 2025 → Jan 2026, spanning two
// years so the "per year" timeframe is meaningful) that all three charts aggregate.
// ============================================================================
function genChartMovements() {
  const span = [[2025,7],[2025,8],[2025,9],[2025,10],[2025,11],[2026,0]]; // Aug..Jan
  const envExpense = { 1:[380,420,460,510,540,478], 2:[900,900,900,900,900,900], 3:[110,90,140,60,120,62], 6:[130,180,90,210,150,138] };
  const mainIncome = [2200,2200,2200,2200,2350,2200];
  const catByEnv = { 1:1, 2:3, 3:4, 6:5, 5:2 };
  let id = 9000; const out = [];
  span.forEach(([y,m], mi) => {
    Object.keys(envExpense).forEach(envId => {
      out.push({ id:id++, date:new Date(y,m,15), envId:+envId, catId:catByEnv[envId], quantityCents:envExpense[envId][mi]*100,
        isPositive:false, status: mi>=4?'tentative':'confirmed', isCompound:false, tagId:(+envId===6?1:null) });
    });
    out.push({ id:id++, date:new Date(y,m,20), envId:5, catId:2, quantityCents:mainIncome[mi]*100,
      isPositive:true, status: mi===5?'tentative':'confirmed', isCompound:false, tagId:null });
  });
  out.push({ id:id++, date:new Date(2026,0,8), envId:5, catId:7, quantityCents:129900, isPositive:false, status:'anomalous', isCompound:false, tagId:null });
  out.push({ id:id++, date:new Date(2025,10,11), envId:6, catId:5, quantityCents:42000, isPositive:false, status:'confirmed', isCompound:true, tagId:1 });
  return out;
}
export const CHART_MOVEMENTS = genChartMovements();

// Which VARs are money (vs plain counts) — governs formatting.
export const CHART_VARS = {
  count:        { label:'Movement count', money:false },
  expense:      { label:'Expenses',        money:true },
  income:       { label:'Income',          money:true },
  cashflow:     { label:'Cash flow',       money:true },
  moved:        { label:'Total money moved',money:true },
  avgExpense:   { label:'Avg expense',     money:true },
  avgIncome:    { label:'Avg income',      money:true },
  avgMovement:  { label:'Avg movement',    money:true },
  anomCount:    { label:'Anomalous count', money:false },
  status:       { label:'Status',          money:false },
};
export function isMoneyVar(v){ return !!(CHART_VARS[v] && CHART_VARS[v].money); }
export function fmtChartValue(v, cents){ return isMoneyVar(v) ? fmtMoney(cents, { sign:false }) : String(cents); }

function aggValue(list, varKey) {
  const exp = list.filter(m=>!m.isPositive), inc = list.filter(m=>m.isPositive);
  const sum = a => a.reduce((s,m)=>s+m.quantityCents,0);
  switch (varKey) {
    case 'count': return list.length;
    case 'expense': return sum(exp);
    case 'income': return sum(inc);
    case 'cashflow': return sum(inc)-sum(exp);
    case 'moved': return sum(list);
    case 'avgExpense': return exp.length ? Math.round(sum(exp)/exp.length) : 0;
    case 'avgIncome': return inc.length ? Math.round(sum(inc)/inc.length) : 0;
    case 'avgMovement': return list.length ? Math.round(sum(list)/list.length) : 0;
    case 'anomCount': return list.filter(m=>m.status==='anomalous').length;
    default: return list.length;
  }
}
function groupKeyOf(m, groupKey) {
  switch (groupKey) {
    case 'envelope': { const e=envOf(m.envId); return { key:'e'+m.envId, label:e.name, color:e.color }; }
    case 'category': { const c=catOf(m.catId); return { key:'c'+m.catId, label:c.name, color:c.color }; }
    case 'tag': { if(!m.tagId) return { key:'none', label:'Untagged', color:'#c3cad4' }; const t=tagOf(m.tagId); return { key:'t'+m.tagId, label:t.name, color:t.color }; }
    case 'month': return { key:m.date.getFullYear()+'-'+m.date.getMonth(), label:MONTHS_SHORT[m.date.getMonth()]+" '"+String(m.date.getFullYear()).slice(2), color:null, sort:m.date.getFullYear()*12+m.date.getMonth() };
    case 'year': return { key:''+m.date.getFullYear(), label:''+m.date.getFullYear(), color:null, sort:m.date.getFullYear() };
    case 'status': { if(m.isCompound) return { key:'compound', label:'Compound', color:'#6b5cf5' }; const map={confirmed:['Confirmed','#1c8a4d'],tentative:['Tentative','#e8a33d'],anomalous:['Anomalous','#d23b2b']}; const mp=map[m.status]||['Other','#98a1b0']; return { key:m.status, label:mp[0], color:mp[1] }; }
    case 'direction': return m.isPositive ? { key:'in', label:'Income', color:'#1c8a4d' } : { key:'out', label:'Expense', color:'#d23b2b' };
    default: return { key:'all', label:'Total', color:'#2f6bf6' };
  }
}
// Pie: a VAR measured, split into slices by a GROUP. VAR 'status' forces grouping by status.
// `src` is the movement set — defaults to the parent selection; charts pass their own when self-filtering.
export function pieData(varKey, groupKey, src) {
  const list = src || CHART_MOVEMENTS;
  const eff = varKey==='status' ? { v:'count', g:'status' } : { v:varKey, g:groupKey };
  const groups = {};
  list.forEach(m => { const g=groupKeyOf(m, eff.g); (groups[g.key] = groups[g.key] || { ...g, items:[] }).items.push(m); });
  let arr = Object.values(groups).map(g => ({ label:g.label, color:g.color, value:Math.abs(aggValue(g.items, eff.v)), sort:g.sort })).filter(s=>s.value>0);
  if (eff.g==='month'||eff.g==='year') arr.sort((a,b)=>a.sort-b.sort); else arr.sort((a,b)=>b.value-a.value);
  arr.forEach((s,i)=>{ if(!s.color) s.color=PALETTE[i%PALETTE.length]; });
  return arr;
}
// Bar: a VAR, stacked-partitioned by a DIVIDER (may be 'null'), one bar per TIMEFRAME instance.
export function barData(varKey, dividerKey, timeframe, src) {
  const list = src || CHART_MOVEMENTS;
  const periodOf = m => timeframe==='years'
    ? { key:''+m.date.getFullYear(), label:''+m.date.getFullYear(), sort:m.date.getFullYear() }
    : { key:m.date.getFullYear()+'-'+m.date.getMonth(), label:MONTHS_SHORT[m.date.getMonth()]+" '"+String(m.date.getFullYear()).slice(2), sort:m.date.getFullYear()*12+m.date.getMonth() };
  const pmap={}; list.forEach(m=>{ const p=periodOf(m); pmap[p.key]=p; });
  const periods = Object.values(pmap).sort((a,b)=>a.sort-b.sort);
  const div = m => dividerKey==='null' ? { key:'all', label:'Total', color:'#2f6bf6' } : groupKeyOf(m, dividerKey);
  const dmap={}; list.forEach(m=>{ const d=div(m); dmap[d.key]=dmap[d.key]||{ ...d }; });
  const groups = Object.values(dmap);
  groups.forEach((g,i)=>{ if(!g.color) g.color=PALETTE[i%PALETTE.length]; });
  groups.forEach(g => { g.values = periods.map(p => Math.abs(aggValue(list.filter(m=>periodOf(m).key===p.key && div(m).key===g.key), varKey))); });
  const max = Math.max(1, ...periods.map((p,pi)=>groups.reduce((s,g)=>s+g.values[pi],0)));
  return { periods, groups, max };
}
// Line: same as bar without a divider — one series over the timeframe.
export function lineData(varKey, timeframe, src) {
  const b = barData(varKey, 'null', timeframe, src);
  const values = b.periods.map((p,pi)=>b.groups.reduce((s,g)=>s+g.values[pi],0));
  return { periods:b.periods, values, max:Math.max(1, ...values) };
}
// A chart's OWN filtered query (stand-in for window.movements.getFilterSummary(ownFilter).children).
// Returns a visibly different subset so self-filtering is obvious in the mock.
export function chartMovementsFiltered() {
  return CHART_MOVEMENTS.filter(m => !m.isPositive && m.status !== 'anomalous');
}
export const OWN_FILTER_LABEL = "Expenses · excl. anomalies";
// Donut geometry — annular-sector path per slice (fill-rule:evenodd handles the single-slice ring).
export function donutSlices(data, cx=100, cy=100, R=92, r=54) {
  const total = data.reduce((s,d)=>s+d.value,0) || 1;
  const P = (cx,cy,rad,a)=>[ (cx+rad*Math.sin(a)).toFixed(2), (cy-rad*Math.cos(a)).toFixed(2) ];
  if (data.length === 1) {
    const d=data[0];
    const path = `M ${cx} ${cy-R} A ${R} ${R} 0 1 1 ${cx-0.01} ${cy-R} Z M ${cx} ${cy-r} A ${r} ${r} 0 1 0 ${cx+0.01} ${cy-r} Z`;
    return [{ ...d, path, pct:100 }];
  }
  let a=0;
  return data.map(d => {
    const frac=d.value/total, a1=a+frac*2*Math.PI, large=(a1-a)>Math.PI?1:0;
    const [ox0,oy0]=P(cx,cy,R,a), [ox1,oy1]=P(cx,cy,R,a1), [ix1,iy1]=P(cx,cy,r,a1), [ix0,iy0]=P(cx,cy,r,a);
    const path = `M ${ox0} ${oy0} A ${R} ${R} 0 ${large} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix0} ${iy0} Z`;
    const pct=Math.round(frac*100); a=a1;
    return { ...d, path, pct };
  });
}


// ============================================================================
// DASHBOARD account-level stat cards.
// Each card shows an ACCOUNT total; clicking opens a modal listing that stat for
// every envelope (window.periodSummaries.getAll(accountId, year, month)).
// Budget is the exception: no account-level envelope exists, so the CARD shows the
// DEFAULT envelope's budget, and the modal lists every budgeted envelope.
// ============================================================================
const DEFAULT_ENVELOPE_ID = 5; // "Main"
export function dashboardStats() {
  const rows = MULTI_ENVELOPE_JAN;
  const sum = f => rows.reduce((s, e) => s + (f(e) || 0), 0);
  const incomeOf = e => e.cashFlowCents > 0 ? e.cashFlowCents : 0;
  const expenseOf = e => e.cashFlowCents < 0 ? -e.cashFlowCents : 0;
  const budgeted = rows.filter(e => e.budgetCents != null);
  const def = byId(ENVELOPES, DEFAULT_ENVELOPE_ID);
  return {
    balance: {
      key: 'balance', title: 'Balance', accent: '#2f6bf6', signed: true, neutral: false,
      total: sum(e => e.endingBalanceCents),
      modalTitle: 'Balance · all envelopes',
      rows: rows.map(e => ({ label: e.name, cents: e.endingBalanceCents, signed: false })),
      footnote: 'Ending balance across every envelope in the account for the current month.',
    },
    budget: {
      key: 'budget', title: 'Budget', accent: '#e8a33d', signed: false, neutral: true,
      sublabel: 'Default envelope', isBudget: true,
      total: def ? def.budgetCents : 0,
      totalLabel: def ? def.name : '',
      modalTitle: 'Budget · all envelopes',
      rows: [
        { label: (def ? def.name : 'Main') + ' (default)', cents: def && def.budgetCents ? def.budgetCents : 0, signed: false, bold: true },
        ...budgeted.filter(e => e.envelopeId !== DEFAULT_ENVELOPE_ID).map(e => ({ label: e.name, cents: e.budgetCents, signed: false, divider: true })),
      ],
      footnote: 'The card shows the default envelope\u2019s budget (there is no account-level envelope). The modal lists every budgeted envelope.',
    },
    cashflow: {
      key: 'cashflow', title: 'Cash Flow', accent: '#6b5cf5', signed: true, neutral: false,
      total: sum(e => e.cashFlowCents),
      modalTitle: 'Cash flow · all envelopes',
      rows: rows.map(e => ({ label: e.name, cents: e.cashFlowCents, signed: true })),
      footnote: 'Net income minus expenses per envelope for the current month.',
    },
    income: {
      key: 'income', title: 'Income', accent: '#1c8a4d', signed: true, neutral: false,
      total: sum(incomeOf),
      modalTitle: 'Income · all envelopes',
      rows: rows.map(e => ({ label: e.name, cents: incomeOf(e), signed: true })),
      footnote: 'Money in, attributed to each envelope for the current month.',
    },
    expenses: {
      key: 'expenses', title: 'Expenses', accent: '#d23b2b', signed: true, neutral: false,
      total: -sum(expenseOf),
      modalTitle: 'Expenses · all envelopes',
      rows: rows.map(e => ({ label: e.name, cents: -expenseOf(e), signed: true })),
      footnote: 'Money out, attributed to each envelope for the current month.',
    },
  };
}
