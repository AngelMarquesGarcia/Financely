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

### Cambios próximos planificados (implementados)

- (implementado) **Eliminar `id` de `PeriodSummary`**: usar los cuatro campos de `Period` (accountId, envelopeId, year, month) como clave primaria compuesta en lugar de un `id` autoincremental. Requiere:
  - Cambiar el `UPDATE` y `DELETE` del repositorio para usar `Period` en lugar de `id`.
  - Añadir dos índices `UNIQUE` parciales en el schema: uno para filas con `envelope_id IS NOT NULL` y otro `WHERE envelope_id IS NULL` para filas de nivel de cuenta (SQLite trata los `NULL` como distintos en constraints `UNIQUE` normales, por lo que se necesita el mismo patrón de índice parcial que ya usan los defaults de `is_default`).
  - Eliminar el campo `id` de la interfaz `PeriodSummary` en `shared/types.ts` y actualizar todos los callers.

- (implementado) **Cambio de `type` a `class`**: reemplazar los tipos planos de `shared/types.ts` por clases TypeScript con métodos de dominio (e.g. `Period.previous()`, `Period.next()`). TypeScript no impone un archivo por clase — múltiples clases pueden exportarse desde un mismo `.ts`. La transición requerirá actualizar las deserializaciones en los repositorios (ya que `better-sqlite3` devuelve plain objects que habrá que mapear a instancias de clase).

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

## Junio 2026 (continuación 2 - 24/06)

### Refactor de arquitectura: se pasa de usar tipos a usar clases, siguiendo más de cerca el diseño POO de Spring (con tipos wire T-suffix, clases de dominio, handlers como frontera de adaptación)

**Motivación:** Los tipos de entidad en `shared/types.ts` compartían nombre con las clases de dominio que se querían introducir (e.g., `Period` como tipo plano y como clase con métodos). Los servicios interrumpían la lógica de negocio para llamar `Period.from(period)` en medio de un método. `DEFAULT_CATEGORY_ICONS` y `DEFAULT_COLOR_ORDER` estaban duplicados entre `electron/services/settings.service.ts` y `angular/src/app/core/defaults.ts`.

**Cambios realizados:**

- **`shared/types.ts`** — todos los tipos de entidad renombrados con sufijo T: `Movement` → `MovementT`, `Category` → `CategoryT`, `Account` → `AccountT`, `Envelope` → `EnvelopeT`, `Tag` → `TagT`, `Period` → `PeriodT`, `PeriodSummary` → `PeriodSummaryT`. Son los tipos wire (DTOs planos, serializables por structured clone). Los tipos sin clase de dominio (`AccountStats`, `BasicSummary`, `AppSettings`, `MovementFilter`, `DirtyState`) conservan sus nombres.

- **`shared/domain.ts`** (nuevo) — clases de dominio con métodos e instancia, cada una con `static from(d: XyzT): Xyz`:
  - `Period`: `getPrevious()`, `getNext()`, `fromMovement(m)`, `fromPeriodSummary(ps)`
  - `Movement`: `getPeriod()`
  - `PeriodSummary`: `getPeriod()`
  - `Account`, `Category`, `Envelope`, `Tag`: solo factory `from()`, sin métodos de instancia adicionales

- **`shared/defaults.ts`** (nuevo) — fuente única de `DEFAULT_COLOR_ORDER` y `DEFAULT_CATEGORY_ICONS`. Elimina la duplicación entre el servicio de settings del backend y el frontend.

- **`angular/src/app/core/defaults.ts`** (eliminado) — era un re-export shim de `@shared/defaults`. Sus dos importadores (`settings.component.ts`, `category-form.component.ts`) apuntan ahora directamente a `@shared/defaults`.

- **Patrón handler-as-boundary** — los handlers IPC son el único punto de conversión T-type ↔ clase de dominio:
  - Reciben T-types de IPC (e.g., `movement: MovementT`)
  - Convierten antes de llamar al servicio: `movementService.update(Movement.from(movement))`
  - El retorno de structured clone serializa automáticamente las clases a plain objects
  - Los servicios nunca ven wire types en sus parámetros de entidad

- **Servicios** (`electron/services/`) — firmas de los métodos que reciben entidades actualizadas a clases de dominio:
  - `MovementService`: `update(movement: Movement)`, `getByPeriod(period: Period)`
  - `AccountService`: `update(account: Account)`
  - `CategoryService`: `update(category: Category)`
  - `EnvelopeService`: `update(envelope: Envelope)`
  - `TagService`: `update(tag: Tag)`
  - `PeriodSummaryService`: todos los métodos que antes aceptaban `PeriodT` ahora aceptan `Period`; `update()` pasa de `PeriodSummaryT` a `PeriodSummary`; eliminadas las conversiones `Period.from(period)` mid-logic en `create()`, `recalculateForPeriod()` y `markDirty()`

- **Handlers** (`electron/ipc/`) — añadidas conversiones at the boundary:
  - `movements.handler.ts`: `Movement.from(movement)` en `MOVEMENT_UPDATE`
  - `accounts.handler.ts`: `Account.from(account)` en `ACCOUNT_UPDATE`
  - `categories.handler.ts`: `Category.from(category)` en `CATEGORY_UPDATE`
  - `envelopes.handler.ts`: `Envelope.from(envelope)` en `ENVELOPE_UPDATE`
  - `tags.handler.ts`: `Tag.from(tag)` en `TAG_UPDATE`
  - `period-summaries.handler.ts`: `Period.from()` en CREATE/GET_BY_PERIOD/DELETE; `PeriodSummary.from()` en UPDATE

- **Frontend Angular** — todos los usos de los tipos de entidad como tipos TypeScript actualizados al sufijo T en `electron.service.ts`, `preload.ts`, todos los componentes relevantes (`movement-form`, `movements-list`, `movements-filter`, `movement-list-compact`, `movement-detail-dialog`), fixtures de test (`mock-electron.service.ts`, `sample-summaries.ts`, `movements-list.component.spec.ts`, `settings.component.spec.ts`).

**Verificación:** `npm run type-check` (electron) limpio. 46/46 tests Jest verdes. Tests Vitest sin cambios de comportamiento.

---

