# Angular + Electron + SQLite Template

> **IMPORTANT — schema version:** `electron/repository/schema.ts`, `electron/repository/database.service.ts`, and SQL in repository files can be modified freely. However, do NOT increment the schema version — it must remain at 1.

Template funcional de punto de partida para proyectos desktop con Angular como renderer, Electron como main process, y SQLite como base de datos local. Incluye lógica mínima de ejemplo (operaciones matemáticas y contador de palabras) que demuestra la comunicación frontend↔backend y la persistencia en base de datos.

---

## Arquitectura general

El proyecto sigue una estructura de **tres mini-proyectos**: un proyecto padre que orquesta dos hijos.

```
financely/
├── angular/              # Proyecto hijo: frontend (renderer process)
├── electron/             # Proyecto hijo: backend (main process)
├── shared/               # Tipos e interfaces compartidos entre ambos hijos
├── dist/                 # Todo el output de compilación y packaging
├── package.json          # Proyecto padre: scripts de orquestación y electron-builder
├── electron-builder.yml
├── eslint.config.mjs     # Config ESLint unificada (flat config)
├── .prettierrc           # Config Prettier compartida
└── .prettierignore
```

Cada hijo tiene su propio `package.json` y puede ejecutarse de forma independiente. El proyecto padre no contiene código fuente propio — solo scripts y config de build/tooling.

---

## Estructura detallada

### `angular/` — Frontend

```
angular/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── defaults.ts                   # Constantes compartidas (color order, category icons)
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── models/
│   │   │   └── services/
│   │   │       ├── electron.service.ts       # Wrapper RxJS sobre la IPC API
│   │   │       ├── notification.service.ts   # Cola de toasts (signal-based)
│   │   │       ├── confirm.service.ts        # Modal de confirmación (Observable-based, sobre DialogService)
│   │   │       ├── dialog.service.ts         # Abridor imperativo de diálogos (CDK Overlay)
│   │   │       ├── dialog-ref.ts             # Handle del diálogo: close(), afterClosed()
│   │   │       ├── dialog.tokens.ts          # InjectionToken DIALOG_DATA
│   │   │       ├── error-text.service.ts     # AppErrorCode → texto human-readable
│   │   │       └── error-reporter.service.ts # Operador `.toast()`: catch + resolve + notify
│   │   ├── features/
│   │   │   ├── accounts/                     # account-form/, accounts-list/, accounts.component.*
│   │   │   ├── categories/                   # categories-list/, category-form/, categories.component.*
│   │   │   ├── envelopes/                    # envelope-form/, envelopes-list/, envelopes.component.*
│   │   │   ├── month-overview/               # MonthOverviewComponent — resumen mensual de account + envelopes
│   │   │   ├── movements/                    # movement-form/, movements-list/, movements-filter/, movement-list-compact/, movement-detail-dialog/, movements.component.*
│   │   │   ├── settings/                     # settings.component.*
│   │   │   └── tags/                         # tag-form/, tags-list/, tags.component.*
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── amount-input/             # AmountInputComponent — decimal text ↔ integer cents
│   │   │   │   ├── autocomplete-input/       # AutocompleteInputComponent — async prefix suggest + keyboard nav
│   │   │   │   ├── button/                   # ButtonComponent
│   │   │   │   ├── chip/                     # ChipComponent — color dot, emoji, variantes removable/action
│   │   │   │   ├── color-swatches/           # ColorSwatchesComponent — paleta con reorder/add/delete
│   │   │   │   ├── confirm-dialog/           # Modal de confirmación
│   │   │   │   ├── empty-state/              # EmptyStateComponent — message + icon? + slot proyectado para CTA
│   │   │   │   ├── entity-select/            # EntitySelectComponent<T> — chips + popover multi-select
│   │   │   │   ├── form-field/               # FormFieldComponent — label + slot + error
│   │   │   │   ├── icon-picker/              # IconPickerComponent — grid de emojis con reorder/add/delete
│   │   │   │   ├── modal/                    # ModalComponent — overlay declarativo para componentes "ventana"
│   │   │   │   ├── navbar/
│   │   │   │   ├── popover/                  # PopoverComponent — backdrop + panel anclado
│   │   │   │   ├── quick-create-movement-button/ # Abre MovementForm en un diálogo
│   │   │   │   ├── period-summary-card/      # PeriodSummaryCardComponent — muestra un PeriodSummary de un mes
│   │   │   │   ├── stat-card/                # StatCardComponent — title + valor + sublabel/icon opcionales
│   │   │   │   ├── tag-picker/               # TagPickerComponent — wrapper sobre EntitySelect + popover de creación
│   │   │   │   └── toast-host/               # Host de toasts
│   │   │   ├── directives/
│   │   │   │   └── sortable.directive.ts     # Wrapper Angular sobre SortableJS
│   │   │   ├── pipes/
│   │   │   │   └── money.pipe.ts             # Formatea céntimos → "22.50 €"
│   │   │   └── utils.ts                      # parseMoney, formatCents, contrastColor
│   │   ├── types/
│   │   │   └── global.d.ts                   # Augmentation del Window para tipar el contextBridge
│   │   ├── app.component.*
│   │   └── app.component.spec.ts
│   ├── testing/
│   │   ├── mock-electron.service.ts          # Fixture compartido entre tests
│   │   └── sample-summaries.ts               # Fixtures de PeriodSummary para tests
│   ├── styles.scss                           # Design tokens, clases globales, estilos CDK overlay
│   ├── vitest.setup.ts                       # Setup del entorno de test Angular
│   └── environments/
│       ├── environment.ts                    # LOCAL
│       ├── environment.dev.ts
│       └── environment.prod.ts
├── angular.json                              # outputPath: ../dist/renderer
├── vitest.config.ts                          # Config de Vitest
├── package.json
├── tsconfig.json                             # Base (IDE + herencia)
├── tsconfig.app.json                         # Para ng build (extiende base)
└── tsconfig.spec.json                        # Extiende base, para compatibilidad IDE
```

