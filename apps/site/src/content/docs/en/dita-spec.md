---
title: DITA 1.3 quick reference
description: "An author-facing DITA 1.3 technical-content reference: topic-type content models, common elements and attributes, maps and keys, DITAVAL, naming conventions, and the mistakes DTD validation catches."
updated: '2026-11-28'
---

This page is not a substitute for the specification; it is **the page you open while writing**: required structure for the four topic types, the elements and attributes you actually use, how maps and keys fit together, and the points where DTD validation most often fails. The authoritative text is always [OASIS DITA 1.3 Part 2: Technical Content Edition](https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part2-tech-content.html) and [Part 3: All-Inclusive Edition](https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part3-all-inclusive.html).

The in-app **Help → DITA 1.3 reference** is generated from the same source: element names, descriptions and required attributes come from the `@dita/core` element registry and content models, so you are always checking against the same rules the validator uses.

## The four topic types

| Type | Use it for | Required structure | Body container |
| --- | --- | --- | --- |
| `<concept>` | explaining "what it is": theory, models, background | `<title>` | `<conbody>` |
| `<task>` | writing "how to do it": executable steps | `<title>` | `<taskbody>` |
| `<reference>` | listing "parameters and specs": CLI, API, fields | `<title>` | `<refbody>` |
| `<topic>` | generic container when the type is undecided | `<title>` | `<body>` |

Pick by **content intent**, not length: the reader should *understand* after a concept, *act* after a task, and *look something up* in a reference. Mixing types is expensive in DITA because the body content models differ completely.

The shell every topic shares:

```text
topic      = (title, titlealts?, (shortdesc | abstract)?, prolog?, body?, related-links?)
concept    = (title, titlealts?, (shortdesc | abstract)?, prolog?, conbody?, related-links?, concept*)
task       = (title, titlealts?, (shortdesc | abstract)?, prolog?, taskbody?, related-links?, task*)
reference  = (title, titlealts?, (shortdesc | abstract)?, prolog?, refbody?, related-links?, reference*)
```

## Ordered content models

Only containers that genuinely have an order need memorising; everything else is an unordered `|` choice.

```text
conbody    = ((body.cnt)*, (section | example | conbodydiv)*)
taskbody   = (prereq?, context?, (steps | steps-unordered)?, result?,
              tasktroubleshooting?, example?, postreq?)
refbody    = (refsyn | properties | section | example | simpletable | table | refbodydiv)*
ul         = (title?, (li)+)          // at least one <li>
ol         = (title?, (li)+)
table      = (title?, desc?, tgroup+)
```

`<taskbody>` is the strict task model (`strictTaskbodyConstraint.mod`). If you really need free ordering, the shell has to switch to `generalTask.dtd` / `ditabase.dtd` — the workbench models both as the strict and general task models, and validation and the insert menu switch together with the shell.

## Common block elements

| Element | Purpose |
| --- | --- |
| `<p>` | paragraph. It may hold inline content and blocks, but each body container has its own rules |
| `<shortdesc>` | one or two sentences on why the topic matters; feeds search snippets and map previews |
| `<section>` | titled section; cannot nest `<section>` (use `<sectiondiv>`) |
| `<example>` | example area, usually at the end of the body |
| `<note>` | admonition; `type="note/tip/important/warning/danger"` sets the emphasis |
| `<ul>` / `<ol>` / `<li>` | unordered / ordered lists |
| `<dl>` / `<dlentry>` / `<dt>` / `<dd>` | definition lists |
| `<fig>` / `<image>` | figures and images, `href` relative |
| `<table>` | CALS table: `<tgroup>` → `<colspec>` → `<thead>` / `<tbody>` → `<row>` → `<entry>` |
| `<simpletable>` | simple tables without spanning |
| `<codeblock>` | code, whitespace preserved (`xml:space="preserve"`) |
| `<lines>` | preserved line breaks without monospaced styling |
| `<xref>` | cross reference via `href` or `keyref` |

## Common inline elements

| Element | Purpose |
| --- | --- |
| `<b>` `<i>` `<u>` | bold, italic, underline |
| `<codeph>` | inline code |
| `<cmdname>` | command name |
| `<filepath>` | path |
| `<userinput>` | user input |
| `<systemoutput>` | system output |
| `<wintitle>` | window or dialog title |
| `<keyword>` | keyword; participates in keyref and search |
| `<ph>` | phrase container, handy for `conref` / `keyref` |
| `<term>` | term |
| `<option>` | option / parameter name |
| `<apiname>` | API name |
| `<fn>` | footnote |

## Common attributes