## Junio 2026 (continuación 3 - 27/06)

### Presupuestos de envelope, tope de ahorro y transferencias internas

Tres fases incrementales sobre el modelo de envelopes. El plan detallado vive en [`i-intended-you-to-dynamic-shore.md`](C:/Users/burak/.claude/plans/i-intended-you-to-dynamic-shore.md).

**Fase 1 — Presupuesto (`budgetCents`):**

- Nuevo campo nullable `budgetCents` en `EnvelopeT`/`Envelope`/schema. Se snapshotea en cada `PeriodSummary` (columna `budget_cents`, ya existente, resignificada del "available budget" roto a "snapshot de presupuesto"). El available budget pasa a ser **derivado** (`budget − gastos`), no almacenado.
- Eliminado el bug por el que `availableBudgetCents` se calculaba como `NaN` (leía `envelope.fixedBudget`, campo inexistente) y se guardaba como `NULL`.
- Edición del presupuesto: re-snapshot **solo del mes en curso** (`stampEnvelopeSnapshot`, exacto `(year, month)`); meses pasados congelados; meses futuros toman el valor actual del envelope al crearse.

**Fase 2 — Tope de ahorro (`maxSavingsCents`):**

- Espejo de `budgetCents`: campo nullable en envelope + snapshot en `PeriodSummary`, almacenado como céntimos absolutos. Form con selector None / 1× / 2× / 3× / Custom.
- La card muestra "Savings cap" + "Overflow" (en su momento display-only; ahora el getter `savingsOverflowCents` usa el umbral real de redirección `cap + budget`).

**Fase 3 — Transferencias internas + redirección de excedente:**

- Nueva entidad `Transfer` (tabla `transfers`): mueve céntimos entre dos envelopes de la **misma cuenta**, con flag `isAuto`, fecha y notas. No es un movimiento: no afecta a income/expense/cashflow, solo al balance acumulado. Sin edición (solo create/delete).
- `PeriodSummary` gana `netTransfersCents` (entradas − salidas), plegado en la cadena de ending balance (`ending = prev + cashFlow + netTransfers`). El recálculo DIRTY (solo re-encadenar) reutiliza el valor almacenado; el MODIFIED lo recalcula desde `transfers`.
- `calculatePeriodSummary` pasa a ser **movement-OR-transfer-driven**: un summary existe si el periodo tiene al menos un movimiento _o_ una transferencia (antes exigía ≥1 movimiento). `calculatePeriodSummaryFromMovements` refactorizado a `buildSummary(period, movements)` (deriva la identidad del `Period`, tolera lista vacía); `getBasicSummary` devuelve ceros en vez de lanzar.
- Crear/borrar una transferencia marca dirty los periodos de **ambos** envelopes (`periodTouched`, antes `movementCreatedInPeriod`, ahora invocado también desde el flujo de transferencias).
- `Envelope` gana `overflowsTo` (FK nullable a otro envelope). Redirección: al **crear o editar** un movimiento de ingreso, si `balance > maxSavings + budget`, el excedente se transfiere (auto) a `overflowsTo` o, si es null, al envelope por defecto de la cuenta (resuelto lazy). El `+ budget` deja disponible la asignación del mes. Solo los ingresos disparan la comprobación (las transferencias no), de modo que no hay cascada. La "fuga" cuando el dinero se gasta antes de recibirse es comportamiento intencionado.
- Capa IPC completa para transferencias manuales (channels, `transfers.handler`, preload, `interfaces.ts`, `global.d.ts`, `ElectronService`). UI de transferencias (lista, formulario, selector de `overflowsTo`) **diferida**.
- Helpers `dateToISO`/`isoToDate` extraídos a [electron/repository/date-utils.ts](electron/repository/date-utils.ts), reutilizados por movement- y transfer-repository.

**Nuevos `AppErrorCode`:** `ENVELOPE_BUDGET_NEGATIVE`, `ENVELOPE_MAXSAVINGS_NEGATIVE`, `ENVELOPE_OVERFLOWS_TO_SELF`, `TRANSFER_SAME_ENVELOPE`, `TRANSFER_AMOUNT_INVALID`, `TRANSFER_CROSS_ACCOUNT`, `TRANSFER_DATE_INVALID`, `TRANSFER_NOT_FOUND` (+ textos en `ErrorTextService`).

**Nota de schema:** la versión permanece en **1** (CLAUDE.md); `migrate()` sigue haciendo drop+recreate de todas las tablas, así que añadir `transfers` fue solo una línea de CREATE/DROP.

**Tests:** nueva suite [electron/**tests**/services/transfer.service.test.ts](electron/__tests__/services/transfer.service.test.ts) (creación/validación, `getForEnvelope`, delete, integración en la cadena de balance, redirección en create y update, target `overflowsTo`). Suites de envelope y period-summary ampliadas con budget/maxSavings/netTransfers.

**Verificación:** electron `type-check` limpio; **105/105** Jest verdes; **72/72** Vitest verdes; `build:dev` y `npm run lint` limpios. Sin smoke-test manual de la app.

---

## Junio–Julio 2026 (registro retroactivo — 28/06 a 03/07)

> **Nota:** las cuatro funcionalidades siguientes se implementaron entre el 28/06 y el 03/07 pero no se registraron en su momento; se documentan ahora de forma retroactiva, en su lugar cronológico. Ninguna incrementa la versión de schema (sigue en **1**; `migrate()` hace drop+recreate).

### Transferencias — capa de UI (28/06)

La capa IPC de transferencias manuales se completó el 27/06 (entrada anterior) pero su interfaz quedó diferida. Ahora implementada:

- Nueva feature [angular/src/app/features/transfers/](angular/src/app/features/transfers/): página contenedora, `transfers-list` (listado con origen/destino, importe, fecha, flag `isAuto`) y `transfer-form` (crear transferencia entre dos envelopes de la misma cuenta).
- Selector de `overflowsTo` en `envelope-form` (envelope destino del excedente de ahorro por encima del tope).
- Métodos correspondientes cableados en `ElectronService` y enlace en la navbar.

### Fix: importes con `.00` automático (28/06)

