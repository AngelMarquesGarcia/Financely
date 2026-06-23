IMPORTANT NOTES:

- this file holds an informal change history for the project, and as such, it should NOT to be deleted, under any circumstances
- Additionally, the change history itself must be append only. New entries can be added freely, but existing entries MUST NOT be changed.
- There is a section at the end considering next steps. This section can be freely modified.

Less important notes:

- The dates are orientative. Originally, the date specified was the date when the changes were implemented, however, updating the history every day changes are made was never gonna happen. Instead, the date on an entry describes the changes and decisions that have been made since the last entry. It might include multiple disconnected functionalities/decisions/components, since there's no guarantee changes will be recorded as soon as they happen.
- The goal of the document is to provide a sort of overview on how exactly the project has been developed, so that it may be more easily accessed later to write documentation.

# Historial de cambios

## 30/04/2026

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

## 01/05/2026

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

## 02/05/2026

**CI/CD:**

- Verificando el correcto funcionamiento de los workflows se ha encontrado un problema: al hacer `npm ci --prefix angular` los workflows fallan porque se ejecutan en una máquina Linux. El error lo causa Vitest, que tiene dependencias de plataforma distintas en Linux y en Windows (`@rollup/rollup-linux-x64-gnu` y sus transitivas `@emnapi/core`, `@emnapi/runtime`), y no hay manera de incluirlas todas en el lock file generando desde Windows. El error se ha resuelto usando `npm install` en lugar de `npm ci` en ese paso en los tres workflows, aunque esto elimina la verificación estricta de consistencia del lock file que ofrecía `npm ci`.
- Tras la corrección, confirmado el correcto funcionamiento de los tres workflows en el repositorio remoto.

**Base de datos:**

- Añadida lógica de migraciones en `DatabaseService`: `createTables()` renombrado a `migrate()`, que ahora lee la versión actual del schema desde la tabla `meta` y aplica únicamente los bloques de migración pendientes. La estructura queda lista para incorporar migraciones futuras sin tocar el código existente.

---

## 14/05/2026

**Auditoría general:**

- Realizada una auditoría comprensiva del proyecto cubriendo: errores, malas prácticas, código muerto, inconsistencias, redundancia y huecos funcionales respecto al plan de desarrollo del vault. Hallazgos clasificados por severidad (Critical/High/Medium/Low).
- Plan de actuación detallado en [`reflective-dancing-fiddle.md`](C:/Users/burak/.claude/plans/reflective-dancing-fiddle.md). Se ejecutarán primero **Phase 5** (limpieza ligera) y **Phase 1** (correctness crítica: cascadas, defaults, dinero en céntimos, conversión de fechas en el repositorio); a continuación **Phase 2** (UX de confirmación/error/loading, lifecycle de subscripciones, validadores backend).
- Hallazgos diferidos y recomendaciones fuera de alcance se han añadido a la sección "Pasos siguientes" arriba.

**Phase 5 (limpieza ligera) — completada:**

- Eliminado `e2e/tests/basic-interaction.spec.ts` (referenciaba features ya borradas).
- Eliminados tests obsoletos en `electron/__tests__/` (`database.service.test.ts`, `category.repository.test.ts`, `movement.repository.test.ts`, `category.service.test.ts`, `movement.service.test.ts`) que aún hacían referencia al esquema antiguo (`quantity` sin sufijo, `Movement` sin `name`, etc.). Habrá que reescribirlos en una iteración posterior.
- Añadida la flag `passWithNoTests: true` a [`electron/jest.config.js`](electron/jest.config.js) para que la suite Jest no rompa CI hasta que se reescriban los tests.

**Phase 1 (correctness crítica) — completada salvo los lock-in tests:**

- **Schema** ([electron/repository/schema.ts](electron/repository/schema.ts)):
  - Renombrada la columna `quantity` → `quantity_cents` en `movements`.
  - Añadida columna `is_default` a `categories`.
  - Cambiado `envelopes.account_id` a `ON DELETE CASCADE` (antes `SET NULL`).
  - Añadido `ON DELETE CASCADE` a `movements.envelope_id`.
  - El borrado de cuenta arrastra ahora envelopes → movements → movement_tags por cascada FK.
- **Migración** ([electron/repository/database.service.ts](electron/repository/database.service.ts)):
  - Añadidos tres índices únicos parciales que garantizan a nivel de DB la unicidad de `is_default = 1`: `uq_account_default` (global), `uq_envelope_default` (por cuenta), `uq_category_default` (global).
  - Seed: la categoría `Salary` se marca como default en `initDatabase()` para que `reassign-on-delete` funcione out-of-the-box.
  - Valores de seed de movimientos multiplicados por 100 para reflejar céntimos reales (€2200 → 220000).
- **Política de borrado** (implementada en los servicios):
  - `deleteAccount` ([electron/services/account.service.ts](electron/services/account.service.ts)): rechaza si `isDefault`; el resto cascada por FK.
  - `deleteEnvelope` ([electron/services/envelope.service.ts](electron/services/envelope.service.ts)): rechaza si `isDefault`; si no, reasigna sus movimientos al envelope por defecto de la misma cuenta y luego elimina, todo en una transacción.
  - `deleteCategory` ([electron/services/category.service.ts](electron/services/category.service.ts)): rechaza si `isDefault` o si no hay default global definido; si no, reasigna sus movimientos a la categoría por defecto y luego elimina, transaccional.
