# Angular + Electron + SQLite Template

Template funcional de punto de partida para proyectos desktop con Angular como renderer, Electron como main process, y SQLite como base de datos local. Incluye lógica mínima de ejemplo (operaciones matemáticas y contador de palabras) que demuestra la comunicación frontend↔backend y la persistencia en base de datos.

---

## Arquitectura general

El proyecto sigue una estructura de **tres mini-proyectos**: un proyecto padre que orquesta dos hijos.

```
from-scratch-angular-electron/
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
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── models/
│   │   │   └── services/
│   │   │       ├── electron.service.ts       # Wrapper RxJS sobre la IPC API
│   │   │       └── electron.service.spec.ts
│   │   ├── features/
│   │   │   ├── operations/
│   │   │   │   ├── operations.component.ts
│   │   │   │   ├── operations.component.html
│   │   │   │   ├── operations.component.scss
│   │   │   │   └── operations.component.spec.ts
│   │   │   └── sentences/
│   │   │       ├── sentences.component.ts
│   │   │       ├── sentences.component.html
│   │   │       ├── sentences.component.scss
│   │   │       └── sentences.component.spec.ts
│   │   ├── services/                         # Reservado para servicios comunes futuros
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   ├── directives/
│   │   │   └── pipes/
│   │   ├── app.component.*
│   │   └── app.component.spec.ts
│   ├── testing/
│   │   └── mock-electron.service.ts          # Fixture compartido entre tests
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
│   ├── api.handler.ts
│   ├── operations.handler.ts
│   └── sentences.handler.ts
├── services/
│   ├── database.service.ts               # SQLite con better-sqlite3
│   ├── operations.service.ts
│   ├── sentences.service.ts
│   └── api.service.ts
├── main.ts                               # Entry point del main process
├── preload.ts                            # Expone la API al renderer vía contextBridge
├── esbuild.config.mjs                    # Config de bundling (main + preload → dist/main/)
├── tsconfig.json                         # Solo type-check (noEmit: true)
└── package.json
```

El output de esbuild va a `dist/main/` (dos archivos: `main.js` y `preload.js`).

### `shared/` — Tipos compartidos

```
shared/
├── types.ts       # operation, sentence, operator
└── interfaces.ts  # api, ops, sents (contratos de la IPC API)
```

Importado tanto por el frontend (`electron.service.ts`) como por el backend (`database.service.ts`, handlers).

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
window.api / window.ops / window.sents  (contextBridge)
    ↓
ipcRenderer.invoke(Channels.X)
    ↓
ipcMain.handle(Channels.X)  →  Handler (electron/ipc/)
    ↓
Service (electron/services/)
    ↓
DatabaseService / lógica de negocio
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
| Tests backend      | Jest + ts-jest                         | 29.x    |
| Tests E2E          | Playwright                             | 1.x     |
| Linter             | ESLint (flat config)                   | 10.x    |
| Formatter          | Prettier                               | 3.x     |

---

## Historial de cambios

### 30/04/2026

**Punto de partida:** template funcional pero con estructura desorganizada (outputs mezclados con fuentes, sin separación de responsabilidades, naming inconsistente).

**Restructuración del proyecto:**

- `common/` renombrado a `shared/`
- Servicios de electron renombrados a kebab-case
- Componentes Angular movidos a `features/`, `ElectronService` a `core/services/`
- Toda la salida de compilación consolidada en `dist/` (antes dispersa en `electron/target/`)
- Handlers IPC extraídos de `main.ts` a `electron/ipc/` con constantes de canal en `channels.ts`

**Bundler:**

- Añadido esbuild como bundler para el main process de Electron
- `tsc` conservado únicamente para type-checking (`noEmit: true`)
- tsconfig de electron limpiado (eliminadas opciones de emisión)

**Testing:**