- Corregido un bug en [AmountInputComponent](angular/src/app/shared/components/amount-input/amount-input.component.ts) por el que al teclear un importe se le añadía `.00` de forma prematura, interfiriendo con la edición. El reformateo a céntimos pasa a aplicarse solo en `blur`. Test añadido.

### Movimientos periódicos (02/07)

Plantillas de movimientos recurrentes que **materializan** movimientos reales a medida que pasa el tiempo (decisión "plantilla vs instancia" del spec: el periódico NO es un flag sobre el movimiento, sino una entidad aparte).

- Nueva entidad `PeriodicMovementT` ([shared/types.ts](shared/types.ts)) + clase de dominio `PeriodicMovement` + tabla `periodic_movements`: `dayOfMonth` (1–31, se recorta a la longitud del mes al instanciar), `active` (pausa la generación conservando el histórico), `startYear`/`startMonth`, y el cursor `lastCreatedYear`/`lastCreatedMonth` (último periodo generado). Cada plantilla lleva su asignación a envelope y sus tags (la asignación se migra después a la tabla puente `periodic_movement_envelope` con la división de movimientos).
- Los movimientos generados nacen **tentativos** (`is_tentative` en `movements`, columna `template_id` → plantilla origen). El estado tentativo/confirmado se estrena aquí.
- Capa completa: [periodic-movement.service.ts](electron/services/periodic-movement.service.ts), [periodic-movement-repository.service.ts](electron/repository/periodic-movement-repository.service.ts), [periodic-movements.handler.ts](electron/ipc/periodic-movements.handler.ts), IPC/preload/interfaces, y feature Angular [features/periodic-movements/](angular/src/app/features/periodic-movements/) (lista + formulario).
- **Invariante** (con hueco conocido, ver "Known Issues"): no se puede confirmar un movimiento en un mes si el mes anterior tiene tentativos.

### División de movimientos entre envelopes / splits (03/07)

Un movimiento puede repartirse entre varios envelopes de su misma cuenta.

- La asignación movimiento→envelope pasa de una FK simple (`movements.envelope_id`) a la tabla puente **`movement_envelope`** (`movement_id`, `envelope_id`, `amount_cents > 0`, PK compuesta). Un movimiento normal tiene 1 fila; un split, varias. Invariante: `sum(amount_cents) == quantity_cents` (validado en servicio, no en schema).
- `MovementT.envelopeId` reemplazado por `envelopeIdMap: Map<envelopeId, amountCents>` ([shared/types.ts](shared/types.ts)); repositorio, servicio, cálculo de PeriodSummary (cada envelope cuenta su parte) y todos los callers actualizados. La plantilla periódica gana el equivalente `periodic_movement_envelope`.
- Nuevo componente [envelope-split-editor](angular/src/app/shared/components/envelope-split-editor/) adoptado en `movement-form` y `periodic-movement-form`. `movements-list` y `movement-detail-dialog` muestran el desglose.
- Nuevo [data-refresh.service.ts](angular/src/app/core/services/data-refresh.service.ts) para refrescar vistas dependientes tras cambios.
- Nuevos `AppErrorCode` de split (suma ≠ total, envelope duplicado, importe no positivo).

---

## Julio 2026 (04/07)

### Movimientos anómalos

Marca un movimiento como **anómalo** (`isAnomalous`) para excluirlo de las estadísticas de "lo que pasa
normalmente" (medias y agregados de income/expense/cashflow), sin sacarlo nunca del balance real. Prepara el
terreno para `CompoundMovement`, cuyos casos de uso marcan sus movimientos hijos como anómalos.

**Invariante de diseño:** el flag nunca mueve dinero real; solo particiona las estadísticas. Como
`endingBalanceCents = anchor + cashFlowCents + netTransfers` y `cashFlowCents` sigue siendo all-inclusive,
marcar/desmarcar anómalo no altera ningún balance, la cadena de ending-balance, `netTransfers` ni la
redirección de excedente de ahorro.

**Modelo de datos:**

- `MovementT.isAnomalous: boolean` (user-owned). Columna `is_anomalous` en `movements`. A diferencia de
  `is_tentative` (system-owned, preservado), `updateMovement` **sí** persiste `is_anomalous`.
- `PeriodSummaryT.summaryWithoutAnomalies: BasicSummary | null` — los mismos agregados recomputados sin los
  anómalos, o `null` cuando el periodo no tiene ninguno (la vista sin-anómalos coincide entonces con los
  campos top-level, que siguen siendo all-inclusive). Almacenado como 7 columnas planas `without_anom_*`
  (todas NULL juntas ⟺ `null`), mapeadas a/desde el objeto anidado en el repositorio.
- `AccountStats` gana `totalIncomeWithoutAnomaliesCents` / `totalExpenseWithoutAnomaliesCents` (SUM con
  `is_anomalous = 0` en `getStats`); `balanceCents` sigue siendo all-inclusive.

**Cálculo:** `buildSummary` computa el mirror en el mismo pase `MODIFIED` (filtra los anómalos y reutiliza
`getBasicSummary`) — no hay ruta de cálculo en tiempo real separada.

**Optimización de `markLaterDirty`:** `movement.update` diffea contra el movimiento almacenado
(`balanceInputsChanged`: cantidad, signo, mes, split). Si solo cambian campos no-balance (incl. `isAnomalous`,
nombre, notas, categoría), el periodo se marca `MODIFIED` (para recomputar el mirror) pero **no** se
re-encadenan los meses posteriores. `markDirty` / `periodTouched` ganan un parámetro `rechain`.

**`month-overview` con datos reales:** el seed inserta movimientos con SQL crudo, saltándose el hook
`periodTouched`, así que `period_summaries` quedaba vacía y el overview mostraba `SAMPLE_SUMMARIES`. Nuevo
`periodSummaryService.backfillPeriodSummaries()`, llamado desde `main.ts` tras `migrate()`, construye los
summaries de todos los movimientos existentes. `month-overview` ahora hace fetch real vía
`getAllPeriodSummaries()`, agrupa por mes (navegación prev/next) y ofrece un toggle "Include anomalous
movements" (por defecto excluye) que se propaga a cada `period-summary-card`.

