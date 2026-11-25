# HTML5 publish themes

Static assets shipped with every DITAEditor HTML5 publish. The API copies this
tree into the DITA-OT output as `_ditaeditor/` and injects a small header/search
shell around the unmodified DITA-OT topic markup. **There is no build step** —
these files are hand-written CSS and one classic (non-module) script, served
verbatim.

```text
dita-ot-plugins/html5-themes/
├── shared/
│   ├── theme-base.css     # layout + chrome + all DITA content styles
│   └── theme-runtime.js   # builds the layout, search, TOC, copy, pager, portal
├── tech-docs/theme.css
├── editorial-paper/theme.css
├── enterprise-manual/theme.css
└── dev-dark/theme.css
```

At publish time the output contains:

```text
_ditaeditor/theme-base.css     <- shared/theme-base.css
_ditaeditor/theme.css          <- <themeId>/theme.css
_ditaeditor/brand-vars.css     <- generated per project (accent overrides)
_ditaeditor/theme-runtime.js   <- shared/theme-runtime.js
_ditaeditor/search-index.js    <- sets window.__DITA_SEARCH_INDEX__
_ditaeditor/custom.css         <- optional, loaded last, never overwritten
```

## File contract

The runtime is injected against this markup; class names and data attributes are
part of the contract and must stay stable.

```html
<html data-de-theme="tech-docs" data-de-root="../../" data-de-mode="light" data-de-portal="false">
<body class="topic de-theme-tech-docs">
  <header class="de-header">
    <a class="de-brand" href="...#root-relative"><img class="de-logo" alt=""> <span class="de-brand-title">Title</span></a>
    <div class="de-header-actions">
      <button class="de-icon-btn de-search-trigger" data-de="search-trigger"><span class="de-kbd">Ctrl K</span></button>
      <button class="de-icon-btn de-mode-toggle" data-de="mode-toggle"></button>
    </div>
    <button class="de-icon-btn de-nav-toggle" data-de="nav-toggle"></button>
  </header>
  <!-- DITA-OT <main role="main"> plus, on the map root, <nav class="toc"> -->
  <footer class="de-footer"><p>…</p></footer>
  <div class="de-search" data-de="search" hidden></div>
  <div class="de-backdrop" data-de="backdrop" hidden></div>
  <script src="../../_ditaeditor/search-index.js" defer></script>
  <script src="../../_ditaeditor/theme-runtime.js" defer></script>
</body>
</html>
```

- `data-de-theme` — active theme id; selects the palette. Output pages also
  carry `body.de-theme-<themeId>` for theme-specific hooks.
- `data-de-root` — relative path from the current page back to the output root
  (always ends with `/`). All runtime-resolved links use it.
- `data-de-mode` — `light` or `dark`; set by the runtime on `<html>` and
  persisted in `localStorage["de-color-mode"]`. A theme may declare its own
  default (see `dev-dark`). No `prefers-color-scheme` query is used anywhere, so
  an explicit mode always wins over the OS setting.
- `data-de-portal` / `body.de-portal` — the map root page renders a card grid
  instead of a reading layout.
- `window.__DITA_THEME_CONFIG__` — `{ themeId, locale, siteTitle, defaultMode,
  portal, features: { search, toc, codeCopy, colorModeToggle }, labels: { … } }`.
  Labels (all optional, English fallback): `search`, `searchPlaceholder`,
  `noResults`, `clear`, `copy`, `copied`, `onThisPage`, `menu`, `close`,
  `themeToggle`, `prev`, `next`, `shortcutHint`.
- `window.__DITA_SEARCH_INDEX__` — `[{ href, title, summary, text }]`; `href`
  is root-relative.

### Design tokens

`theme-base.css` renders nothing but through custom properties defined on
`html[data-de-theme]`. A theme file only sets variables (plus optional
flourishes on DITA-OT's own classes):

`--de-accent`, `--de-accent-hover`, `--de-accent-soft`, `--de-accent-border`,
`--de-accent-contrast`, `--de-bg`, `--de-surface`, `--de-surface-2`,
`--de-header-bg`, `--de-text`, `--de-text-muted`, `--de-border`, `--de-code-bg`,
`--de-radius`, `--de-shadow`, `--de-font-sans`, `--de-font-mono`,
`--de-content-width`, `--de-sidebar-width`, `--de-onpage-width`.

Internal tokens (`--de-link`, `--de-header-text`, `--de-bar`, note palettes, …)
have base defaults and only need overriding in a theme when the default does not
contrast well. `brand-vars.css` is emitted after `theme.css` and re-declares the
accent family at `:root[data-de-theme]`, so a project's brand colour wins over
the theme without touching it.

## Adding a theme

1. Create `dita-ot-plugins/html5-themes/<theme-id>/theme.css`.
2. Define the light palette in `:root[data-de-theme="<theme-id>"] { … }` and,
   if the theme needs its own dark treatment, in
   `html[data-de-theme="<theme-id>"][data-de-mode="dark"] { … }`.
3. Keep everything else out of the file: layout, chrome, responsive rules,
   print styles and content markup styles are shared. Flourishes must be scoped
   under `html[data-de-theme="<theme-id>"]` so they cannot leak.
4. Register the id in the theme registry (server-side; see
   `docs/phase12-html-themes-plan.md`) so the API can copy the directory.
5. Check contrast: body text ≥ 4.5:1 on `--de-bg` and `--de-surface`, accent
   text on tinted rows via `--de-link`.

No bundler, no Sass, no PostCSS: plain CSS with hand-written fallbacks
(no `color-mix()`, no nesting).

## Feature flags

Each flag defaults to `true`; set it to `false` in `features` to switch it off.

| Flag | Off means |
| --- | --- |
| `search` | No search overlay, no `Ctrl/⌘ K` handler, search button hidden. |
| `toc` | No on-page right rail and no scroll-spy. |
| `codeCopy` | No copy buttons on `<pre>` blocks. |
| `colorModeToggle` | Light/dark switch hidden; `data-de-mode` still applied. |

## Runtime behaviour

The script is a classic IIFE (no imports, `file://`-safe) that runs once on
`DOMContentLoaded` and is idempotent via `body[data-de-runtime]`. It re-parents
the DITA-OT markup into `div.de-layout > aside.de-sidebar | main.de-main |
aside.de-onpage`, keeping header, footer, search overlay and backdrop outside
the grid. Everything degrades gracefully: a page without `<nav class="toc">` or
without `<h2>` headings simply loses the corresponding rail.

## Implementation notes

- Every table is wrapped in `.de-table-wrap` so wide CALS tables scroll instead
  of breaking the page. A horizontal scroller is the sticky containing block, so
  `thead th { position: sticky }` only tracks that wrapper — page-level sticky
  table heads are not attempted.
- Sidebar branch state is kept in `sessionStorage["de-nav-state"]` (collapsed
  hrefs, pipe-joined); the active branch is always expanded on load.
- The skip link is labelled from `document.title` (then `siteTitle`) because the
  label contract has no dedicated key for it.
- Runtime DOM is built with `createElement`/`textContent` only: no `innerHTML`
  with index content, so titles from the search index can never inject markup.
