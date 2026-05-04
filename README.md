# Angular + Electron + SQLite Template

A working template for building desktop applications with **Angular** as the renderer, **Electron** as the main process, and **SQLite** (via `better-sqlite3`) as the local database. The repository ships with minimal example logic — arithmetic operations and a word counter — that exercises every layer of the stack: an Angular form calls an RxJS service, which crosses the IPC boundary, hits a backend handler, runs a SQL query, and round-trips the result back to the UI.

Use this as the starting point for any project that fits the Angular + Electron + SQLite shape.

---

## Project structure

The project is organized as a **parent project orchestrating two child projects** that share a folder of common types:

```
from-scratch-angular-electron/
├── angular/              # Renderer (frontend) — its own package.json
├── electron/             # Main process (backend) — its own package.json
├── shared/               # Types and interfaces shared across both children
├── e2e/                  # Playwright end-to-end tests
├── dist/                 # All compilation and packaging output (gitignored)
├── .github/workflows/    # CI/CD pipelines
├── .husky/               # Git hooks (pre-commit)
├── .vscode/              # Workspace-level debug/task configurations
├── package.json          # Parent: orchestration scripts and packaging tooling
├── electron-builder.yml
├── playwright.config.ts
├── eslint.config.mjs     # Unified ESLint flat config
├── .prettierrc
└── .prettierignore
```

The parent `package.json` contains no source code — only orchestration scripts, packaging tooling (`electron-builder`), Husky, and quality tools (ESLint, Prettier). Each child can be developed and tested in isolation.

### `angular/` — Renderer

```
angular/
├── src/
│   ├── app/
│   │   ├── core/                                 # App-wide singletons
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── models/
│   │   │   └── services/
│   │   │       ├── electron.service.ts           # RxJS wrapper over the IPC API
│   │   │       └── electron.service.spec.ts
│   │   ├── features/                             # One folder per feature
│   │   │   ├── operations/
│   │   │   └── sentences/
│   │   ├── shared/                               # Reusable UI atoms
│   │   │   ├── components/
│   │   │   ├── directives/
│   │   │   └── pipes/
│   │   ├── services/                             # Reserved for cross-feature services
│   │   ├── app.component.*
│   │   └── app.component.spec.ts
│   ├── testing/
│   │   └── mock-electron.service.ts              # Shared test fixture
│   ├── environments/
│   │   ├── environment.ts                        # Local default
│   │   ├── environment.dev.ts
│   │   └── environment.prod.ts
│   └── vitest.setup.ts                           # Vitest environment bootstrap
├── angular.json                                  # Build outputs to ../dist/renderer
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.app.json                             # Used by ng build
├── tsconfig.spec.json                            # Kept for IDE compatibility
└── package.json
```

Angular 19, **standalone components only** (no NgModule). Component specs live next to their source (`*.spec.ts` co-located, the Angular convention). Shared test fixtures (mocks, helpers) go under `src/testing/`.

**Where to put new things:**

| What                                  | Where                  |
| ------------------------------------- | ---------------------- |
| New feature (page/route)              | `app/features/<name>/` |
| App-wide singleton service            | `app/core/services/`   |
| Reusable UI component/pipe/directive  | `app/shared/`          |
| Cross-feature service (not a feature) | `app/services/`        |
| Test mock or fixture                  | `src/testing/`         |

### `electron/` — Main process

```
electron/
├── ipc/
│   ├── channels.ts                       # IPC channel name constants
│   ├── api.handler.ts
│   ├── operations.handler.ts
│   └── sentences.handler.ts
├── services/
│   ├── api.service.ts
│   ├── database.service.ts               # SQLite (better-sqlite3)
│   ├── operations.service.ts
│   └── sentences.service.ts
├── __tests__/                            # Jest tests (mirrored layout)
│   ├── jest.setup.ts                     # Mocks better-sqlite3
│   ├── mocks/
│   └── services/
├── main.ts                               # Entry point of the main process
├── preload.ts                            # Bridges IPC to the renderer (contextBridge)
├── esbuild.config.mjs                    # Bundles main + preload → dist/main/
├── tsconfig.json                         # noEmit: true (type-check only)
└── package.json
```