**Fix de `getAll` (cleaning):** `periodSummaryService.getAll()` limpia cada summary sucio y **omite** (en vez
de lanzar) los que se auto-eliminan al limpiarse (huérfanos de un periodo cuyo último movimiento se borró).

**Frontend:** checkbox "Mark as anomalous" en `movement-form`; badge `✷ anomalous` + acento violeta en
`movements-list`; fila en `movement-detail-dialog`; `period-summary-card` con `@Input() showAnomalies` + getter
`effective` (un único `??` que cae al summary cuando no hay mirror) que conmuta income/expense/medias y
**availableBudget** (el gasto anómalo sale del ahorro, no del presupuesto mensual); tira de stats de Accounts
con el mismo toggle.

**Tests:** +7 (movement: persistencia del flag en create/update; period-summary: mirror correcto, `null` sin
anómalos, exclusión del mirror pero inclusión en balance, no-rechain en edición balance-neutral vs rechain en
edición de importe, `getAll` omite huérfanos; account: `getStats` sin-anómalos). Fixtures actualizados
(`sample-summaries.ts`, specs; call-sites de `create` por el nuevo parámetro posicional). **154/154 Jest,
79/79 Vitest verdes.**

---

## Julio 2026 (06/07)

### Generalización de PeriodSummary: mantenimiento de summaries a nivel de cuenta + `FilterSummary` al vuelo

Reencuadre del Known Issue "equivalente a PeriodSummary para tags/categorías". Un `PeriodSummary` es _"recontar las stats de los movimientos que casan un filtro en un periodo"_. En vez de ensanchar `PeriodSummary`, se parte por la frontera de almacenamiento:

- **`PeriodSummary` (almacenado, mantenido true): solo cuenta + envelope.** Clave intacta `(accountId, envelopeId|null, year, month)`, `envelopeId=null` = nivel de cuenta. Sin renombrado de clave (`target_type` descartado: `envelopeId` ya distingue cuenta vs envelope).
- **`FilterSummary` (al vuelo, no almacenado): tags, categorías, cuenta-como-filtro, filtros arbitrarios.** `BasicSummary` calculado en vivo, nunca persistido. Es además el prerrequisito de `CompoundMovement` (que necesita un home de neto a nivel de cuenta).

**Mantenimiento de summaries de cuenta (el Known Issue resuelto):** antes `Movement.getPeriods()` solo emitía periodos de envelope, así que las filas de cuenta nunca se creaban/actualizaban.

- [shared/domain.ts](shared/domain.ts): `Movement.getPeriods()` emite también el periodo de cuenta; `Period.fromMovement` acepta `envelopeId: number | null`. Con esto todos los hooks existentes (`periodTouched`/`markDirty`/`recalculate`/`backfill`) mantienen la fila de cuenta gratis; las filas de cuenta forman su propia cadena (`getLatestBefore`/`markLaterDirty` ya usan `envelope_id IS ?`).
- [movement-repository.service.ts](electron/repository/movement-repository.service.ts): nuevo `getMovementsByAccountMonth` (todos los movimientos de cuenta+mes, sin el scoping `EXISTS` por envelope); `hasTentativeInPeriod` ramifica a `hasTentativeInAccountMonth` para el periodo de cuenta. [movement.service.ts](electron/services/movement.service.ts): `getByPeriod` ramifica según `envelopeId == null`.
- Semántica de cuenta: cada movimiento cuenta **una vez** a su importe completo (los splits no se desglosan); `netTransfers ≡ 0` (las transferencias internas se netean dentro de la cuenta); balance anclado en `account.startingBalance`.

**Fix de schema (descubierto en implementación):** `period_summaries.envelope_id` era `ON DELETE SET NULL`. Con las filas de cuenta ya reales, borrar un envelope convertía sus summaries en filas `envelope_id=NULL` que colisionaban con la fila de cuenta (y con el nuevo índice único). Cambiado a **`ON DELETE CASCADE`** (los summaries de envelope derivados mueren con su envelope). [schema.ts](electron/repository/schema.ts).

**Índice único que faltaba:** [database.service.ts](electron/repository/database.service.ts) añade `uq_period_summary_key ON period_summaries(account_id, COALESCE(envelope_id, -1), year, month)` — el `COALESCE` es necesario porque SQLite trata los `NULL` como distintos en un `UNIQUE` normal (dejaría pasar filas de cuenta duplicadas).

**`FilterSummary` al vuelo:**

- Núcleo de agregación extraído a [basic-summary.ts](electron/services/basic-summary.ts) (`computeBasicSummary(movements, envelopeId?)`), reutilizado por `PeriodSummaryService` y el nuevo servicio.
- Nuevo [filter-summary.service.ts](electron/services/filter-summary.service.ts): `generateFilterSummary(filter)`. Deriva el intervalo de `filter.date` a nivel de **mes** (snapeado a meses enteros; los días arbitrarios se ignoran), hace un único fetch del intervalo, agrupa por mes, y devuelve un `FilterSummaryT` = `{ filters, aggregate, children[] }` (una entrada por mes). Cada entrada trae el `BasicSummary` all-inclusive **y** su espejo sin-anómalos (`null` si el slice no tiene anómalos) + flag `tentative`. Los importes siguen al filtro: **parciales** si apunta a un único envelope, **completos** en otro caso. Las medias del `aggregate` se calculan sobre los totales del intervalo (no promediando medias mensuales).
- `MovementFilter` gana `accountId` (acota slices de tag/categoría a una cuenta) e `includeAnomalies` (system-owned, backend-set-only: etiqueta qué variante refleja cada `BasicSummary.filters`; el usuario nunca lo fija, ninguna query lo lee). [types.ts](shared/types.ts): nuevos `FilterSummaryT`/`FilterSummaryEntry`.
- Capa IPC: canal `MOVEMENT_GET_FILTER_SUMMARY`, handler en [movements.handler.ts](electron/ipc/movements.handler.ts), `Movements.getFilterSummary` en interfaces/preload/`ElectronService`.

**Frontend:**

