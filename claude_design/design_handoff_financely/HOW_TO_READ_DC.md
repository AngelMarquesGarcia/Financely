# How to read a `.dc.html` design reference

Each file is one component or page. You can open any of them directly in a browser
to see it render. For implementation, read the source — it has three parts.

## 1. The template (markup) — between `<x-dc>` and `</x-dc>`
This is the layout. **All styling is inline** (`style="…"`), so every color,
size, spacing, font-weight, radius and shadow is a literal you can copy straight
into your Angular template/styles. A few custom tags describe structure and are
NOT real HTML — translate them to Angular equivalents:

- `{{ path }}` — a value hole (dotted lookup only, e.g. `{{ item.name }}`).
  Filled by the logic block's `renderVals()`. → Angular interpolation / binding.
- `<sc-for list="{{ items }}" as="item">…</sc-for>` — a loop. `$index` is in
  scope inside. → `*ngFor` / `@for`.
- `<sc-if value="{{ cond }}">…</sc-if>` — conditional render. → `*ngIf` / `@if`.
- `<dc-import name="StatCard" prop="{{ x }}"></dc-import>` — mounts another
  component from this bundle (`StatCard.dc.html`). kebab-case attrs are its props.
  → an Angular child component with `@Input()`s.
- `onClick="{{ handler }}"` — event binding (JSX-camelCase). → `(click)`.
- `hint-*` attributes (`hint-size`, `hint-placeholder-count`) are
  **preview-only** streaming hints — **ignore them**, they carry no design meaning.
- `<helmet>…</helmet>` at the top holds `<link>` font imports and a small
  `<style>` block for things that can't be inline: `@keyframes`, `@font-face`,
  and body resets. Port the keyframes; the font is Nunito.

## 2. The logic block — `<script … data-dc-script>` at the bottom
`class Component extends DCLogic { … }`. Plain JS. Read it for **behavior only**:
- `state = {…}` — the component's local UI state.
- `renderVals()` — computes the values the template's `{{ }}` holes consume, and
  the event handlers. This is where interaction logic, derived/formatted values,
  and conditional styling live.
- `componentDidMount()` — most components do
  `this.lib = await import('./finance-lib.js')` to get data + formatters.
- Lifecycle mirrors React class components (minus `render`). `this.props` are the
  attributes passed in via `<dc-import>`.

Don't port this class literally — read it to understand what the component
computes and how it reacts to clicks, then implement idiomatically in Angular.

## 3. The props metadata — `data-props="…"` on the script tag
HTML-escaped JSON describing each prop the component accepts: its `editor` type,
`default`, `tsType`, and (for enums) `options`. This is your **`@Input()` spec** —
`tsType` gives you the TypeScript type to use directly. `$preview` is just the
authoring preview size; ignore it.

## What to ignore entirely
- `support.js` (not in this bundle) — the preview runtime.
- `<script src="./support.js">`, the `<!DOCTYPE>`/`<head>` wrapper, `hint-*`
  attrs, and `$preview` — all authoring-tool plumbing, no design intent.