- **Auto-creación del envelope por defecto al crear cuenta**: `createAccount` ahora envuelve en `db.transaction` la inserción de la cuenta, la creación del envelope homónimo, y la llamada a `setDefaultEnvelope` para marcarlo.
- **`setDefault*` methods**:
  - Añadidos `setDefaultAccount`, `setDefaultEnvelope`, `setDefaultCategory` en sus respectivos repositorios y servicios, todos en transacción para limpiar el default anterior antes de marcar el nuevo (compatibilidad con el índice único parcial).
  - Expuestos vía IPC: nuevos canales `ACCOUNT_SET_DEFAULT`, `ENVELOPE_SET_DEFAULT`, `CATEGORY_SET_DEFAULT` en [electron/ipc/channels.ts](electron/ipc/channels.ts); handlers actualizados; expuestos vía `preload.ts`; añadidos en interfaces compartidas y en `ElectronService`.
  - UI: botón "Set default" + chip badge "default" en las tres listas (accounts, envelopes, categories), wireado a sus contenedores.
- **Money en céntimos**:
  - Movement.quantity → `Movement.quantityCents` en [shared/types.ts](shared/types.ts).
  - Repositorio actualizado para usar `quantity_cents` en todas las queries.
  - Nuevo pipe `MoneyPipe` en [angular/src/app/shared/pipes/money.pipe.ts](angular/src/app/shared/pipes/money.pipe.ts).
  - Nuevas utilidades genéricas en [angular/src/app/shared/utils.ts](angular/src/app/shared/utils.ts): `parseMoney(input)` y `formatCents(cents)`.
  - Formulario de movimiento: el campo amount es ahora un texto decimal (`"22.50"`), se parsea a céntimos al guardar y se formatea al cargar.
  - Lista de movimientos: muestra el importe con el pipe (`22.50 €`). El filtro min/max acepta decimales y los convierte a céntimos.
- **Date en el repositorio**: `Movement.date` permanece `Date` en TypeScript; la conversión Date ↔ ISO `YYYY-MM-DD` se hace en el repositorio (`dateToISO` y `isoToDate`, con manejo timezone-stable usando componentes locales). Eliminado el cast `as any` del formulario.
- **Validadores backend** en [electron/services/movement.service.ts](electron/services/movement.service.ts): rechaza `quantityCents` no-entero o negativo, fechas inválidas, ids no positivos.

**Phase 2 (UX correctness & integrity) — completada:**

- **Notification substrate** ([angular/src/app/core/services/notification.service.ts](angular/src/app/core/services/notification.service.ts) y [shared/components/toast-host/](angular/src/app/shared/components/toast-host/)): servicio basado en signals con cola de toasts, host renderizado una sola vez en `app.component.html`, auto-dismiss tras 5s, variantes `success` / `error` / `info`.
- **Confirm substrate** ([angular/src/app/core/services/confirm.service.ts](angular/src/app/core/services/confirm.service.ts) y [shared/components/confirm-dialog/](angular/src/app/shared/components/confirm-dialog/)): modal con overlay, soporte ESC para cancelar, variantes `danger` para acciones destructivas, API `confirm({ title, message, danger?, confirmLabel? }): Observable<boolean>`.
- **Confirms en todos los borrados**: accounts, envelopes, categories, movements, tags. Mensajes específicos por entidad explicando la consecuencia (cascada, reasignación, etc.). Se sustituye el `confirm()` nativo del navegador en [movement-form.component.ts](angular/src/app/features/movements/movement-form/movement-form.component.ts) (creación de categoría desconocida) por el servicio compartido.
- **Manejo de errores**: cada `.subscribe(...)` en contenedores y formularios añade `error: (e) => notify.error(e.message)`. Los errores del backend (validadores de Phase 1, FK violations, mensajes de "default no se puede borrar") ahora se ven como toasts en lugar de fallar en silencio.
- **Subscription lifecycle**: `inject(DestroyRef)` + `.pipe(takeUntilDestroyed(this.destroyRef))` en todos los contenedores (`accounts.component.ts`, `envelopes.component.ts`, `categories.component.ts`, `movements.component.ts`, `tags.component.ts`, `tags-list.component.ts`) y en `movement-form.component.ts` para evitar fugas de memoria al navegar entre páginas.
- **Loading states**: diferido — la API queda lista (los servicios reportan éxito/error) pero no se ha añadido la señal `loading` ni el bind a `[disabled]`. No es bloqueante para la corrección.

**Lock-in tests — escritos y pasando:**

- [electron/**tests**/services/category.service.test.ts](electron/__tests__/services/category.service.test.ts): valida que `deleteCategory` (a) rechaza si no hay default, (b) rechaza si el target es default, (c) reasigna movimientos al default y elimina; y que `setDefaultCategory` limpia el default previo respetando el índice único parcial.
- [electron/**tests**/services/envelope.service.test.ts](electron/__tests__/services/envelope.service.test.ts): valida que `deleteEnvelope` rechaza el default, reasigna movimientos al default de la cuenta y elimina; que `setDefaultEnvelope` mantiene la unicidad por cuenta; que `createAccount` crea automáticamente el envelope por defecto.
- Ambos tests son **integration tests** (real `better-sqlite3` con `:memory:`-equivalente en tmpdir, `migrate()` entre tests) — `jest.unmock('better-sqlite3')` localmente para evitar el mock global de `jest.setup.ts`.
- Resultado: **8/8 tests pasan**.

**Verificación final:** `npm run compile` (Angular + Electron) limpio. `npm --prefix electron test` ejecuta los 8 lock-in tests en verde. No se ha hecho smoke-test manual de la app por límite de tokens.

---

## 18/05/2026

**Deferred-audit cleanup (Sections 1–4):**