Angular 19, standalone components (sin NgModule). El output de build va a `dist/renderer/`. Los tests se co-localizan junto al código fuente (convención Angular); el fixture compartido vive en `src/testing/`.

### `electron/` — Backend

```
electron/
├── ipc/
│   ├── channels.ts                       # Constantes de nombres de canal IPC
│   ├── ipc-utils.ts                      # ipcHandle() — normaliza errores a AppErrorCode antes del IPC
│   ├── movements.handler.ts
│   ├── categories.handler.ts
│   ├── accounts.handler.ts
│   ├── envelopes.handler.ts
│   ├── period-summaries.handler.ts
│   ├── tags.handler.ts
│   └── settings.handler.ts
├── repository/
│   ├── database.service.ts               # SQLite con better-sqlite3, migrate(), seed
│   ├── schema.ts                         # DDL + migraciones declarativas
│   ├── movement-repository.service.ts
│   ├── category-repository.service.ts
│   ├── account-repository.service.ts
│   ├── envelope-repository.service.ts
│   ├── period-summary-repository.service.ts
│   └── tag-repository.service.ts
├── services/
│   ├── movement.service.ts               # Validación + delega al repositorio
│   ├── category.service.ts
│   ├── account.service.ts                # Incluye getAccountStats() (agregados SUM/COUNT)
│   ├── envelope.service.ts
│   ├── period-summary.service.ts         # Creación, recálculo y propagación dirty de PeriodSummary
│   ├── tag.service.ts
│   └── settings.service.ts               # electron-store (AppSettings)
├── __tests__/
│   ├── jest.setup.ts                     # Mock global de better-sqlite3
│   └── services/
│       ├── account.service.test.ts
│       ├── category.service.test.ts
│       ├── envelope.service.test.ts
│       ├── movement.service.test.ts
│       ├── settings.service.test.ts
│       └── tag.service.test.ts
├── constants.ts                          # Constantes de nombres de tabla (objeto tables)
├── main.ts                               # Entry point del main process
├── preload.ts                            # Expone la API al renderer vía contextBridge
├── esbuild.config.mjs                    # Config de bundling (main + preload → dist/main/)
├── tsconfig.json                         # Solo type-check (noEmit: true)
├── tsconfig.test.json                    # tsconfig para Jest
└── package.json
```