- `month-overview` deja de descartar las filas de cuenta: nueva sección "Account total" con una tarjeta de cuenta por mes (reusa `PeriodSummaryCardComponent`, cuyo `label` ya cae a `accountName`). [month-overview.component.ts](angular/src/app/features/month-overview/month-overview.component.ts).
- Nuevo [filter-summary.component](angular/src/app/shared/components/filter-summary/filter-summary.component.ts): muestra el `aggregate` + desglose mensual expandible, con toggle de anómalos (mismo patrón `effective` que `period-summary-card`). Cableado en [movements.component.ts](angular/src/app/features/movements/movements.component.ts) bajo la lista, refrescándose con el filtro activo.

**Tests:** [domain.test.ts](electron/__tests__/shared/domain.test.ts) (getPeriods con periodo de cuenta); [period-summary.service.test.ts](electron/__tests__/services/period-summary.service.test.ts) (mantenimiento de cuenta: totales, split contado una vez, `netTransfers=0`, cadena de balance, borrado de huérfano; el test que asumía que crear un summary de cuenta lanzaba ahora verifica que agrega correctamente); nueva suite [filter-summary.service.test.ts](electron/__tests__/services/filter-summary.service.test.ts) (intervalo multi-mes con medias correctas + snapping, espejo sin-anómalos, parcial vs completo, default a mes actual).

**Verificación:** electron `type-check` limpio; **163/163** Jest verdes; `npm run lint` limpio; `build:dev` limpio; **79/79** Vitest verdes. Smoke-test manual por el usuario: todo OK.

**Diferido conscientemente:** vista anual/intervalo para pools (cuenta/envelope); multi-select vía arrays en el filtro; rework del starting balance de envelopes (ver Pasos siguientes).

---

## Julio 2026 (07/07)

### Movimientos compuestos (CU1 agrupación + CU2 cancelables)

Un **movimiento compuesto** agrupa movimientos reales que existen por separado bajo un `parentId` común, para verlos y calcularlos como un conjunto. Dos formas: una **agrupación** (un viaje — los hijos siguen siendo canónicos) y un conjunto **cancelable** (una cena de 120 € devuelta por varios Bizums — el neto es lo canónico). Nunca mueve dinero: el `ownerMonth` solo re-atribuye las _estadísticas_ del conjunto a un mes, mientras la cadena de ending-balance permanece fiel al banco. Cierra los casos de uso CU1/CU2 del spec ([docs/CompoundMovement-spec.md](docs/CompoundMovement-spec.md)); CU3 (split) ya estaba. El registro completo de decisiones y su porqué vive en la memoria `compound-movements-decisions` (D1–D16).

**Invariante rector (D1):** la re-atribución de compuestos solo toca agregados de estadística; jamás la cadena de balance, `netTransfers` ni la redirección de excedente. El balance de la app siempre cuadra con el banco (verificación); las stats son "hábitos" y se pueden remodelar.

#### Backend

**Modelo** ([shared/types.ts](shared/types.ts), [shared/domain.ts](shared/domain.ts), [schema.ts](electron/repository/schema.ts)):

- `MovementT.parentId: number | null` — el compuesto al que pertenece (≤1). Columna `parent_id` en `movements` (`ON DELETE SET NULL`). `updateMovement` lo **preserva** (como `is_tentative`); solo cambia vía `setParent`.
- Nueva entidad ligera `CompoundMovementT` + tabla `compound_movements`: `accountId`, `name`, `isCancelable`, `ownerYear`/`ownerMonth` (null-juntos ⇒ "anual/sin dueño"), `isAnomalous`, `notes`.

**Servicio** ([electron/services/compound-movement.service.ts](electron/services/compound-movement.service.ts)): create (desde movimientos existentes y/o nuevos, ≥2), addMember/createMember/removeMember, update, delete(deleteChildren). Reglas:

- **D12/D13 membresía:** misma cuenta (`COMPOUND_CROSS_ACCOUNT`), ≤1 padre, sin hijos split/periódicos/tentativos.
- **D6 cancelable:** todos los hijos comparten un envelope (`COMPOUND_CANCELABLE_MULTI_ENVELOPE`).
- **D11 owner month:** por defecto el mes más temprano de los hijos, sobre-escribible; el backend valida que ∈ meses de los hijos.
- **D2 herencia de anomalía:** padre anómalo ⇒ fuerza todos los hijos anómalos; un hijo no puede desmarcarse mientras el padre lo esté (guard `COMPOUND_ANOMALY_CHILD_CONFLICT` en `movement.update`).
- **D16 ciclo de vida:** bajar de 2 miembros disuelve el compuesto (el superviviente queda huérfano, conservando su `isAnomalous`); `movement.delete`/`deleteMany` auto-disuelven al borrar un hijo directamente.

**Estadística re-atribuida** ([electron/services/compound-summary.ts](electron/services/compound-summary.ts)): `computeCompoundAdjusted(period, rawMovements)` produce los agregados "compound-adjusted" (con y sin anómalos) de un periodo, o `null` si ningún compuesto lo afecta. En meses no-dueño los hijos se sacan del cálculo; en el owner month se inyecta la figura colapsada (cancelable → **un** movimiento neto; agrupación → sus hijos individuales, D14). Reglas de nivel (D4/D6): a nivel **cuenta** re-atribuyen agrupaciones y cancelables; a nivel **envelope** solo cancelables (los hijos de una agrupación siguen contando en su envelope real).

**Decisión revisada (vs. plan):** el plan fijaba _diffs_ almacenados (D7); durante la implementación se optó por **mirrors completos** almacenados (`summaryCompoundAdjusted` / `summaryCompoundAdjustedWithoutAnomalies` en `PeriodSummaryT`; 14 columnas `compound_adj_*` / `compound_adj_wo_anom_*`). Motivo: los diffs eran mucho más complejos en lógica (composición asimétrica anomalía×compuesto entre periodos) y, con a lo sumo unos miles de summaries, el coste de memoria es asumible; reajustable a futuro. (Aprendizaje: este cambio debió plantearse en la fase de spec, no durante la implementación.)

**Propagación cross-period (la parte difícil):** el `compoundInjection` del owner month depende de hijos de _otros_ meses. `movement.update`/`delete`/`deleteMany` invocan `touchCompoundOwner(parentId)`, que dispara `periodSummaryService.touchCompoundOwnerPeriods(compound)` — remarca el/los periodo(s) dueño (cuenta siempre; envelope si cancelable), stats-only, sin re-encadenar el balance (D1). No-op para compuestos sin dueño.