- **Documentación actualizada**: árboles de archivos de `angular/`, `electron/` y `shared/`, flujo IPC y bloque de testing en `CLAUDE.md` y `README.md` corregidos para reflejar la estructura real (eliminadas referencias a `operations/`, `sentences/`, `api.handler`, `api.service`, `ops`, `sents`).
- **Ruta por defecto**: añadidos `{ path: '', redirectTo: 'movements', pathMatch: 'full' }` y `{ path: '**', redirectTo: 'movements' }` en `app.routes.ts`. Navegar a `/` o a una ruta desconocida redirige ahora a Movements.
- **Columna Envelope en movimientos**: añadida columna "Envelope" al listado de movimientos mostrando el nombre del envelope (el `@Input() envelopes` ya llegaba al componente pero no se usaba en la tabla).
- **Página de Settings**: nuevo `SettingsComponent` en `features/settings/` con ruta `/settings` y enlace en la barra de navegación. Contiene los controles de fecha por defecto antes ocultos en el modal "Date Settings" de Movements. El componente `date-settings` y toda la lógica de settings se han eliminado de `MovementsComponent`. `MovementFormComponent` carga ahora sus propios settings en `ngOnInit` y el gear icon navega a `/settings`.

**Deferred-audit cleanup (Sections 5–8):**

- **Códigos de error backend** ([shared/error-codes.ts](shared/error-codes.ts)): `AppErrorCode` const + `AppError extends Error` (message === code para supervivencia en IPC). Todos los `throw new Error('...')` de los seis servicios backend y el repositorio de envelopes reemplazados por `throw new AppError(AppErrorCode.X)`. Wrapper `ipcHandle()` en [electron/ipc/ipc-utils.ts](electron/ipc/ipc-utils.ts) normaliza errores nativos de SQLite a `CONSTRAINT_VIOLATION` y el resto a `UNKNOWN`. Frontend: `ErrorTextService` en [angular/src/app/core/services/error-text.service.ts](angular/src/app/core/services/error-text.service.ts) resuelve cada código a texto en inglés — seam para i18n. Todos los `notify.error(e.message)` reemplazados por `notify.error(this.errorText.resolve(e.message))`.
- **Diseño tokens + SCSS global** ([angular/src/styles.scss](angular/src/styles.scss)): bloque `:root` con variables CSS de color, espaciado, radius, sombras y z-index. Clases globales `.card`, `.form` (con subclases), `.btn` (todas las variantes), `.table-wrapper` (scope de `table/th/td/tr`), `.empty`, `.actions`, `.default-badge`. Bloques duplicados eliminados de los 5 feature SCSS y de `confirm-dialog.component.scss`. `<div class="table-wrapper">` añadido en los templates que tenían `<table>` desnuda.
- **Componentes compartidos** (`angular/src/app/shared/components/`): `EmptyStateComponent` (reemplaza los cinco `<p class="empty">` en listas), `ModalComponent` (overlay + ESC + backdrop, adoptado en el edit-modal de Movements), `ButtonComponent` (wrapper de `.btn` con `variant`/`type`/`disabled`).
- **Cobertura de tests**: backend Jest — 38 tests en 6 suites: `movement.service.test.ts` (validación + CRUD + filtros), `account.service.test.ts` (auto-envelope, ACCOUNT_DELETE_DEFAULT, cascada), `tag.service.test.ts` (CRUD, idempotencia, junction), `settings.service.test.ts` (defaults, merge parcial, sobrescritura) + los 2 lock-in tests previos actualizados a `AppErrorCode`. Frontend Vitest — 46 tests en 9 suites: `money.pipe.spec.ts`, `utils.spec.ts`, `error-text.service.spec.ts`, `empty-state.component.spec.ts`, `button.component.spec.ts`, `modal.component.spec.ts`, `movements-list.component.spec.ts` (columna Envelope, signedCents, contrastColor), `electron.service.spec.ts`, `app.component.spec.ts`. E2E Playwright: `smoke.spec.ts` (título corregido a "Financely"), `smoke-crud.spec.ts` (redirect `/`→`/movements`, Settings en navbar, crear categoría + movimiento + verificar columna Envelope).

**Verificación:** `npm run compile` limpio. `npm --prefix electron test` → **38/38 verde**. `npm --prefix angular run test:run` → **46/46 verde**.

---

## 18/05/2026 (continuación)

**Auditoría de implementación y correcciones:**

- Detectados y corregidos cuatro gaps respecto al plan: `ModalComponent` sin `@Input() title`, header ni slot `[modalFooter]`; `EmptyStateComponent` sin `@Input() icon?`; `README.md` sin `empty-state/`, `modal/`, `button/` ni `error-codes.ts` en los árboles de archivos; `SettingsComponent` sin spec. Todos corregidos. Tests ampliados: `empty-state.component.spec.ts` → 4 tests (icono); `modal.component.spec.ts` → 10 tests (title, close button, footer slot); `settings.component.spec.ts` añadido (4 tests).

**Gear icon → modal de settings en MovementForm:**

- El icono de engranaje en el formulario de nuevo movimiento antes navegaba a `/settings` via `routerLink`. Ahora abre `SettingsComponent` en un modal sin cambiar la ruta. Al cerrar, el formulario recarga los settings para actualizar la fecha por defecto inmediatamente. El icono se oculta en modo edición (no aplica).

**Infraestructura de modales con Angular CDK (`@angular/cdk` ya presente en el proyecto):**