El output de esbuild va a `dist/main/` (dos archivos: `main.js` y `preload.js`). Los tests de integración usan `jest.unmock('better-sqlite3')` localmente y un directorio temporal en `os.tmpdir()`, llamando a `migrate()` entre tests para garantizar estado limpio.

### `shared/` — Tipos compartidos

```
shared/
├── types.ts       # Movement, Category, Account, AccountStats, Envelope, Tag, AppSettings, MovementFilter, Period, BasicSummary, PeriodSummary, DirtyState
├── interfaces.ts  # Movements, Categories, Accounts, Envelopes, Tags, Settings, PeriodSummaries (contratos IPC)
└── error-codes.ts # AppErrorCode + AppError — usado por backend (throw) y frontend (resolve a texto)
```

Importado tanto por el frontend (`electron.service.ts`) como por el backend (servicios y handlers).

**Tipo de dominio clave — `PeriodSummary`:** snapshot mensual de actividad financiera para una combinación `(accountId, envelopeId, year, month)` (`envelopeId = null` → resumen a nivel de cuenta). El campo `month` es **0-indexado** (convenio `Date.getMonth()` de JavaScript); la capa de presentación suma 1 al renderizar. Incluye todos los campos de `BasicSummary` (cash flow, totales income/expense, medias, count) más: `endingBalanceCents` — cadena acumulativa `ending_balance(P) = ending_balance(P-1) + cashFlow(P)`, anclada en `startingBalance` del account o envelope en el primer periodo; `availableBudgetCents` — presupuesto restante para summaries de envelope con budget fijo; `notes` — único campo editable por el usuario; `dirtyState: DirtyState` (`'CLEAN' | 'MODIFIED' | 'DIRTY'`) — `MODIFIED` desencadena recálculo completo de agregados desde los movimientos; `DIRTY` propaga únicamente el endingBalance en la cadena sin releer movimientos. Las vistas multi-mes se ensamblan al vuelo a partir de los datos mensuales almacenados.

### `dist/` — Output (gitignored)

```
dist/
├── main/          # main.js + preload.js (esbuild)
├── renderer/      # App Angular compilada (ng build)
└── build/         # App empaquetada por electron-builder
```

---

## Flujo IPC

```
Angular Component
    ↓
ElectronService (RxJS wrapper sobre Promises)
    ↓
window.movements / .categories / .accounts / .envelopes / .tags / .settings / .periodSummaries  (contextBridge)
    ↓
ipcRenderer.invoke(Channels.X)
    ↓
ipcMain.handle(Channels.X)  →  Handler (electron/ipc/)
    ↓
Service (electron/services/)
    ↓
Repository (electron/repository/)
    ↓
SQLite (better-sqlite3)
```

El preload script actúa como capa de seguridad: expone únicamente las funciones declaradas explícitamente, sin acceso directo a Node.js desde el renderer.

---

## Scripts principales

### Desde la raíz

| Script                     | Qué hace                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| `npm start`                | Compila electron (esbuild) y arranca angular + electron en paralelo |
| `npm run compile`          | Compila angular (dev) + electron                                    |
| `npm run compile:angular`  | Solo compila angular en modo dev                                    |
| `npm run compile:electron` | Solo compila electron con esbuild                                   |
| `npm test`                 | Ejecuta tests de angular y electron                                 |
| `npm run test:all`         | Tests + E2E (Playwright)                                            |
| `npm run e2e`              | Solo tests E2E con Playwright                                       |
| `npm run lint`             | ESLint sobre todo el proyecto                                       |
| `npm run lint:angular`     | ESLint solo sobre `angular/src`                                     |
| `npm run lint:electron`    | ESLint solo sobre `electron/`                                       |
| `npm run format`           | Prettier sobre todos los fuentes                                    |
| `npm run format:check`     | Verifica formato sin modificar ficheros                             |

### Desde `electron/`