- Vitest (v3) + `@analogjs/vite-plugin-angular` como test runner del frontend, sustituyendo Karma/Jasmine
- Jest + `ts-jest` configurado como test runner del backend (Electron)
- Playwright instalado para tests E2E (scripts en raíz, tests pendientes)
- Tests de Angular ubicados según el patrón de co-localización (`.spec.ts` junto al fuente, convención Angular)
- Fixture compartida de test en `src/testing/mock-electron.service.ts`
- Tests de electron en la carpeta /electron/**tests**, vacía por ahora (tests pendientes).

**Calidad de código:**

- Prettier configurado en raíz (`.prettierrc`, `.prettierignore`), con scripts `format` y `format:check`
- ESLint con flat config (`eslint.config.mjs`): cubre Angular (TS + HTML), Electron y shared con reglas recomendadas de `typescript-eslint` y `angular-eslint`, integrado con Prettier via `eslint-config-prettier`

---

### 01/05/2026

**Calidad de código:**

- Corregidas las violaciones de ESLint existentes; las no corregibles suprimidas puntualmente con `eslint-disable`
- Corregidos naming y tipado en `shared/`: interfaces renombradas a PascalCase (`Api`, `Ops`, `Sents`), parámetro `op` tipado como `Operator` en lugar de `string`
- Corregidas configuraciones de debug de VSCode: rutas a los binarios de Electron actualizadas a `dist/main/main.js` (antes apuntaban a la ruta antigua `electron/target/electron/`)

**Testing:**

- Escritos los primeros tests de Electron con Jest: `electron/__tests__/services/api.service.test.ts` (básico, sin mocks) y `electron/__tests__/services/operations.service.test.ts` (con mock de `DatabaseService` vía `jest.mock()`)
- Escritos tests E2E con Playwright: `e2e/tests/smoke.spec.ts` (verifica título, `app-root`, y navegación principal) y `e2e/tests/basic-interaction.spec.ts` (navega a las features)
- Confirmado el correcto funcionamiento de Jest y Playwright; corregidos errores de configuración detectados durante la puesta en marcha

**CI/CD:**

- Implementados tres workflows de GitHub Actions:
  - `on_commit_lint_test_update_patch.yml` — tests unitarios (Angular + Electron) en cada push a ramas no-main
  - `on_pr_e2e_update_minor.yml` — E2E + ESLint + bump minor en cada PR a main
  - `on_push_main_from_feature_build.yml` — compilación, empaquetado Windows (electron-builder) y publicación de GitHub Release en cada push a main
- Implementado pre-commit hook con Husky: ejecuta tests unitarios y hace bump de patch en cada commit local; el bump queda incluido en el propio commit, sin commits extra de "chore: bump version"

**Documentación:**

- Redactado `README.md` con estructura del proyecto, stack tecnológico, testing, QA, workflows, scripts, debugging e IPC

---

### 02/05/2026

**CI/CD:**

- Verificando el correcto funcionamiento de los workflows se ha encontrado un problema: al hacer `npm ci --prefix angular` los workflows fallan porque se ejecutan en una máquina Linux. El error lo causa Vitest, que tiene dependencias de plataforma distintas en Linux y en Windows (`@rollup/rollup-linux-x64-gnu` y sus transitivas `@emnapi/core`, `@emnapi/runtime`), y no hay manera de incluirlas todas en el lock file generando desde Windows. El error se ha resuelto usando `npm install` en lugar de `npm ci` en ese paso en los tres workflows, aunque esto elimina la verificación estricta de consistencia del lock file que ofrecía `npm ci`.
- Tras la corrección, confirmado el correcto funcionamiento de los tres workflows en el repositorio remoto.

**Base de datos:**

- Añadida lógica de migraciones en `DatabaseService`: `createTables()` renombrado a `migrate()`, que ahora lee la versión actual del schema desde la tabla `meta` y aplica únicamente los bloques de migración pendientes. La estructura queda lista para incorporar migraciones futuras sin tocar el código existente.

---

## Pasos siguientes

El template está completo. El siguiente paso natural es **hacer un fork del repositorio y utilizarlo como base para un proyecto real**.