- **`DialogRef<R>`** ([angular/src/app/core/services/dialog-ref.ts](angular/src/app/core/services/dialog-ref.ts)): wrapper sobre `OverlayRef`; gestiona cierre por ESC y click en backdrop; expone `close(result?)` y `afterClosed(): Observable<R>`.
- **`DIALOG_DATA`** ([angular/src/app/core/services/dialog.tokens.ts](angular/src/app/core/services/dialog.tokens.ts)): `InjectionToken` para pasar datos al componente abierto.
- **`DialogService`** ([angular/src/app/core/services/dialog.service.ts](angular/src/app/core/services/dialog.service.ts)): `open<T, D, R>(component, config)` crea un `OverlayRef` con backdrop (`dialog-backdrop`), `BlockScrollStrategy`, posición centrada, e inyecta `DialogRef` y `DIALOG_DATA` en un injector hijo antes de adjuntar un `ComponentPortal`.
- **`ConfirmService`** migrado ([angular/src/app/core/services/confirm.service.ts](angular/src/app/core/services/confirm.service.ts)): reemplaza el patrón signal+Subject+host estático por `dialog.open(ConfirmDialogComponent, { data: request }).afterClosed()`. El signal `active` y el método `resolve()` eliminados.
- **`ConfirmDialogComponent`** simplificado ([angular/src/app/shared/components/confirm-dialog/](angular/src/app/shared/components/confirm-dialog/)): inyecta `DIALOG_DATA` y `DialogRef`; ya no necesita `ConfirmService` ni `@HostListener`; el template pierde el wrapper `@if` y el div de overlay (CDK los gestiona); el SCSS pierde todo el posicionamiento manual y usa tokens de diseño.
- **`app.component`**: eliminado `<app-confirm-dialog />` (CDK monta el componente dinámicamente en `cdk-overlay-container`).
- **`ModalComponent`** mejorado: añadidos `BlockScrollStrategy` (bloquea scroll de fondo mientras está abierto) y `cdkTrapFocus cdkTrapFocusAutoCapture` en el panel (el foco queda atrapado dentro del modal).
- **Estilos globales** ([angular/src/styles.scss](angular/src/styles.scss)): `.cdk-overlay-container { z-index: var(--z-modal) }` para respetar los tokens de z-index; `.cdk-overlay-backdrop.dialog-backdrop` con animación `overlay-in`.
- **`SettingsComponent`** dialog-aware ([angular/src/app/features/settings/settings.component.ts](angular/src/app/features/settings/settings.component.ts)): inyecta `DialogRef` con `{ optional: true }`; si está en contexto de diálogo, omite el wrapper `.settings-page` y muestra un botón de cierre en el header de la card.

**Verificación:** `npm run compile` limpio. `npm --prefix angular run test:run` → **56/56 verde**.

---

## 19/05/2026

**Componentes compartidos: ChipComponent y PopoverComponent:**

- **`ChipComponent`** ([angular/src/app/shared/components/chip/](angular/src/app/shared/components/chip/)): unifica los patrones `.tag-chip` (tag-picker) y `.cat-chip` (envelope-form). `@Input() variant: 'default'|'removable'|'action'`; `@Input() color?`, `emoji?`, `icon?` (FA `IconDefinition`). La variante `removable` muestra un overlay rojo semitransparente con icono de papelera al hacer hover; la variante `action` usa borde punteado. El host usa `display: inline-flex` para participar correctamente en contenedores flex.
- **`PopoverComponent`** ([angular/src/app/shared/components/popover/](angular/src/app/shared/components/popover/)): unifica el patrón backdrop-fijo + panel-absoluto. `@Input() open`, `align: 'left'|'right'`, `width` (px), `showArrow`. El contenido del trigger se proyecta via `<ng-content select="[popoverTrigger]">`; el cuerpo del panel via `<ng-content>`. El host tiene `position: relative; display: inline-flex` para servir de ancla al posicionamiento absoluto. Reemplaza `.tag-popover*`, `.cat-popover*` y `.filter-backdrop`/`.filter-panel` (posicionamiento) en los tres sitios de uso.
- **Estilos globales**: añadidos `.popover-option`, `.popover-empty` y `.color-dot` en `styles.scss` — aplicables a contenido proyectado dentro del panel (no encapsulado por el componente).
- **Callers refactorizados**: `tag-picker.component.*`, `envelope-form.component.*` y `movements-list.component.*` usan ahora `<app-chip>` y/o `<app-popover>`. SCSS de los tres reducido: eliminados los bloques duplicados de chip/popover/backdrop.

---

## 26/05/2026

Sesión de revisión integral + ejecución de un plan de saneamiento y nuevas extracciones de componentes. El detalle del plan original vive en [`review-the-whole-project-sprightly-map.md`](C:/Users/burak/.claude/plans/review-the-whole-project-sprightly-map.md).

### Cambios confirmados (realizados esta sesión)

**Pass 1 — Higiene:**

- Eliminado el archivo de notas suelto `sortable-lists-info.md` de la raíz.
- Extraídas `DEFAULT_COLOR_ORDER` y `DEFAULT_CATEGORY_ICONS` a [angular/src/app/core/defaults.ts](angular/src/app/core/defaults.ts); `SettingsComponent` y `CategoryFormComponent` consumen ahora la misma fuente.
- `contrastColor()` movido a [angular/src/app/shared/utils.ts](angular/src/app/shared/utils.ts) (junto a `parseMoney` y `formatCents`); las dos copias duplicadas en `category-form` y `movements-list` reemplazadas.
- [angular/src/app/features/movements/movements-list/movements-list.component.scss](angular/src/app/features/movements/movements-list/movements-list.component.scss): todos los hex literales reemplazados por design tokens. Añadidos tokens semánticos en [angular/src/styles.scss](angular/src/styles.scss): `--c-income-bg/-bg-hover/-text`, `--c-expense-bg/-bg-hover/-text`, `--c-primary-bg-soft/-bg-soft-hover/-border-soft`.
- [angular/src/app/shared/components/chip/chip.component.ts](angular/src/app/shared/components/chip/chip.component.ts): inline `host: { style }` movido a `:host { display: inline-flex }` en el SCSS.