| Script                  | Qué hace                                          |
| ----------------------- | ------------------------------------------------- |
| `npm run build`         | esbuild (one-shot)                                |
| `npm run build:watch`   | esbuild en modo watch                             |
| `npm run type-check`    | `tsc --noEmit` (verificación de tipos sin emitir) |
| `npm run start:serve`   | `electron . --serve` (carga desde localhost:4200) |
| `npm test`              | Jest (one-shot)                                   |
| `npm run test:watch`    | Jest en modo watch                                |
| `npm run test:coverage` | Jest con informe de cobertura                     |

### Desde `angular/`

| Script               | Qué hace                               |
| -------------------- | -------------------------------------- |
| `npm start`          | `ng serve` en :4200                    |
| `npm run build:dev`  | Build de desarrollo → `dist/renderer/` |
| `npm run build:prod` | Build de producción → `dist/renderer/` |
| `npm test`           | Vitest en modo watch                   |
| `npm run test:run`   | Vitest one-shot                        |
| `npm run test:ui`    | Vitest con interfaz gráfica            |

---

## Configuraciones clave

### esbuild (`electron/esbuild.config.mjs`)

Bundlea `main.ts` y `preload.ts` por separado. Externos: `electron` y `better-sqlite3` (módulo nativo, no se puede bundlear). Target: `node22` (Node.js embebido en Electron 40). Soporta modo `--watch`.

### electron-builder (`electron-builder.yml`)

Empaqueta desde la raíz del proyecto. Incluye `dist/main/**` y `dist/renderer/**`. Output en `dist/build/`. Targets Windows: NSIS + ZIP.

### Vitest (`angular/vitest.config.ts`)

Usa `@analogjs/vite-plugin-angular` para compilar componentes Angular (resuelve `templateUrl` y `styleUrl` en tiempo de test). Entorno `happy-dom`. Tests co-localizados: `src/**/*.spec.ts`. Setup manual del entorno de testing Angular en `src/vitest.setup.ts`.

### Jest (`electron/package.json` + `jest.config` implícita)

`ts-jest` como preset para transformar TypeScript. Entorno `node`. Los módulos nativos (`electron`, `better-sqlite3`) deben mockearse en tests unitarios.

### ESLint (`eslint.config.mjs`)

Flat config (ESLint v9). Tres bloques: (1) `electron/**` + `shared/**` con `typescript-eslint` recommended; (2) `angular/src/**/*.ts` con `typescript-eslint` + `angular-eslint` tsRecommended; (3) `angular/src/**/*.html` con `angular-eslint` templateRecommended + templateAccessibility. `eslint-config-prettier` al final para evitar conflictos con Prettier.

### Prettier (`.prettierrc`)

Config compartida: `singleQuote`, `trailingComma: all`, `printWidth: 100`, `endOfLine: lf`. Override HTML: `printWidth: 120`.

### `better-sqlite3`

Módulo nativo que requiere ser recompilado para la versión de Node embebida en Electron. Tras `npm install` en la raíz, ejecutar:

```bash
npx @electron/rebuild --force
```

---

## Tecnologías

| Capa               | Tecnología                             | Versión |
| ------------------ | -------------------------------------- | ------- |
| Frontend           | Angular                                | 19      |
| Desktop            | Electron                               | 40      |
| Base de datos      | better-sqlite3                         | 12.x    |
| Bundler (electron) | esbuild                                | 0.25.x  |
| Packaging          | electron-builder                       | 26.x    |
| Lenguaje           | TypeScript                             | 5.x     |
| Tests frontend     | Vitest + @analogjs/vite-plugin-angular | 3.x     |
| Tests backend      | Jest + ts-jest                         | 30.x    |
| Tests E2E          | Playwright                             | 1.x     |
| Linter             | ESLint (flat config)                   | 10.x    |
| Formatter          | Prettier                               | 3.x     |

---

## User requests

> These are persistent preferences the user has explicitly asked for. Follow them in every session.

- **Notification sound on completion:** Play a beep when each response finishes. Configured via the `Stop` hook in `.claude/settings.local.json` using `powershell -c "[Console]::Beep(880,200)"` (Windows). Do not remove or disable this hook.
- **Change summary with file links:** After every response that modifies files, include a summary of what changed. Reference each file as a markdown link (e.g. `[filename.ts](path/to/filename.ts)`) so they are clickable in the IDE.