| Attribute | Purpose |
| --- | --- |
| `id` | element identifier. **Required** on the topic root; on inner elements only when something references it via conref / xref |
| `xml:lang` | content language on the root element, e.g. `zh-CN` / `en-US` |
| `conref` | content reference to a reusable fragment's `id` |
| `conkeyref` | indirect reference through a key; moving content only changes the key definition |
| `keyref` | key reference for keywords or links; wins over `href` when both are present |
| `href` | target: relative path or external URL |
| `scope` | `local` / `peer` / `external`; external links must say `external` |
| `format` | target format such as `dita` / `html` / `pdf` / `markdown` |
| `audience` | audience condition, filtered by DITAVAL |
| `platform` | platform condition |
| `product` | product condition |
| `props` | custom conditional attribute (often specialized) |
| `outputclass` | output styling hook used by themes |
| `importance` | content importance (`required` / `recommended` / `optional`) |

Naming and file conventions:

- Lowercase English file names, underscore-separated, prefixed by type: `concept_rbac_model.dita`, `task_install_server.dita`, `reference_api_errors.dita`.
- The root `id` matches the file stem so it stays unique across manuals.
- One `<title>` per topic; a one- or two-sentence `<shortdesc>`.
- Put `xml:lang` on the root element; write Chinese and English as separate topics instead of mixing languages with `translate="no"`.

## Maps, topicref and keys

```xml
<map id="map_product_guide" xml:lang="zh-CN">
  <topicmeta>
    <shortdesc>Product manual master map.</shortdesc>
  </topicmeta>

  <topichead navtitle="Getting started">
    <topicref href="concepts/product_overview.dita"/>
    <topicref href="tasks/install_server.dita"/>
  </topichead>

  <topicref href="references/api_errors.dita" keys="api-errors"/>
  <keydef keys="product_name" href="concepts/glossary_product.dita#glossary_product/prod_name"/>
</map>
```

- `topicref` defines both the navigation tree and the merged output order; `topichead` only groups.
- `keys` names something a `keyref` can point at; `keydef` defines a key that stays out of navigation.
- When a key is redefined deeper in the map, **the nearest definition wins** — the usual trick for reusing one topic set across products.
- Missing keys and `topicref`s pointing at absent files show up in cross-file diagnostics with file and line.

## DITAVAL conditional processing

```xml
<val>
  <prop att="audience" val="internal" action="exclude"/>
  <prop att="platform" val="windows" action="include"/>
  <prop att="product" val="legacy" action="flag" color="red" backcolor="yellow"/>
</val>
```

- `action` is one of `include`, `exclude` or `flag`.
- Filtering only affects rendering and the publish projection; it **never removes conditional attributes from the XML**.
- Rules are evaluated in document order, `exclude` before `flag`.

## Reuse and specialization

- **conref**: `<ph conref="../common/reuse.dita#reuse/prod_name"/>` takes the referenced element itself.
- **conkeyref**: `<ph conkeyref="product_name"/>` turns "which file" into "which key".
- **Specialization**: DTD/RNG constraint modules define new element types and attribute domains, and the `class` attribute keeps the inheritance chain. The workbench passes unmodelled elements through as `unknown_block` / `unknown_inline`, so specialized content survives round-trips.

## Frequent mistakes

1. **Writing `<section>` before paragraphs inside `<conbody>`**: ordered models require blocks first; the diagnostic reports `child-out-of-order`.
2. **Wrapping a whole procedure in `<p>`**: task semantics and PDF/HTML layout both depend on `<steps>` / `<step>` / `<cmd>`.
3. **Putting `<p>` / `<ul>` directly in `<refbody>`**: `refbody` accepts only `refsyn` / `properties` / `section` / `example` / `simpletable` / `table` / `refbodydiv`; base blocks belong inside `<section>` or `<refsyn>`.
4. **Putting `<properties>` inside `<section>`**: it hangs directly off `<refbody>` or `<refbodydiv>` and has no `<title>`.
5. **Putting `<example>` inside `<section>`**: `section.cnt` excludes `example`; group with `<sectiondiv>` instead.
6. **Using tables for layout**: express spans with `namest` / `nameend` / `morerows`, not empty cells.
7. **Conditional attributes on conref targets**: the reference takes the element itself, so extra `audience` / `props` can filter differently than you expect.
8. **Editing reused content in the projection**: the projection is read-only; edit the source fragment or the next resolution overwrites it.

## Authoritative references

- [OASIS DITA 1.3 Part 2: Technical Content Edition](https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part2-tech-content.html) — element content models, attributes and semantics
- [OASIS DITA 1.3 Part 3: All-Inclusive Edition](https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part3-all-inclusive.html) — LangRef plus the full specification text
- [DITA Open Toolkit documentation](https://www.dita-ot.org/) — the validation and publishing toolchain, plugins and release notes