The main process is bundled by **esbuild**, not `tsc` — TypeScript here is type-checking-only. Output goes to `dist/main/main.js` and `dist/main/preload.js`. Backend tests live under `__tests__/` (mirrored structure, Jest convention) and are not co-located.

**Where to put new things:**

| What                       | Where                               |
| -------------------------- | ----------------------------------- |
| New IPC channel            | Add to `ipc/channels.ts`            |
| New IPC handler            | `ipc/<feature>.handler.ts`          |
| Business logic / DB access | `services/<feature>.service.ts`     |
| Backend test               | `__tests__/services/<name>.test.ts` |
| Backend test mock          | `__tests__/mocks/`                  |

### `shared/` — Shared types

```
shared/
├── types.ts       # Operation, Sentence, Operator
└── interfaces.ts  # Api, Ops, Sents — the IPC API contracts
```

Imported by both children: the renderer's `electron.service.ts` and the backend's services and handlers. Anything that crosses the IPC boundary should be typed here.

### `e2e/` — End-to-end tests

```
e2e/
├── tests/                    # Playwright specs (*.spec.ts)
└── fixtures/                 # Shared Playwright fixtures
```

### `dist/` — Output (gitignored)

```
dist/
├── main/          # main.js + preload.js (esbuild)
├── renderer/      # Compiled Angular app (ng build)
└── build/         # Packaged installers (electron-builder)
```

---

## Tech stack

| Layer                | Tool                                                        | Version | Configured in                           |
| -------------------- | ----------------------------------------------------------- | ------- | --------------------------------------- |
| Renderer framework   | Angular (standalone)                                        | 19      | `angular/angular.json`                  |
| Desktop runtime      | Electron                                                    | 40      | `electron/main.ts`, root `package.json` |
| Database             | `better-sqlite3`                                            | 12.x    | `electron/services/database.service.ts` |
| Native rebuild       | `@electron/rebuild`                                         | 4.x     | Run after install (see Setup)           |
| Renderer dev server  | Angular CLI (`ng serve`)                                    | 19      | `angular/angular.json`                  |
| Backend bundler      | esbuild                                                     | 0.25.x  | `electron/esbuild.config.mjs`           |
| Packager             | electron-builder                                            | 26.x    | `electron-builder.yml`                  |
| Language             | TypeScript                                                  | 5.x     | `*/tsconfig.json`                       |
| Renderer test runner | Vitest + `@analogjs/vite-plugin-angular`                    | 3.x     | `angular/vitest.config.ts`              |
| Backend test runner  | Jest + `ts-jest`                                            | 30.x    | `electron/package.json` (`jest` key)    |
| E2E test runner      | Playwright                                                  | 1.x     | `playwright.config.ts`                  |
| Linter               | ESLint flat config + `typescript-eslint` + `angular-eslint` | 10.x    | `eslint.config.mjs`                     |
| Formatter            | Prettier                                                    | 3.x     | `.prettierrc`, `.prettierignore`        |
| Git hooks            | Husky                                                       | 9.x     | `.husky/`                               |
| CI/CD                | GitHub Actions                                              | —       | `.github/workflows/`                    |

---

## Setup

```bash
# 1. Install root dependencies
npm install

# 2. Install renderer and backend dependencies
npm --prefix angular install
npm --prefix electron install

# 3. Rebuild better-sqlite3 against Electron's Node ABI
#    Required because better-sqlite3 is a native module.
npx @electron/rebuild --force
```

Husky's `prepare` script wires up Git hooks automatically on `npm install` in the root.

---

## Scripts

### Root (orchestration)

| Script                               | What it does                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `npm start`                          | Compile Electron, then run Angular dev server + Electron in parallel  |
| `npm run start:local`                | Compile both, then start Electron pointing at the local file:// build |
| `npm run start:electron-local`       | Same as above but skips recompiling Electron                          |
| `npm run compile`                    | Build Angular (dev) + Electron                                        |
| `npm run compile:angular`            | Only Angular dev build                                                |
| `npm run compile:electron`           | Only esbuild for the main process                                     |
| `npm run compile-and-build`          | `compile` + run electron-builder (installer)                          |
| `npm test`                           | Run Angular unit tests + Electron unit tests                          |
| `npm run test:all`                   | Above + Playwright E2E                                                |
| `npm run e2e`                        | Playwright only                                                       |
| `npm run e2e:ui` / `e2e:debug`       | Playwright in UI / debug mode                                         |
| `npm run lint`                       | ESLint over the whole repo                                            |
| `npm run lint:angular` / `:electron` | Scoped ESLint                                                         |
| `npm run lint:fix`                   | ESLint with `--fix`                                                   |
| `npm run format` / `format:check`    | Prettier write / check                                                |