**IPC:** superficie completa `compoundMovements` (channels, handler [compound-movements.handler.ts](electron/ipc/compound-movements.handler.ts), preload, `CompoundMovements` en interfaces, `ElectronService.*CompoundMovement*`). Nuevos códigos `COMPOUND_*` en [error-codes.ts](shared/error-codes.ts).

#### Frontend

- **Página dedicada `/compounds`** ([angular/src/app/features/compounds/](angular/src/app/features/compounds/)): contenedor + `compounds-list` (nombre, badge de tipo, owner month/"Yearly", nº de miembros, badge anómalo) + `compound-form` dialog-aware (picker de miembros con `EntitySelect` filtrado por elegibilidad, `<select>` de owner month, botón **"+ New movement"** que reusa `MovementForm` en diálogo y auto-selecciona el movimiento nuevo — creación de hijos en el sitio) + `compound-delete-dialog` (checkbox "borrar también los movimientos", D16). Ruta + link en navbar.
- **Visualización D15 en `movements-list`:** los miembros del owner month **colapsan en una pseudo-fila expandible** (revela solo los de ese mes); los de meses no-dueño se muestran **grises "no contados aquí"** con tooltip. `movements.component` carga los compuestos y abre el detalle desde una fila.
- **Stats:** `period-summary-card` muestra por defecto el mirror compound-adjusted (getter `effective`, componiendo con el toggle de anómalos) + badge `⛓ compound`.
- **Errores:** textos `COMPOUND_*` en [error-text.service.ts](angular/src/app/core/services/error-text.service.ts).

**Tests:** backend — nueva suite [compound-movement.service.test.ts](electron/__tests__/services/compound-movement.service.test.ts) (creación, membresía, owner month, herencia de anomalía, add/remove/disolución, update/delete) + [period-summary.service.test.ts](electron/__tests__/services/period-summary.service.test.ts) ampliada (re-atribución mono/multi-mes, cancelable neto, composición anomalía×compuesto, propagación al owner, balance intacto). Frontend — `compounds-list`, `period-summary-card` (selección del mirror), `movements-list` (colapso + filas grises).

**Verificación:** **195/195** Jest verdes; **93/93** Vitest verdes; `type-check`, `build:dev` y `npm run lint` limpios. Smoke-test manual entregado al usuario.

**Diferido:** create-new-children-on-the-spot resuelto reusando `MovementForm` (no un sub-form propio).

**Correcciones de UI (mismo día):**

- El formulario de compuesto se abría vía `<app-modal>`, que no aporta superficie de card (la aporta el contenido proyectado) y cuyo panel queda por encima del `cdk-overlay-container`; el diálogo "New movement" anidado quedaba **detrás e ininteractuable**. La página `/compounds` pasa a abrir el formulario con `DialogService` (igual que el "Detail" desde la lista de movimientos), y `compound-form` + `compound-delete-dialog` llevan su propia card. [compounds.component.ts](angular/src/app/features/compounds/compounds.component.ts).
- Los movimientos creados con "+ New movement" se persisten de inmediato (reusan `MovementForm`), así que ahora son **provisionales**: `compound-form` los rastrea y, si el diálogo se cierra sin crear/guardar (cancelar, backdrop, ESC), `ngOnDestroy` los borra (rollback) y refresca las vistas. Si se completa la creación/edición, se conservan (los seleccionados quedan como miembros). [compound-form.component.ts](angular/src/app/features/compounds/compound-form/compound-form.component.ts).

---

## 09/07/2026

### Importación / exportación CSV y copia de seguridad de la base de datos

Funcionalidad completa para **importar movimientos en masa** desde CSV, **exportarlos** (todo o filtrado), y hacer **copias de seguridad completas** de la BD. Metodología spec→plan→implement; decisiones cerradas en la fase de spec. Biblioteca: **PapaParse** (parse + unparse) en el main process. Formato "ligero" plano; el "pesado" multi-archivo/XLSX queda diferido.