**Pass 2 — IPC tipado:**

- Nuevo [angular/src/app/types/global.d.ts](angular/src/app/types/global.d.ts) que aumenta `Window` con las seis interfaces (`Movements`, `Categories`, …) importadas de `@shared/interfaces`.
- Eliminado el bloque `eslint-disable @typescript-eslint/no-explicit-any` y los casts `(window as any)` de [angular/src/app/core/services/electron.service.ts](angular/src/app/core/services/electron.service.ts).

**Pass 3 — Subscriptions y ciclo de vida:**

- [angular/src/app/core/services/dialog-ref.ts](angular/src/app/core/services/dialog-ref.ts): las subscriptions a `backdropClick()` y `keydownEvents()` ahora se pipean con `takeUntil(_afterClosed)` (cerraban implícitamente al `dispose()`, pero ahora se tearen down explícitamente).
- `takeUntilDestroyed(destroyRef)` añadido uniformemente en `account-form`, `envelope-form`, `tag-form` y `category-form` (subscriptions de save y getSettings).

**Pass 4 — Performance y bulk IPCs:**

- Nuevos endpoints IPC (canal + interface + repository + service + handler + preload + ElectronService):
  - `Tags.getForMovements(ids: number[]): Promise<Record<number, Tag[]>>` — fetch de tags en una sola query con `IN (?, ?, …)` y agrupación por movement_id. Elimina el N+1 que tenía `MovementsComponent`.
  - `Movements.deleteMany(ids: number[]): Promise<number>` — borrado bulk en una sola transacción SQLite.
  - `Movements.suggestNames(prefix: string, limit?: number): Promise<string[]>` — sugerencias `DISTINCT … LIKE` para el autocomplete del nombre.
  - `Accounts.getStats(): Promise<AccountStats>` — agregado SUM/COUNT en una sola query.
- Nuevo tipo `AccountStats` en [shared/types.ts](shared/types.ts) (`totalIncomeCents`, `totalExpenseCents`, `balanceCents`, `envelopeCount`).
- Nuevo `AppErrorCode.MOVEMENT_ID_INVALID` en [shared/error-codes.ts](shared/error-codes.ts).
- [angular/src/app/features/movements/movements.component.ts](angular/src/app/features/movements/movements.component.ts): tres `.subscribe()` independientes consolidados en un `forkJoin({categories, envelopes, tags})`; el fetch de tags por movimiento sustituido por el endpoint bulk.

**Pass 5 — Helper de errores:**

- Nuevo [angular/src/app/core/services/error-reporter.service.ts](angular/src/app/core/services/error-reporter.service.ts) con un operador `.toast()` (catch + `ErrorTextService.resolve` + `NotificationService.error` + `EMPTY`). Los cinco containers (`accounts`, `categories`, `envelopes`, `tags`, `movements`) migrados: cada `subscribe({ error: ... })` reemplazado por `.pipe(this.errors.toast())`.