### `angular/` (renderer)

| Script               | What it does                          |
| -------------------- | ------------------------------------- |
| `npm start`          | `ng serve` on port 4200               |
| `npm run start:dev`  | `ng serve -c development`             |
| `npm run build:dev`  | Dev build → `../dist/renderer`        |
| `npm run build:prod` | Production build → `../dist/renderer` |
| `npm test`           | Vitest in watch mode                  |
| `npm run test:run`   | Vitest one-shot                       |
| `npm run test:ui`    | Vitest with the web UI                |

### `electron/` (main process)

| Script                  | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `npm run build`         | esbuild one-shot → `../dist/main`                  |
| `npm run build:watch`   | esbuild watch mode                                 |
| `npm run type-check`    | `tsc --noEmit`                                     |
| `npm start`             | `electron .`                                       |
| `npm run start:serve`   | `electron . --serve` (loads from `localhost:4200`) |
| `npm run start:local`   | `electron . --local` (loads from `dist/renderer`)  |
| `npm test`              | Jest one-shot                                      |
| `npm run test:watch`    | Jest watch                                         |
| `npm run test:coverage` | Jest with coverage report                          |

### Most-used commands

```bash
npm start              # full dev environment (renderer + main, with hot reload on the renderer)
npm test               # all unit tests
npm run e2e            # E2E suite
npm run lint           # full repo lint
npm run format         # apply Prettier
```

---

## Electron / IPC architecture

The renderer is sandboxed: it cannot touch Node.js or the filesystem directly. All communication with the main process flows through Electron's IPC, with the **preload script** acting as the security boundary.

```
[ Angular component ]
        │ subscribe()
        ▼
[ ElectronService ]            angular/src/app/core/services/electron.service.ts
        │ wraps Promises into RxJS Observables
        ▼
[ window.api / window.ops / window.sents ]   (exposed by contextBridge)
        │ ipcRenderer.invoke(Channels.X, payload)
        ▼
─────────── IPC boundary (preload.ts → main.ts) ───────────
        │ ipcMain.handle(Channels.X, …)
        ▼
[ IPC handler ]                electron/ipc/<feature>.handler.ts
        │ delegates to a service
        ▼
[ Service ]                    electron/services/<feature>.service.ts
        │ business logic
        ▼
[ DatabaseService ]            electron/services/database.service.ts
        │ prepared statements
        ▼
[ SQLite (better-sqlite3) ]
```

**The role of each piece:**

- **`main.ts`** — The Electron entry point. Creates the `BrowserWindow`, registers IPC handlers (`registerXxxHandlers()`), bootstraps the database. Decides whether to load the dev server (`http://localhost:4200`) or the packaged `index.html` (based on `--local` / `app.isPackaged`).
- **`preload.ts`** — Runs in a privileged context with access to both `ipcRenderer` and the renderer's `window`. Uses `contextBridge.exposeInMainWorld()` to publish a typed surface (`window.api`, `window.ops`, `window.sents`) and nothing else. The renderer cannot reach IPC any other way.
- **`ipc/channels.ts`** — Single source of truth for channel names. Both `preload.ts` and the handlers import from here, so there is no string typo class of bug.
- **`ipc/*.handler.ts`** — Bind a channel to a service function. Each handler receives `IpcMainInvokeEvent` plus the typed payload, calls the service, returns the result. Handlers should remain thin — keep logic in services.
- **`services/*.service.ts`** — All business logic (calculations, DB calls, side effects). Easy to unit-test because they have no Electron dependency.
- **`shared/interfaces.ts`** — Defines the IPC contract (`Api`, `Ops`, `Sents`). The renderer imports these to type `window.*`; the backend imports them so handler signatures match.

**Adding a new IPC call:**