**Formato CSV ligero:** columnas `name, concept, quantity, date, account, category, envelope, tags, notes, anomalous, template, group`. `quantity` decimal con signo (signo→`isPositive`, magnitud→cents); `date` `YYYY-MM-DD` o `YYYY-MM` (día 01); `envelope` nombre único o mini-sintaxis de split `Food:12.50|Fun:3.00`; `tags` lista `type/name` separada por `|` (escape con `\`); `account` se escribe al exportar pero se **ignora** al importar (los movimientos entran en la cuenta elegida).

**Refactor del ciclo de vida de la BD** ([electron/repository/database.service.ts](electron/repository/database.service.ts)): `migrate()` pasa a ser **no destructivo** (solo `ensureSchema()`: crea tablas/índices si faltan + defaults mínimos). El drop + seed de demo se extrae a métodos explícitos `dropAllTables()` y `createExampleData()` (solo testing/dev). La categoría por defecto pasa de `Salary` a **`Uncategorized`** (neutral; destino de reasignación al borrar y bucket de importación, reusando la guarda de default indeleteable). El arnés de tests de integración migra a un helper `resetTestDb()` (`dropAllTables() + createExampleData()`) en las 10 suites.

**Import (create-only)** ([electron/services/import-export.service.ts](electron/services/import-export.service.ts)): `previewImport(csv, accountId)` es **puro y no persiste** — parsea (delimitador autodetectado, decimales con coma tolerados: es-ES), resuelve referencias por nombre único (categoría/envelope no encontrados → buckets `Uncategorized`/`Unassigned`, marcados como issue), tags desconocidos marcados para crear; devuelve `{ drafts, issues }` (`MovementDraftT[]` + `ImportIssueT[]`; las filas con error de bloqueo se excluyen de `drafts`). `commitImport(drafts, accountId)` persiste en **una transacción** (reusa `movementService.create` → validación + hooks de period summary + overflow; transacciones anidadas vía savepoints), auto-crea tags y re-vincula template/group por nombre.

**Export** (mismo servicio): `exportMovements(filter?)` reusa `movementRepository.getAllMovements(filter)` (undefined = todo, rango de meses, o cualquier filtro). **Rechaza** la exportación si la selección contiene movimientos tentativos (`EXPORT_CONTAINS_TENTATIVE`). Resuelve ids→nombres, formatea el importe con signo, escribe con BOM UTF-8.

**Backup / restore** (`database.service.ts`): `backup(dest)` usa la API de backup online de better-sqlite3. `restore(src)` valida el archivo (segunda conexión de solo lectura), luego copia **in-place** vía `ATTACH` en una transacción (todo-o-nada) — **no** reabre la conexión, porque los repositorios cachean el handle al cargar el módulo (desviación respecto al plan, que fijaba file-swap + reopen; el ATTACH+copy evita el handle obsoleto). Restaurar reemplaza **toda** la BD (no es merge).

**IPC:** dos APIs nuevas — `importExport` (previewImport/commitImport/exportMovements) y `database` (backup/restore + dropAllTables/seedExampleData, estos dos marcados testing-only). Channels, handlers ([import-export.handler.ts](electron/ipc/import-export.handler.ts) y [database.handler.ts](electron/ipc/database.handler.ts) — dueños del `dialog` nativo y `fs`; los servicios quedan libres de Electron), preload, interfaces `ImportExport`/`Database`. Nuevos códigos `EXPORT_CONTAINS_TENTATIVE`, `IMPORT_MISSING_COLUMNS`, `BACKUP_FAILED`, `RESTORE_INVALID_FILE`. Nuevo [shared/money.ts](shared/money.ts) (`parseSignedMoney`/`formatSignedMoney`, sign-aware).

#### Frontend

- **Wiring** ([types/global.d.ts](angular/src/app/types/global.d.ts), [electron.service.ts](angular/src/app/core/services/electron.service.ts)): tipado de `window.importExport`/`window.database` + wrappers RxJS.
- **Diálogo de previsualización** ([features/import-export/import-preview-dialog/](angular/src/app/features/import-export/)): tabla de **solo lectura** de los drafts + resumen de issues agrupado por código (informativos vs. filas descartadas), botones Create / Cancel (sin edición inline — decisión cerrada en spec).
- **Sección "Data" en Settings** ([settings.component.ts](angular/src/app/features/settings/settings.component.ts)): selector de cuenta + "Import from CSV…" (→ previewImport → diálogo → commitImport), "Export all movements…", "Back up database…", "Restore from backup…" (confirmación danger + recarga), y subsección "Developer / testing" (Delete all data / Seed example data). Las operaciones de BD completa hacen `window.location.reload()`.
- **Export filtrado** ([movements.component.ts](angular/src/app/features/movements/movements.component.ts)): botón "Export current view…" que pasa el `MovementFilter` activo (exporta el mes/filtro visible).
- **Errores:** textos nuevos en [error-text.service.ts](angular/src/app/core/services/error-text.service.ts).

**Tests:** backend — [import-export.service.test.ts](electron/__tests__/services/import-export.service.test.ts) (formato export + guarda de tentativos + filtro; parse: buckets, tags, fechas `YYYY-MM`/`YYYY-MM-DD`, splits, decimal coma, delimitador `;`, columnas faltantes; commit transaccional + rollback; round-trip) y [database.service.test.ts](electron/__tests__/services/database.service.test.ts) (ensureSchema idempotente, drop/seed, `Uncategorized` default, backup+restore, archivo inválido). Frontend — `import-preview-dialog` (render, resumen de issues, close true/false) y `settings` ampliado (export/backup/import/restore/seed).

**Verificación:** **213/213** Jest verdes; **107/107** Vitest verdes; `type-check`, `build:dev` y `npm run lint` limpios. Smoke-test manual entregado al usuario.

**Diferido:** export "pesado" multi-archivo/XLSX; mapeo de columnas para CSVs ajenos (banco); creación on-the-spot de template/group inexistentes al importar; tests E2E.

---

## 10/07/2026

### Correcciones pre-release, documentación y decisión de pivote a frontend

Sesión de cierre de la fase backend antes de una primera **pre-release** (alpha) y del giro a la fase de frontend. Tras revisar el estado frente a la spec del vault se decide que el backend queda **funcionalmente completo** salvo el motor de reglas (v0.4, diferido) y las extensiones de import de CSV bancario (mapeo de columnas / detección de duplicados / reconciliación, diferidas); el resto del plan (v0.5+) es esencialmente frontend.

**Correcciones:**

- **`CompoundMovement.delete`** ([electron/services/compound-movement.service.ts](electron/services/compound-movement.service.ts)): al borrar un compuesto ahora refresca el espejo compound-adjusted del mes owner (`touchCompoundOwnerPeriods`) y, si los hijos sobreviven (`deleteChildren=false`), también sus propios periodos — antes el espejo del owner quedaba obsoleto hasta el siguiente toque de ese periodo. Único camino de mutación que no lo hacía.
- **electron-builder** ([electron-builder.yml](electron-builder.yml)): `appId`/`productName` del template (`com.example.fromscratch` / `from-scratch-electron-angular`) actualizados a `com.financely.app` / `Financely`. Fijar el `appId` antes de la primera release evita fragmentar identidad/userData/updates después.
- **Pantalla en blanco tras operaciones de BD completa en el build empaquetado** ([settings.component.ts](angular/src/app/features/settings/settings.component.ts)): wipe/seed/restore hacían `window.location.reload()`. En el build la app se sirve desde `file://…/browser/index.html` con `<base href="./">` (reescrito por el builder); al recargar, la URL de la ruta actual resuelve contra el directorio y pierde `index.html` → `ERR_FILE_NOT_FOUND` / pantalla en blanco. Sustituido por navegación **client-side** (`router.navigateByUrl('/movements')`, cierra el diálogo si está abierto), que re-crea la vista y re-lee la BD sin cargar ningún fichero. Supersede la nota de "hacen `window.location.reload()`" de la entrada 09/07. Test de settings actualizado (mock `Router`). Se revirtió un intento previo con `withHashLocation()` — no resolvía el problema por el mismo `base href`.

**Documentación nueva:** [docs/functional-overview.md](docs/functional-overview.md) (mapa de alto nivel: funcionalidades, reglas, automático vs. manual, known issues, diferidos) y [docs/technical-reference.md](docs/technical-reference.md) (arquitectura, schema, y los algoritmos no obvios: máquina dirty de PeriodSummary, re-atribución de compuestos, redirección de overflow, generación de periódicos, formato CSV). La *Especificación unificada* del vault quedó desactualizada (~2 meses, última sync 26/05); estos dos ficheros pasan a ser la referencia de estado del backend.

**Verificación:** Jest 214/214, Vitest 107/107, `build:dev` limpio. Sin smoke-test del build empaquetado en esta sesión (pendiente del usuario antes de la pre-release).

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

### Known Issues

- Borrar todos los movimientos de un Periodo elimina su PeriodSummary. Si en algún momento es necesario recalcular el ending balance de algún periodo posterior, podría fallar.
- Sobre PeriodSummary: Cross-period edits leave the old summary stale. update dirties only Period.fromMovement(movement) — the new period (:71). If a user changes a movement's date (into another month) or its envelope, the old period's summary still counts the moved movement and is never marked dirty. Fix shape: read the existing movement first, then markDirty both old and new periods.
- `EnvelopeService.update()` takes a full `Envelope` instance via IPC and persists it wholesale. Architecturally, envelope attributes derived from movements (e.g. running balance) should be computed the same way PeriodSummary is — not hand-edited. The current model works because there are no such derived fields yet, but will need rework once computed envelope attributes exist. Flagged but not blocking.
- Budget/savings-cap snapshot logic (`calculatePeriodSummary` in `period-summary.service.ts`): the freeze-existing-snapshot block reads from the DB inside a calculation function that is also called on creation. Ideally callers would pass the frozen snapshot in (so the function stays pure), with the "freeze vs stamp" decision made at the call site. Left as-is because refactoring requires restructuring the call chain, and the current behavior is correct for now.
- Movement.create creates the movcement on the default account. This might be fine, but then it'd need the "default account" to be changed before creating movements. It's doable, kinda like keeping a session (not updating in the db which the "default" is but like, keep track of, in the current session, what the default account or maybe better selected account is)
- Would be good if you could instantiate PeriodicMovements from the create movement tab. Something like have a "instantiate periodic movement" button or something. This way, when you sit down for the month to catch the app up, you don't need to be going elsewhere, you can just stay in the create movement window until you've input everything. For future consideration.
- PeriodicMovement: The guard only checks the immediately previous month, so the "tentatives form a suffix" invariant it's enforcing has a gap. If month N has a tentative, N+1 is empty/confirmed, and you book a confirmed movement in N+2, then getPrevious(N+2) = N+1 has no tentative → it's allowed, stranding an unconfirmed tentative behind confirmed months. Reachable by deactivating a template after N (so N+1 gets no instance) or deleting N+1's tentative. The ending-balance chain then carries unconfirmed money underneath confirmed periods — exactly what the invariant is meant to prevent. Either scan "any earlier month has a tentative" or document the limitation. No test covers the gap.
  - No se puede confirmar un movimiento en un mes si los meses anteriores tienen movimientos tentativos. Esto se comprueba mirando sólo el mes anterior, que por defecto no es problema, porque entras 5 meses tarde, y te genera tentativos para esos 5 meses, y no te deja confirmarlos hasta que confirmes los anteriores. Sin embargo, sí los puedes borrar. Si entras 5 meses tarde, y borras los movimientos que se creen, hay un hueco de 5 meses sin tentativos. Cuando la guarda compruebe si el mes anterior tiene tentativos, verá que no, y fallará.
- Los `PeriodSummary` a nivel de cuenta y el equivalente para tags/categorías (antes aquí como pendientes) se resolvieron el 06/07 — ver la entrada de esa fecha. Los summaries de cuenta se mantienen de verdad; tags/categorías/filtros arbitrarios se sirven al vuelo como `FilterSummary` (`BasicSummary`, no almacenado).
- Verificar que los movimientos compuestos de tipo isCancelable sólo cuentan como un único movimiento para las estadísticas.

- **Build empaquetado — recarga dura (Ctrl+R / DevTools):** un reload manual del navegador deja la página en blanco (misma causa que el bug de wipe/seed corregido el 10/07: `file://` + `<base href="./">` pierde `index.html`). Las recargas propias de la app ya navegan client-side y están cubiertas; una recarga forzada por el usuario no. Mitigación futura: `loadFile` + `APP_BASE_HREF` fijo, protocolo `app://`, o deshabilitar el atajo de recarga en el build empaquetado.

### Recomendaciones de mayor alcance (fuera de la iteración actual)

Registradas para no perderlas; ninguna es bloqueante.

- **i18n**: el resolver `ErrorTextService` centraliza el texto inglés y `AppErrorCode` ya está cableado en backend — la parte costosa está hecha. Falta integrar `ngx-translate`/`transloco` y mover los catálogos. Coste estimado: ~1.5–2 días.
- **Estilos y animaciones de modales**: `ModalComponent` y los diálogos vía `DialogService` siguen sin animaciones de entrada/salida ni shadows/padding consistentes. Definir el aspecto unificado usando los design tokens existentes.
- **Dashboard**: con `Accounts.getStats()` y `Tags.getForMovements` ya en su sitio, el groundwork para un dashboard agregado está hecho. Falta la ruta `/` con balances por envelope, chips de filtro rápido ("este mes"), y rutas de detalle por envelope/category/account.
- **Exportación CSV** (sin import): ~30 líneas en el renderer; diferido a v0.4 junto con el import.
- **Confirmación de borrado de cuenta tecleando el nombre**: importante para evitar borrados destructivos accidentales (cascada de envelopes + movements + tags).
- **Estados tentativo/confirmado**, **split allocations** (`movement_envelope_allocation`), **plantillas de movimientos periódicos**, **marcado de anomalías**: todos en el spec del vault; asignados a v0.4+.
- **Edición masiva de "movimientos del mes"**, **excluir presupuestos del total**, **atajos de teclado**: parking lot.
- Set starting balance for envelopes as part of account creation: give the user the ability to create envelopes at the same time as they create the account, and assign the starting balance in the account across the different created envelopes. Envelopes created in any other way must have startingBalance=0.

---