**Pass 6 — Extracción de `MovementsFilterComponent` + bulk delete (§3 #3 del plan):**

- Nuevo [angular/src/app/features/movements/movements-filter/movements-filter.component.{ts,html,scss}](angular/src/app/features/movements/movements-filter/movements-filter.component.ts): dueño de todo el estado de filtro y de la SCSS del panel (que vivía dentro de `movements-list`). Output `(filterChanged)`.
- Selector de categoría en el filtro migrado de match-por-nombre (`<input list>`) a select por id (`<select [ngValue]>`).
- [angular/src/app/features/movements/movements-list/movements-list.component.ts](angular/src/app/features/movements/movements-list/movements-list.component.ts): columna `ID` reemplazada por columna de **checkbox**. Checkbox de header con estado indeterminate. Botón "Delete selected (N)" en el header cuando hay selección. Output `(bulkDeleteRequested)` cableado al servicio bulk en el container.

**Pass 7 — Documentación de los dos abstractions de modal:**

- Comentarios de cabecera añadidos a [angular/src/app/shared/components/modal/modal.component.ts](angular/src/app/shared/components/modal/modal.component.ts) (declarativo, para componentes "ventana") y [angular/src/app/core/services/dialog.service.ts](angular/src/app/core/services/dialog.service.ts) (imperativo, para confirms/alerts/dialogs cortos) explicando cuándo usar cada uno. Decisión de consolidar diferida hasta tener más datos de uso.

**Pass 8 — Nuevos componentes compartidos:**

- [angular/src/app/shared/components/amount-input/](angular/src/app/shared/components/amount-input/) — input de dinero. Texto decimal ↔ céntimos enteros, reformatea en blur. Adoptado en `MovementFormComponent` (campo amount) y en `MovementsFilterComponent` (min/max).
- [angular/src/app/shared/components/entity-select/](angular/src/app/shared/components/entity-select/) — picker multi-select genérico con chips + popover. Inputs: `items`, `selectedIds`, `labelFn`, `colorFn?`, `emojiFn?`, `availableFilter?`. Adoptado en `EnvelopeFormComponent` (picker de categorías); `TagPickerComponent` refactorizado para envolverlo y mantener el flujo de "crear nuevo tag".
- [angular/src/app/shared/components/stat-card/](angular/src/app/shared/components/stat-card/) — tile pequeño: title + valor grande + sublabel/icon opcionales. Tonos `neutral` / `positive` / `negative`. Aplicado en la página de Accounts como tira de cuatro tarjetas (total income, total expense, current balance, envelope count). Clase global `.stats-strip` añadida en `styles.scss` para el layout horizontal.
- [angular/src/app/shared/components/form-field/](angular/src/app/shared/components/form-field/) — wrapper de campo de formulario: label + slot proyectado + mensaje de error opcional. Inputs: `label`, `forId?`, `error?`, `optional?`, `full?`. Adoptado en `AccountFormComponent` como demostración; el resto de formularios puede adoptarlo incrementalmente.
- [angular/src/app/shared/components/autocomplete-input/](angular/src/app/shared/components/autocomplete-input/) — input con dropdown asíncrono de sugerencias. Inputs: `value`, `suggestFn`, `minLength`, `maxSuggestions`, `debounceMs`. Navegación con ↑/↓, Enter para aceptar, Esc para cerrar, dismiss en click fuera. Adoptado en el campo "Name" del `MovementFormComponent` (suggestions vía `suggestMovementNames`).
- [angular/src/app/shared/components/quick-create-movement-button/](angular/src/app/shared/components/quick-create-movement-button/) — botón que abre `MovementFormComponent` en un diálogo (vía `DialogService`). Configurable con `label`, `buttonClass`, `icon`. Emite `(created)` al cerrar. `MovementFormComponent` se hizo dialog-aware (inyecta `DialogRef` opcional y se cierra solo en save/cancel cuando opera dentro de un dialog).
- Botón quick-create añadido a [angular/src/app/shared/components/navbar/](angular/src/app/shared/components/navbar/) y al empty-state de `MovementsListComponent`.
- **Diferidos** (sin sitio claro de adopción hoy): `PageHeaderComponent` (las páginas no tienen `h1`), `DataTableComponent` (los listados pueden cambiar todavía), `FilterPanelComponent` (un único consumidor).

**§3 #4 — Empty-state CTAs:**

- [angular/src/app/shared/components/empty-state/](angular/src/app/shared/components/empty-state/) ahora proyecta `<ng-content>` para CTAs.
- Los cinco listados de entidades (`accounts-list`, `categories-list`, `envelopes-list`, `tags-list`, `movements-list`) reciben un icono emoji y un mensaje más útil. El empty state de `movements-list` incluye el botón quick-create.

**Pass 9 — Tests estructurales:**

- Nuevos specs: [dialog-ref.spec.ts](angular/src/app/core/services/dialog-ref.spec.ts), [error-reporter.service.spec.ts](angular/src/app/core/services/error-reporter.service.spec.ts), [amount-input.component.spec.ts](angular/src/app/shared/components/amount-input/amount-input.component.spec.ts), [stat-card.component.spec.ts](angular/src/app/shared/components/stat-card/stat-card.component.spec.ts), [form-field.component.spec.ts](angular/src/app/shared/components/form-field/form-field.component.spec.ts).
- Backend extendido: `getAccountStats`, `deleteManyMovements`, `suggestMovementNames`, `getTagsForMovements`.

**Verificación:** `npm run compile` (Angular + Electron) limpio. Vitest **72/72** verde. Jest **46/46** verde. `npm run lint` reporta errores **preexistentes** en `confirm-dialog`, `modal` y `mock-electron` que no se tocaron en esta sesión. No se hizo smoke-test manual de la app por límite de tokens; queda pendiente del usuario.

### Otros cambios realizados desde la última entrada

- [angular/src/app/shared/components/color-swatches/](angular/src/app/shared/components/color-swatches/) — picker de paleta de colores con reorder/add/delete. Usado por `SettingsComponent` y `CategoryFormComponent`.
- [angular/src/app/shared/components/icon-picker/](angular/src/app/shared/components/icon-picker/) — picker de emoji con reorder/add/delete. Usado por `SettingsComponent` y `CategoryFormComponent`.
- [angular/src/app/shared/directives/sortable.directive.ts](angular/src/app/shared/directives/sortable.directive.ts) — wrapper Angular sobre SortableJS para drag-and-drop. El antiguo `sortable-lists-info.md` (eliminado en esta sesión) era el spec para esta migración. Usado por los dos pickers de arriba.
- [angular/src/app/features/movements/movement-list-compact/](angular/src/app/features/movements/movement-list-compact/) — variante compacta del listado de movimientos, renderizada en `MovementsComponent` bajo "Compact view".
- [angular/src/app/features/movements/movement-detail-dialog/](angular/src/app/features/movements/movement-detail-dialog/) — diálogo de detalle de movimiento. No verificado de dónde se abre.
- Dependencia `sortablejs` (+ `@types/sortablejs`) añadida al `package.json` de angular (consecuencia de `SortableDirective`).
- Iconos FontAwesome (`@fortawesome/angular-fontawesome`, `@fortawesome/free-solid-svg-icons`) — usados ampliamente; añadidos en algún punto previo a esta sesión.

---

## En progreso (junio 2026)

### PeriodSummary — implementación inicial

Primer paso del dashboard de resumen mensual. Los tipos están definidos; la lógica del servicio está siendo escrita manualmente por el usuario.

**Archivos nuevos:**

- [electron/constants.ts](electron/constants.ts): centraliza los nombres de tabla en un objeto `tables` (antes estaban inline en cada repositorio).
- [shared/types.ts](shared/types.ts): añadidos `Period` (accountId + envelopeId + year + month), `BasicSummary` (cash flow, totales, medias, count de movimientos), y `PeriodSummary` (snapshot mensual completo: campos de BasicSummary + endingBalanceCents, availableBudgetCents, notes, isDirty).
- [electron/repository/period-summary-repository.service.ts](electron/repository/period-summary-repository.service.ts): CRUD + `getByPeriod`.
- [electron/services/period-summary.service.ts](electron/services/period-summary.service.ts): creación, recalculación y propagación del flag `isDirty` a lo largo de la cadena de periodos.
- [electron/ipc/period-summaries.handler.ts](electron/ipc/period-summaries.handler.ts): handlers IPC (pendiente de registrar en `main.ts` y exponer en `preload.ts`).
- `angular/src/app/features/month-overview/`: componente de vista mensual.
- `angular/src/app/shared/components/period-summary-card/`: tarjeta de visualización de un PeriodSummary.
- `angular/src/testing/sample-summaries.ts`: fixtures de test.

**Diseño del ending balance:** los PeriodSummaries forman una cadena mensual por (account, envelope). `ending_balance(P) = ending_balance(P-1) + cashFlow(P)`. El primer periodo se ancla en `startingBalance` de la cuenta o del envelope. Ediciones en periodos pasados marcan `isDirty = true` en ese periodo y en todos los posteriores; el getter recalcula lazily desde el periodo dirtied más antiguo hacia adelante.

### Cambios próximos planificados

- **Eliminar `id` de `PeriodSummary`**: usar los cuatro campos de `Period` (accountId, envelopeId, year, month) como clave primaria compuesta en lugar de un `id` autoincremental. Requiere:
  - Cambiar el `UPDATE` y `DELETE` del repositorio para usar `Period` en lugar de `id`.
  - Añadir dos índices `UNIQUE` parciales en el schema: uno para filas con `envelope_id IS NOT NULL` y otro `WHERE envelope_id IS NULL` para filas de nivel de cuenta (SQLite trata los `NULL` como distintos en constraints `UNIQUE` normales, por lo que se necesita el mismo patrón de índice parcial que ya usan los defaults de `is_default`).
  - Eliminar el campo `id` de la interfaz `PeriodSummary` en `shared/types.ts` y actualizar todos los callers.

- **Cambio de `type` a `class`**: reemplazar los tipos planos de `shared/types.ts` por clases TypeScript con métodos de dominio (e.g. `Period.previous()`, `Period.next()`). TypeScript no impone un archivo por clase — múltiples clases pueden exportarse desde un mismo `.ts`. La transición requerirá actualizar las deserializaciones en los repositorios (ya que `better-sqlite3` devuelve plain objects que habrá que mapear a instancias de clase).

---

## junio 2026 (continuación)

### Completado de la capa PeriodSummary; incorporación de `startingBalance` y `accountId`

**Capa IPC de PeriodSummary — completada y corregida:**

- `isDirty: boolean` reemplazado por `dirtyState: DirtyState` (`'CLEAN' | 'MODIFIED' | 'DIRTY'`) en `shared/types.ts`, schema, repositorio y servicio. La distinción permite separar "recalcular agregados desde movimientos" (MODIFIED) de "solo actualizar endingBalance en la cadena" (DIRTY), lo que hace posible la evaluación lazy correcta cuando varios periodos están sucios.
- Convención de mes: `month` se almacena como `0–11` (igual que `Date.getMonth()`), no `1–12`. Constraint de schema actualizado a `CHECK(month >= 0 AND month <= 11)`. En frontend, el +1 solo se aplica al renderizar.
- `getMovementsByPeriod` completado en el repositorio: usa `CAST(strftime('%m', date) AS INTEGER) - 1` para comparar meses 0-indexados contra fechas ISO almacenadas como texto.
- Corregido el método `delete` del repositorio: nombres de columna erróneos (`accountId`/`envelopeId` → `account_id`/`envelope_id`) y paso incorrecto del objeto `Period` a parámetros posicionales `?`.
- Añadido `updatePeriodSummary` al servicio y su handler `PERIOD_SUMMARY_UPDATE`; el canal existía en `channels.ts` pero no tenía handler ni función de servicio.
- Eliminado `getPeriodSummaryById` del handler, import y `channels.ts` — innecesario antes de eliminar el `id` de `PeriodSummary`, y coherente con el plan de usar `Period` como clave compuesta.
- `delete` en preload e interface migrado de `(id: number)` a los cuatro campos de `Period`.
- Handlers registrados en `main.ts`; superficie expuesta en `preload.ts`; `global.d.ts` tipado con la nueva interface `PeriodSummaries` de `shared/interfaces.ts`.

**`accountId` añadido a `Movement`:**

- Columna `account_id INTEGER NOT NULL REFERENCES accounts(id)` ya existía en el schema; ahora se persiste y se lee correctamente en todas las queries del repositorio (SELECT cols, INSERT, UPDATE).
- `createMovement` obtiene el `accountId` del account por defecto via `accountRepository.getDefaultId()`.
- `MovementFormComponent`: el objeto `Movement` en el path de edición incluye `accountId: this.editingMovement!.accountId`.
- `movement.service.test.ts`: objeto `Movement` de la prueba de validación de nombre corregido con `accountId: 1`.

**`startingBalance` añadido a `Account` y `Envelope`:**

- Schema: `starting_balance INTEGER NOT NULL DEFAULT 0` en ambas tablas.
- Repositorios: `selectCols`, INSERT y UPDATE actualizados; `RawAccount`/`RawEnvelope` y sus mappers incluyen el campo.
- Servicios: `createAccount` y `createEnvelope` aceptan `startingBalance = 0` como tercer parámetro con default. En `createAccount`, el envelope por defecto creado automáticamente recibe `startingBalance: 0`.
- Cadena IPC completa: handlers, interfaces (`Accounts.create`, `Envelopes.create`), preload y `ElectronService` actualizados.
- Formularios: `AccountFormComponent` y `EnvelopeFormComponent` añaden campo `<app-amount-input>` para `startingBalance`; `ngOnChanges` restaura el valor al editar; ambos paths (create y update) lo envían.

**Tests E2E:**

- `smoke.spec.ts`: `getByText('Movements')` reemplazado por `getByRole('link', { name: 'Movements' })` — el texto coincidía también con el `<h2>` de la página y Playwright lanzaba strict mode violation.
- `smoke-crud.spec.ts`: test de creación de categoría + movimiento marcado como `test.fixme` con comentario explicativo — requiere la capa IPC de Electron; en el contexto `ng serve` de Playwright, `window.categories` es `undefined`.

---

## Pasos siguientes

### Pendientes arrastrados de auditorías previas

- **`DataTableComponent` y `FilterPanelComponent`** (de la auditoría 14/05/2026): siguen sin extraer. Se aplazaron deliberadamente esta sesión por falta de un segundo consumidor — `MovementsListComponent` es por ahora el único caller del shell de filtros, y los listados de entidades pueden cambiar todavía. Reabrir cuando aparezca el dashboard o el rules-builder.
- **Visualización de relaciones en listas (parcial → más cerca)**: la página de Accounts ya muestra una tira de `StatCard` (income, expense, balance, envelope count) gracias a `Accounts.getStats()`. Pendiente extender el patrón a Categories y Envelopes: añadir contadores de uso por categoría y balance por envelope (cada uno requerirá su propio endpoint IPC con agregados SQL).

### Pendientes nuevos surgidos esta sesión

Generados directamente por el trabajo de esta iteración.

- **Adopción amplia de `FormFieldComponent`**: solo se aplicó en `AccountFormComponent` como demostrador. Los otros cuatro formularios (`movement-form`, `envelope-form`, `category-form`, `tag-form`) repiten el triple `.form__group + .form__label + .form__error` y se beneficiarían de migrar.
- **Errores de lint preexistentes**: `confirm-dialog/confirm-dialog.component.html` (autofocus), `modal/modal.component.html` (click sin keyup/keydown), `testing/mock-electron.service.ts` (gran cantidad de `_`-prefixed vars marcadas como no usadas). Esta sesión no las tocó; revisar y o bien arreglar o bien `eslint-disable` puntualmente.
- **Smoke test manual de la app**: no se hizo por límite de tokens. Lista priorizada de qué comprobar (bulk delete, autocomplete, quick-create, stats strip, EntitySelect en envelope form) entregada al usuario al final de la sesión.
- **`MovementFormComponent` y `MovementsComponent` aún cargan datos por separado**: el form re-pide categories/envelopes/tags en su `ngOnInit`, duplicando los fetches que ya hace el container. Un futuro pass podría aceptar esos datos como `@Input()` cuando se usa embebido y solo auto-cargarlos cuando se abre como dialog.
- **Decisión `ModalComponent` vs `DialogService`**: documentada esta sesión pero no resuelta. Reevaluar tras la adopción del quick-create launcher en más sitios; si el patrón "abrir form en modal vía service" cubre todos los casos, retirar `ModalComponent`.
- **`Movement.date` sigue cruzando el IPC como string**: las defensas `m.date instanceof Date ? ... : new Date(String(m.date))` en `movements-list` y `movement-form` indican que la deserialización no es completamente confiable. Considerar normalizar a string en el tipo compartido y convertir a `Date` solo donde haga falta.

### Pendientes surgidos en junio 2026 (continuación)

- **Eliminar `id` de `PeriodSummary`**: usar los cuatro campos de `Period` como clave primaria compuesta. Requiere cambiar UPDATE y DELETE del repositorio para usar Period, añadir dos índices UNIQUE parciales en el schema (mismo patrón que `is_default`), y eliminar `id` de la interface y todos los callers.
- **ESLint `!= null` en `period-summary-card.component.html`**: `@angular-eslint/template/eqeqeq` prohíbe `!= null`. Reemplazar por `!== undefined` o configurar `"allowNullOrUndefined": true`.
- **Playwright CRUD test con IPC**: `smoke-crud.spec.ts` está marcado como `test.fixme`. La solución real sería correr Playwright contra la app Electron completa, o añadir un mock de contextBridge en el setup de Playwright para el contexto `ng serve`.

### Recomendaciones de mayor alcance (fuera de la iteración actual)

Registradas para no perderlas; ninguna es bloqueante.

- **i18n**: el resolver `ErrorTextService` centraliza el texto inglés y `AppErrorCode` ya está cableado en backend — la parte costosa está hecha. Falta integrar `ngx-translate`/`transloco` y mover los catálogos. Coste estimado: ~1.5–2 días.
- **Estilos y animaciones de modales**: `ModalComponent` y los diálogos vía `DialogService` siguen sin animaciones de entrada/salida ni shadows/padding consistentes. Definir el aspecto unificado usando los design tokens existentes.
- **Dashboard**: con `Accounts.getStats()` y `Tags.getForMovements` ya en su sitio, el groundwork para un dashboard agregado está hecho. Falta la ruta `/` con balances por envelope, chips de filtro rápido ("este mes"), y rutas de detalle por envelope/category/account.
- **Exportación CSV** (sin import): ~30 líneas en el renderer; diferido a v0.4 junto con el import.
- **Confirmación de borrado de cuenta tecleando el nombre**: importante para evitar borrados destructivos accidentales (cascada de envelopes + movements + tags).
- **Estados tentativo/confirmado**, **split allocations** (`movement_envelope_allocation`), **plantillas de movimientos periódicos**, **marcado de anomalías**: todos en el spec del vault; asignados a v0.4+.
- **Edición masiva de "movimientos del mes"**, **excluir presupuestos del total**, **atajos de teclado**: parking lot.

---
