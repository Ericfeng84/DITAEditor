# PDF theme assets (Phase 15)

Exported XSLT assets that give `@dita/api` PDF publishing five visual themes without installing a
DITA-OT plug-in.

At publish time `apps/api/src/modules/publish/pdf-customization.ts` writes a job-local
`customization/` directory (never touching the shared checkout) and passes it to DITA-OT as
`--customization.dir`. DITA-OT places that directory's `catalog.xml` first on the catalog path, so
three PDF2 URIs are redirected at the staged files:

| catalog URI                 | staged file                    |
| --------------------------- | ------------------------------ |
| `cfg:fo/attrs/custom.xsl`  | `fo/attrs/custom.xsl` (generated) |
| `cfg:fo/xsl/custom.xsl`    | `fo/xsl/custom.xsl` (generated)   |
| `cfg:fo/font-mappings.xml` | `cfg/fo/font-mappings.xml` (copied from `com.ditaeditor.pdf-cjk`) |

```text
<job>/customization/
├── catalog.xml
├── cfg/fo/font-mappings.xml          # CJK fonts, copied verbatim from com.ditaeditor.pdf-cjk
├── common/artwork/logo.<ext>         # optional, staged cover logo
└── fo/
    ├── attrs/
    │   ├── custom.xsl                # generated: imports base -> theme -> theme-vars
    │   ├── theme-vars.xsl            # generated: the job's resolved options as XSLT variables
    │   └── … (imports from this package)
    └── xsl/
        └── custom.xsl                # generated: imports ../attrs/custom.xsl, includes xsl-base.xsl
```

## Package layout

```text
dita-ot-plugins/pdf-themes/
├── shared/
│   ├── attrs-base.xsl   # design tokens + attribute sets shared by all themes
│   └── xsl-base.xsl     # structural overrides (cover, headers/footers, page masters, TOC toggle)
├── tech-manual/attrs.xsl
├── enterprise-spec/attrs.xsl
├── editorial-book/attrs.xsl
└── compact-guide/attrs.xsl
```

`vanilla` has no directory here: it publishes with the `com.ditaeditor.pdf-cjk` directory
unchanged, so pre-Phase-15 output is reproduced bit for bit.

## Import chain

```text
fo/attrs/custom.xsl   imports → shared/attrs-base.xsl
                                <theme>/attrs.xsl
                                theme-vars.xsl            (highest precedence: user options win)
fo/xsl/custom.xsl     imports → ../attrs/custom.xsl
                      includes → shared/xsl-base.xsl
```

Two details are load-bearing:

1. **`xsl:import`, not `xsl:include`, between the attribute layers.** `xsl:include` merges modules at
   the *same* precedence, and the layers intentionally declare the same variables
   (`$de-accent`, `$de-title-rule`, …). With `xsl:include` Saxon reports a static error
   `XTSE0630` (duplicate global variable); with a nested `xsl:import` chain the later module simply
   wins, which is exactly the "user options beat theme defaults beat base defaults" order.
2. **`xsl:include` for `xsl-base.xsl`.** A variable reference inside an *imported* module binds only
   to that module's own imports, so `$de-page-width`, `$de-font-size`, … would be out of scope.
   Including the structural overrides merges them into the customizing module, whose import chain
   carries `theme-vars.xsl`.

## Tokens

`shared/attrs-base.xsl` declares the defaults; `<theme>/attrs.xsl` overrides them; the generated
`theme-vars.xsl` overrides them again with the job's resolved options.

| Variable | Meaning |
| --- | --- |
| `$de-page-width`, `$de-page-height` | page size (`A4` / `Letter` / `B5`) |
| `$de-page-margin-inside/-outside/-top/-bottom` | margin preset (`compact` / `normal` / `wide`) |
| `$de-font-size`, `$de-font-family` | body size (`9pt`/`10pt`/`11pt`) and `Sans`/`Serif` |
| `$de-accent`, `$de-accent-soft`, `$de-accent-border`, `$de-accent-contrast` | accent scale |
| `$de-cover-enabled`, `$de-toc-enabled` | `showCover`, `showToc` |
| `$de-chapter-numbers`, `$de-task-labels` | numbering in titles, DITA-OT task labels |
| `$de-mirror-margins` | duplex mirroring of inside/outside margins and header/footer sides |
| `$de-cover-style` | `left-accent` / `navy-band` / `editorial-center` / `compact-header` / `none` |
| `$de-cover-subtitle`, `$de-header-text`, `$de-footer-text`, `$de-logo-uri` | user strings |

## What cannot be overridden

PDF2 declares page geometry, cover, TOC and margin mirroring as *plain* `xsl:variable`s in its
`basic-settings.xsl` (imported only by `topic2fo.xsl`), so they are invisible from a customization
stylesheet and have no Ant parameter. `xsl-base.xsl` therefore re-implements the small set of
structure hooks that consume them:

| pdf2 hook | Why it is reimplemented |
| --- | --- |
| `mode="create-page-masters"` | page size + margins + which flow names each master declares |
| `generate-page-sequence-master` | odd/even page sequences are only emitted when mirroring |
| `createFrontMatter` | honour `showCover` |
| `match="/" mode="toc"` | honour `showToc` (an empty TOC tree makes pdf2 skip the page sequence) |
| `insertBodyStaticContents` | odd/even header+footer only when mirroring |
| `match="…/topic/title" mode="getTitle"` | chapter numbering |
| `match="…/topic/note"` | accent bar / outline notes around pdf2's own localized labels |

Named-template overrides cannot delegate with `xsl:next-match` (it resolves no lower-precedence
named template), so each hook above is either fully reimplemented or wraps a *template rule* that
can.

## Adding a theme

1. Create `pdf-themes/<id>/attrs.xsl` that only sets tokens (`$de-accent`, `$de-title-rule`, …) and
   overrides attribute sets already declared in `shared/attrs-base.xsl` (plus `base-font`, which
   must live in the module that sees the tokens).
2. Add `<id>` to `PDF_THEME_IDS`, `PDF_THEME_DEFINITIONS`, `pdfThemeIdSchema` and the label/tag key
   maps in `apps/api/src/modules/publish/pdf-themes.ts`.
3. Add `publish.pdfTheme.<id>.{name,description}` to both catalogues in
   `apps/api/src/i18n/messages.ts`.
4. Verify with a real build:
   `dita --input=product-manual.ditamap --format=pdf --customization.dir=<dir>` (see
   `apps/api/test/phase15-pdf-themes.test.ts`).

## Constraints

- No user-supplied XSLT paths: only these exported files are ever imported.
- Every generated XML file is validated with `checkXmlWellFormed()` from `@dita/core` before the
  build starts.
- Logos must be `.png`, `.jpg`, `.jpeg` or `.svg` and ≤ 2 MB (FOP 2.9 cannot decode WebP). A
  rejected logo downgrades to a `# pdf theme warning:` line in the build log instead of failing.
- `com.ditaeditor.pdf-cjk/cfg/fo/font-mappings.xml` is always copied; dropping it makes Simplified
  Chinese PDFs fall back to a font without the required glyphs.
