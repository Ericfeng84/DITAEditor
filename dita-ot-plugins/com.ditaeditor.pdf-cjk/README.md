# com.ditaeditor.pdf-cjk

Pure-XML DITA-OT 4.x plugin that makes `org.dita.pdf2` (PDF2 → Apache FOP) produce Chinese
(or Japanese / Korean) PDFs with embedded Noto CJK fonts. No Java code, no XSLT overrides:
the plugin only contributes a catalog entry (`catalog.xml`) that replaces
`cfg/fo/font-mappings.xml`, plus the FOP configuration used by `@dita/api`.

```text
plugin.xml                       # require org.dita.pdf2 + catalog.relative feature
catalog.xml                      # cfg:fo/font-mappings.xml -> this plugin's copy
cfg/fo/font-mappings.xml         # logical Sans/Serif/Monospaced -> Noto CJK physical fonts
fop.xconf                        # fallback FOP font table (see below)
```

`@dita/api` always loads this plugin through `--customization.dir` instead of `dita install`,
so a different global Catalog ordering can never shadow it.

## Why the FOP configuration looks the way it does

Two behaviours of Apache FOP 2.9 (the version bundled with DITA-OT 4.2.x) decide everything:

1. **`sub-font` is matched against a face's *full name* — name table ID 4 — with an exact string
   comparison** (`OpenFont.checkTTC`). That name carries the weight and the region:
   `NotoSansCJK-Regular.ttc` reports `Noto Sans CJK SC`, while `NotoSansCJK-Bold.ttc` reports
   `Noto Sans CJK SC Bold`. Registering the family name for a bold file fails with

   ```text
   java.io.IOException: Name does not exist in the TrueType collection: Noto Sans CJK SC
     at org.apache.fop.fonts.truetype.OpenFont.readFont(OpenFont.java:833)
   ```

2. **FOP cannot embed a `ttc`/`otc` collection with CFF outlines at all.**
   `OFFontLoader.read()` picks its parser from the first four bytes of the file: only a literal
   `OTTO` header becomes an `OTFFile`. Every collection starts with `ttcf`, so it is parsed as
   TrueType and dies in `readIndexToLocation`:

   ```text
   java.io.IOException: 'loca' table not found, happens when the font file doesn't contain
   TrueType outlines (trying to read an OpenType CFF font maybe?)
   ```

   Debian's `fonts-noto-cjk` ships **only** such collections
   (`NotoSansCJK-{Regular,Bold}.ttc`, `NotoSerifCJK-{Regular,Bold}.ttc`; the
   `Noto Sans Mono CJK *` faces live *inside* the Sans collections — there is no
   `NotoSansMonoCJK-*.ttc` file). Consequently no configuration that registers a `.ttc` can
   ever produce a PDF.

So `@dita/api` materialises faces instead of referencing collections
(`apps/api/src/modules/dita-ot/fop-font-config.ts`):

1. `discoverNotoCjkFontFiles()` reads every Noto CJK font file's `name` table
   (`font-collections.ts`, pure Node).
2. `planNotoFopFonts()` picks one face per `Noto {Sans,Serif,Sans Mono} CJK {SC,JP,KR}` ×
   `{normal,bold}` × `{normal,italic}` triplet — 36 triplets over 18 faces, matching the
   char-sets in `cfg/fo/font-mappings.xml`.
3. `materializeNotoFopFonts()` repacks each chosen face into a standalone `OTTO` file under
   `<job>/fonts/`, cached by source path + size + mtime in the temp dir and hard-linked into the
   job, so repeated publishes cost almost nothing.
4. The job-local `fop.xconf` gets `<font-base>` pointed at `<job>/fonts/` and its font table
   replaced with one entry per triplet.

**Keep three places in sync** when changing font coverage:

- `cfg/fo/font-mappings.xml` — logical families and `char-set` entries,
- `BASE_FAMILIES` / `REGIONS` in `apps/api/src/modules/dita-ot/fop-font-config.ts`,
- the fallback table in `fop.xconf`.

## The fallback table

`fop.xconf` in this directory is only used when no face could be materialised (for example a
local machine with no Noto CJK installed). It therefore references single-face Google-style OTF
names (`NotoSansCJKsc-Regular.otf`, …) under `/usr/share/fonts/opentype/noto`: the layout you get
from the Noto CJK "language-specific OTF" download, macOS/Windows manual installs. Point
`DITAEDITOR_NOTO_CJK_DIR` (or install the fonts) and the API generates a working table instead.

## Runtime prerequisites

The image (and any host that publishes PDFs) needs **both**:

| Package | Why |
| --- | --- |
| `fontconfig` | Headless Java reads `/etc/fonts/fonts.conf` to enumerate families, and Batik — which PDF2 uses to render SVG images — does that on its first render. `node:*-slim` ships no `/etc/fonts` at all, so the build fails with `java.lang.RuntimeException: Fontconfig head is null, check your fonts or fonts configuration` from `org.apache.batik.bridge.DefaultFontFamilyResolver.<clinit>`. Note that `fonts-noto-cjk` has **no** `Depends:` on it. |
| `fonts-noto-cjk` (+ `-extra`) | the actual CJK faces the API extracts per publish |

Run `fc-cache -f` once after installing the fonts so Batik's enumeration and FOP see the same
cache. On a Debian host without `fonts-noto-cjk`, FOP still parses its configuration (the font
table is generated per job) but CJK glyphs fall back to a Latin font, which is the other symptom
users report.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DITAEDITOR_PDF_PLUGIN_DIR` | `dita-ot-plugins/com.ditaeditor.pdf-cjk` | passed as `--customization.dir` |
| `DITAEDITOR_FOP_XCONF` | `<plugin dir>/fop.xconf` | template configuration |
| `DITAEDITOR_NOTO_CJK_DIR` | auto-detected | Noto CJK font directory to materialise from |

When publishing fails on fonts, the job error is prefixed with `publish.fontError` (missing faces)
or `publish.fontconfigError` (missing `fontconfig`; `apps/api/src/i18n/messages.ts`), which names
the fix instead of only printing `[PDFX013F] The PDF file ... cannot be generated.`