1. Add a constant to `electron/ipc/channels.ts`.
2. Add the method to the relevant interface in `shared/interfaces.ts` (or create a new one).
3. Expose it via `contextBridge` in `electron/preload.ts`.
4. Register a handler in `electron/ipc/<feature>.handler.ts` and call `register…Handlers()` from `main.ts`.
5. Use it from the renderer through `ElectronService`.

---

## Testing

Three distinct test runners cover three layers. Each lives where its code lives.

### Renderer — Vitest

- **Runner**: Vitest 3 + `@analogjs/vite-plugin-angular` (compiles Angular components — resolves `templateUrl` / `styleUrl` at test time).
- **Environment**: `happy-dom`.
- **Config**: `angular/vitest.config.ts`.
- **Setup**: `angular/src/vitest.setup.ts` initializes Angular's `TestBed` with the dynamic browser platform and pulls in `@testing-library/jest-dom` matchers.
- **Convention**: tests are **co-located** alongside their source file, e.g. `app.component.spec.ts` next to `app.component.ts`.
- **Shared fixtures / mocks**: `angular/src/testing/`. The current example, `mock-electron.service.ts`, implements `Partial<ElectronService>` and is provided in spec files via `{ provide: ElectronService, useClass: MockElectronService }`.

Run them with:

```bash
npm --prefix angular run test       # watch mode
npm --prefix angular run test:run   # one-shot (used by CI and pre-commit)
npm --prefix angular run test:ui    # with the Vitest UI
```

### Backend — Jest

- **Runner**: Jest 30 + `ts-jest` (TypeScript transform).
- **Environment**: `node`.
- **Config**: `jest` key in `electron/package.json`.
- **Setup**: `electron/__tests__/jest.setup.ts` — mocks `better-sqlite3` globally, since the native module cannot load in unit tests.
- **Convention**: tests live under `electron/__tests__/`, mirroring the source structure (e.g. `__tests__/services/operations.service.test.ts`).
- **Mocks**: `electron/__tests__/mocks/`. Module-level mocks for native deps (`electron`, `better-sqlite3`) belong in `jest.setup.ts`. Per-test mocks use `jest.mock()` with `@jest/globals` imports (ts-jest does not auto-inject Jest globals here — import them explicitly).

Run them with:

```bash
npm --prefix electron run test
npm --prefix electron run test:watch
npm --prefix electron run test:coverage
```

### End-to-end — Playwright

- **Runner**: Playwright 1.x (Chromium project only).
- **Config**: `playwright.config.ts`.
- **Test directory**: `e2e/tests/`.
- **Fixtures**: `e2e/fixtures/`. Custom fixtures extend `@playwright/test`'s `base` (see `app.fixture.ts`).
- **Web server**: Playwright auto-starts `npm --prefix angular run start` and waits for `http://localhost:4200` (driven by the `webServer` block in the config). E2E currently exercises the renderer in a browser, **not** the packaged Electron app. CI runs serially with retries; local runs use `reuseExistingServer`.

Run them with:

```bash
npm run e2e            # headless
npm run e2e:ui         # Playwright UI
npm run e2e:debug      # step debugger
```

### All tests at once

```bash
npm test         # renderer + backend
npm run test:all # renderer + backend + E2E
```

---

## Quality

### ESLint

`eslint.config.mjs` (flat config, ESLint 10). Three target groups, configured in this order:

1. **Backend & shared (`electron/**/_.ts`, `shared/\*\*/_.ts`)**: `typescript-eslint` recommended.
2. **Angular TypeScript (`angular/src/**/_.ts`)**: `typescript-eslint`recommended +`angular-eslint` `tsRecommended`, plus selector-style rules (component selectors are kebab-case `app-_`, directive selectors are camelCase `app\*`). Inline templates are processed via `angular.processInlineTemplates`.
3. **Angular HTML (`angular/src/**/\*.html`)**: `angular-eslint` `templateRecommended`+`templateAccessibility`.
4. **`eslint-config-prettier`** is applied last so ESLint never argues with Prettier about formatting.

Globally ignored: `dist/`, `angular/.angular/`, all `*.js` and `*.mjs`.

```bash
npm run lint           # full repo
npm run lint:angular   # angular/src only
npm run lint:electron  # electron/ only
npm run lint:fix       # auto-fix
```

### Prettier

`.prettierrc`: single quotes, trailing commas everywhere, `printWidth: 100`, LF line endings. HTML override raises width to 120. `.prettierignore` keeps build output out.

```bash
npm run format         # write
npm run format:check   # verify only (used by hooks/CI when needed)
```

---

## Workflows and Git hooks

### Husky pre-commit hook (`.husky/pre-commit`)

Runs locally before every commit:

```sh
npm --prefix angular run test:run
npm --prefix electron run test
npm version patch --no-git-tag-version
git add package.json
```

This means **every commit** runs the unit tests and bumps the patch version. The bumped `package.json` is staged into the same commit, so there are no separate "chore: bump version" commits in history. The hook is installed automatically by Husky on `npm install` (root `package.json` has `"prepare": "husky"`).

When a hook step fails, the commit is aborted — fix the failing tests and try again.

Husky detects CI (`CI=true`) and disables hooks there, so the bot commits made by GitHub Actions don't trigger another bump.

### GitHub Actions

Three workflows under `.github/workflows/`:

#### 1. `on_commit_lint_test_update_patch.yml` — every push to non-main branches

Runs unit tests on every push to feature branches:

- Checkout, install root + Angular + Electron deps.
- Run Angular Vitest (`test:run`).
- Run Electron Jest.

Lightweight gate that catches breakages before they reach a PR.

#### 2. `on_pr_e2e_update_minor.yml` — every PR targeting `main`

Heavier gate that gives PRs a green stamp:

- Checkout the PR head, install deps.
- Install Playwright Chromium.
- Run E2E (`npm run e2e`).
- Run ESLint.
- `npm version minor --no-git-tag-version`.
- Commit and push the bump back to the PR branch (`chore: bump minor version [skip ci]`).

So: every PR ends with one minor bump commit. Acceptable noise — one commit per PR, rather than per push.

#### 3. `on_push_main_from_feature_build.yml` — push to `main`

Builds and releases:

- Windows runner.
- Install everything, rebuild `better-sqlite3` against Electron with `@electron/rebuild --force`.
- `npm run compile` (Angular + Electron).
- `npx electron-builder --win` (NSIS + ZIP, output in `dist/build/`).
- Read the version from `package.json` via PowerShell.
- `softprops/action-gh-release@v2` creates a GitHub Release tagged `v<version>` with the built `.exe` attached.

### Versioning model summary

| Trigger        | Action           | By          |
| -------------- | ---------------- | ----------- |
| Local commit   | Bump **patch**   | Husky       |
| PR to `main`   | Bump **minor**   | CI bot      |
| Push to `main` | Tag + GH Release | CI workflow |

Major bumps are intentional and manual.

---

## Debugging

Three sets of VSCode configurations exist: workspace-level (`.vscode/`), renderer-level (`angular/.vscode/`), and backend-level (`electron/.vscode/`). The latter two are for when those subfolders are opened as standalone workspaces; day-to-day development uses the workspace-level configs.

The renderer exposes a Chrome DevTools remote debugging port at `9223`, opened in `main.ts` via `app.commandLine.appendSwitch('remote-debugging-port', '9223')`. All renderer debug configurations attach to that port.

### Workspace-level (`.vscode/`) — primary configs

- **`launch.json`** defines:
  - `Electron Main` — builds the main process (`predebug:electron` pre-task), then launches `dist/main/main.js` via Electron with `--serve` (loads from `localhost:4200`).
  - `Attach to Electron Renderer` — starts the Angular dev server (`predebug:angular` pre-task), then attaches Chrome to port `9223`. Runs `stop angular` on exit.
  - **Compound `Debug Full App`** — launches both simultaneously with `stopAll: true`. Note: both start in parallel, so Electron may attempt to load `localhost:4200` before Angular's dev server is ready — a manual reload in the app window resolves this.
- **`tasks.json`** defines:
  - `npm: predebug:angular` — background task running `ng serve -c development`, with a problem matcher waiting for `bundle generation complete`.
  - `stop angular` — runs `npx kill-port 4200` to release the port after a debug session.

### Renderer-level (`angular/.vscode/`)

- `launch.json` provides `ng serve electron` (Chrome attach on `9223`, starts `npm start` as pre-task) and `ng serve chrome` (launches Chrome on `9222` against `localhost:4200`). The former requires Electron to already be running with remote debugging enabled.
- `tasks.json` mirrors the background `npm: start` task and the `stop angular` cleanup.

### Backend-level (`electron/.vscode/`)

- `launch.json` provides `Electron Serve` (`--serve`, loads from dev server) and `Electron Local` (`--local`, loads from `dist/renderer`). Both build the main process first (`npm: build` pre-task) and point to `dist/main/main.js`.
- `tasks.json` is a placeholder.

---

## Build and packaging

`electron-builder.yml` packages from the project root:

- App ID: `com.example.fromscratch`.
- Product name: `from-scratch-electron-angular`.
- ASAR enabled.
- Includes `dist/main/**`, `dist/renderer/**`, `package.json`, and `node_modules/**`.
- Output: `dist/build/`.
- Windows targets: NSIS installer + ZIP.

Run a local production build with:

```bash
npm run compile-and-build
```

CI does this automatically on every push to `main` and attaches the output to a GitHub Release.

---

## Conventions and gotchas

- **`better-sqlite3` is a native module.** It must be rebuilt against Electron's Node ABI after any `npm install` or Electron version bump: `npx @electron/rebuild --force`. The build workflow does this automatically; locally, do it manually.
- **`better-sqlite3` is also pinned at the root** (not just in `electron/`). This is intentional — `@electron/rebuild` is run from the root and needs to find the module in the root `node_modules/`.
- **Standalone components only.** No `NgModule` declarations.
- **Tests are co-located in Angular, mirrored in Electron.** Don't mix conventions — it's the established split per ecosystem.
- **`@testing-library/angular` is currently unused** but kept in devDependencies for future test utilities.
- **The IPC `Channels` constants are the only place channel names are typed as strings.** Always import from `electron/ipc/channels.ts` instead of repeating the literal anywhere.

---

## Future concerns

Things that are not a problem today but are worth keeping in mind as the project grows.

### Multiple windows

The app currently creates a single `BrowserWindow` inline in `main.ts`. If a second window is ever needed (a settings panel, a tray popup, a splash screen, etc.), `createWindow` should be extracted into an `electron/window/` folder, with one file per window — e.g. `window/mainWindow.ts`, `window/settingsWindow.ts` — each exporting a typed `create*` function. Each window runs its own renderer process and communicates back through IPC in the same way as the main window.

### Database schema migrations

`DatabaseService.migrate()` is called once on app start. It creates all tables idempotently (`CREATE TABLE IF NOT EXISTS`), reads `schema_version` from the `meta` table, and runs only the migration blocks whose number is higher than the stored version. To add a schema change: bump `SCHEMA_VERSION`, add an `if (current < N)` block with the DDL, and write the new version to `meta`. Never modify existing migration blocks — they have already run on live databases.

---

## Known issues

### `npm ci --prefix angular` fails in Linux CI

**Symptom:** All three workflows fail with:

```
npm error `npm ci` can only install packages when your package.json and package-lock.json are in sync.
npm error Missing: @emnapi/core@1.10.0 from lock file
npm error Missing: @emnapi/runtime@1.10.0 from lock file
```

**Cause:** Vitest uses Rollup internally, and Rollup ships platform-specific native binaries as optional dependencies (`@rollup/rollup-win32-x64-msvc` on Windows, `@rollup/rollup-linux-x64-gnu` on Linux). The Linux binary has its own transitive dependencies (`@emnapi/core`, `@emnapi/runtime`) that are absent from a lock file generated on Windows. `npm ci` is strict — it requires every package that will be installed to already be present in the lock file, so it hard-fails on Linux. There is no npm flag to generate a cross-platform lock file from Windows, and regenerating locally produces no changes because the Windows resolution is self-consistent.

**Solution:** All three workflows use `npm install` instead of `npm ci` for the Angular step. `npm install` resolves and fetches missing platform packages on the fly without requiring them to be pre-registered in the lock file.

If the project is ever developed on Linux, the lock file generated there would naturally include the Linux platform packages, and `npm ci` could be used safely on both platforms.
