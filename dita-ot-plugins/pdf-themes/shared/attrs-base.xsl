<?xml version="1.0" encoding="UTF-8"?>
<!--
  DITAEditor shared PDF attribute-set base (Phase 15).

  Import precedence (see README.md): this module is imported FIRST, then the
  theme module (`<theme>/attrs.xsl`), then the job-local `theme-vars.xsl` that
  `pdf-customization.ts` generates from the user's options. Later imports win,
  so a theme can restyle the base and a user can still override the theme.

  Every PDF property below is driven by design tokens (`$de-*`) plus the DITA-OT
  page-geometry variables (`$page-width`, `$page-margin-*`, `$default-font-size`
  ...) that `theme-vars.xsl` re-declares with the user's paper size, margins and
  font size. Logical font names (Sans / Serif / Monospaced) are the ones declared
  by `com.ditaeditor.pdf-cjk/cfg/fo/font-mappings.xml`, so Latin + CJK + code all
  resolve to extracted Noto CJK faces (FOP cannot read `.ttc` collections).
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fo="http://www.w3.org/1999/XSL/Format"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                version="3.0"
                exclude-result-prefixes="#all">

  <!-- ============================================================
       Design tokens - lowest precedence defaults (theme + user win)
       ============================================================ -->
  <xsl:variable name="de-font-key" select="'sans'"/>
  <xsl:variable name="de-font-family" select="if ($de-font-key = 'serif') then 'Serif' else 'Sans'"/>
  <xsl:variable name="de-heading-family" select="$de-font-family"/>
  <xsl:variable name="de-mono-family" select="'Monospaced'"/>
  <xsl:variable name="de-code-font-size" select="'88%'"/>

  <xsl:variable name="de-accent" select="'#0f766e'"/>
  <xsl:variable name="de-accent-soft" select="'#ecfdf5'"/>
  <xsl:variable name="de-accent-border" select="'#99f6e4'"/>
  <xsl:variable name="de-accent-contrast" select="'#ffffff'"/>
  <xsl:variable name="de-text" select="'#111827'"/>
  <xsl:variable name="de-muted" select="'#6b7280'"/>
  <xsl:variable name="de-border" select="'#e5e7eb'"/>
  <xsl:variable name="de-code-bg" select="'#f6f8fa'"/>
  <xsl:variable name="de-table-head-bg" select="'#f1f5f9'"/>
  <xsl:variable name="de-title-color" select="'#111827'"/>

  <xsl:variable name="de-cover-style" select="'left-accent'"/>
  <xsl:variable name="de-cover-subtitle" select="''"/>
  <xsl:variable name="de-header-text" select="''"/>
  <xsl:variable name="de-footer-text" select="''"/>
  <xsl:variable name="de-logo-uri" select="''"/>
  <xsl:variable name="de-chapter-numbers" select="false()"/>
  <xsl:variable name="de-task-labels" select="false()"/>
  <xsl:variable name="de-note-style" select="'bar'"/>
  <xsl:variable name="de-table-frame" select="'hairline'"/>
  <xsl:variable name="de-note-bg" select="'#f8fafc'"/>
  <xsl:variable name="de-cover-meta-gap" select="'48mm'"/>
  <xsl:variable name="de-header-rule" select="'0.5pt'"/>
  <xsl:variable name="de-title-rule" select="'2pt'"/>
  <xsl:variable name="de-chapter-title-size" select="'20pt'"/>
  <xsl:variable name="de-section-title-size" select="'13pt'"/>
  <xsl:variable name="de-body-align" select="'start'"/>
  <xsl:variable name="de-line-height" select="'140%'"/>

  <!-- ============================================================
       Root + base typography
       ============================================================ -->
  <xsl:attribute-set name="__fo__root" use-attribute-sets="base-font">
    <xsl:attribute name="font-family" select="$de-font-family"/>
    <xsl:attribute name="color" select="$de-text"/>
    <xsl:attribute name="background-color">white</xsl:attribute>
    <xsl:attribute name="line-height" select="$de-line-height"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.block">
    <xsl:attribute name="space-before">3pt</xsl:attribute>
    <xsl:attribute name="space-after">3pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="body">
    <xsl:attribute name="line-height" select="$de-line-height"/>
    <xsl:attribute name="space-before">0pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="p">
    <xsl:attribute name="space-before">3pt</xsl:attribute>
    <xsl:attribute name="space-after">6pt</xsl:attribute>
    <xsl:attribute name="line-height" select="$de-line-height"/>
    <xsl:attribute name="text-align" select="$de-body-align"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="shortdesc">
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="font-size">105%</xsl:attribute>
    <xsl:attribute name="space-after">8pt</xsl:attribute>
    <xsl:attribute name="line-height" select="$de-line-height"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic__shortdesc" use-attribute-sets="shortdesc"/>

  <!-- ============================================================
       Titles
       ============================================================ -->
  <xsl:attribute-set name="common.title">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
    <xsl:attribute name="line-height">125%</xsl:attribute>
    <xsl:attribute name="keep-with-next.within-column">always</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-chapter-title-size"/>
    <xsl:attribute name="space-before">2pt</xsl:attribute>
    <xsl:attribute name="space-after">10pt</xsl:attribute>
    <xsl:attribute name="padding-bottom">4pt</xsl:attribute>
    <xsl:attribute name="border-after-width" select="$de-title-rule"/>
    <xsl:attribute name="border-after-style">solid</xsl:attribute>
    <xsl:attribute name="border-after-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-section-title-size"/>
    <xsl:attribute name="space-before">14pt</xsl:attribute>
    <xsl:attribute name="space-after">6pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.topic.topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size">11.5pt</xsl:attribute>
    <xsl:attribute name="space-before">10pt</xsl:attribute>
    <xsl:attribute name="space-after">4pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.topic.topic.topic.title" use-attribute-sets="topic.topic.topic.title">
    <xsl:attribute name="font-size">105%</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.topic.topic.topic.topic.title" use-attribute-sets="topic.topic.topic.topic.title"/>

  <xsl:attribute-set name="section.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-section-title-size"/>
    <xsl:attribute name="space-before">12pt</xsl:attribute>
    <xsl:attribute name="space-after">6pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.title__content"/>

  <xsl:attribute-set name="de.title.number">
    <xsl:attribute name="color" select="$de-accent"/>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
  </xsl:attribute-set>

  <!-- ============================================================
       Lists, links, definitions
       ============================================================ -->
  <xsl:attribute-set name="ul">
    <xsl:attribute name="space-before">4pt</xsl:attribute>
    <xsl:attribute name="space-after">6pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="ul.li">
    <xsl:attribute name="space-before">2pt</xsl:attribute>
    <xsl:attribute name="space-after">2pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="ul.li__label">
    <xsl:attribute name="color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="ol" use-attribute-sets="ul"/>

  <xsl:attribute-set name="ol.li" use-attribute-sets="ul.li"/>

  <xsl:attribute-set name="ol.li__label">
    <xsl:attribute name="color" select="$de-accent"/>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="li.itemgroup">
    <xsl:attribute name="space-before">6pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="dl">
    <xsl:attribute name="space-before">4pt</xsl:attribute>
    <xsl:attribute name="space-after">6pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="dlentry.dt">
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="dlentry.dd">
    <xsl:attribute name="space-after">4pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.link">
    <xsl:attribute name="color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="xref" use-attribute-sets="common.link"/>

  <xsl:attribute-set name="link" use-attribute-sets="common.link"/>

  <!-- ============================================================
       Notes - the accent bar + tinted background is drawn by
       xsl-base.xsl (de.note) so the localized label logic of
       pdf2's placeNoteContent keeps working untouched.
       ============================================================ -->
  <xsl:attribute-set name="note">
    <xsl:attribute name="space-before">6pt</xsl:attribute>
    <xsl:attribute name="space-after">8pt</xsl:attribute>
    <xsl:attribute name="line-height" select="$de-line-height"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.note">
    <xsl:attribute name="space-before">7pt</xsl:attribute>
    <xsl:attribute name="space-after">9pt</xsl:attribute>
    <xsl:attribute name="background-color" select="$de-note-bg"/>
    <xsl:attribute name="border-left-width">3pt</xsl:attribute>
    <xsl:attribute name="border-left-style">solid</xsl:attribute>
    <xsl:attribute name="border-left-color" select="$de-accent"/>
    <xsl:attribute name="padding-left">6pt</xsl:attribute>
    <xsl:attribute name="padding-right">6pt</xsl:attribute>
    <xsl:attribute name="padding-top">5pt</xsl:attribute>
    <xsl:attribute name="padding-bottom">5pt</xsl:attribute>
    <xsl:attribute name="keep-together.within-column">auto</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="note__label">
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="color" select="$de-accent"/>
    <xsl:attribute name="space-after">2pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="note__label__note" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__tip" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__warning" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__caution" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__important" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__attention" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__notice" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__danger" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__restriction" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__remember" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__trouble" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__fastpath" use-attribute-sets="note__label"/>
  <xsl:attribute-set name="note__label__other" use-attribute-sets="note__label"/>

  <xsl:attribute-set name="note__table">
    <xsl:attribute name="space-before">0pt</xsl:attribute>
    <xsl:attribute name="space-after">0pt</xsl:attribute>
  </xsl:attribute-set>

  <!-- ============================================================
       Code / literal text
       ============================================================ -->
  <xsl:attribute-set name="pre">
    <xsl:attribute name="font-family" select="$de-mono-family"/>
    <xsl:attribute name="font-size" select="$de-code-font-size"/>
    <xsl:attribute name="line-height">125%</xsl:attribute>
    <xsl:attribute name="background-color" select="$de-code-bg"/>
    <xsl:attribute name="border-left-width">2pt</xsl:attribute>
    <xsl:attribute name="border-left-style">solid</xsl:attribute>
    <xsl:attribute name="border-left-color" select="$de-accent-border"/>
    <xsl:attribute name="padding-left">6pt</xsl:attribute>
    <xsl:attribute name="padding-right">6pt</xsl:attribute>
    <xsl:attribute name="padding-top">4pt</xsl:attribute>
    <xsl:attribute name="padding-bottom">4pt</xsl:attribute>
    <xsl:attribute name="space-before">6pt</xsl:attribute>
    <xsl:attribute name="space-after">8pt</xsl:attribute>
    <xsl:attribute name="white-space-collapse">false</xsl:attribute>
    <xsl:attribute name="linefeed-treatment">preserve</xsl:attribute>
    <xsl:attribute name="white-space-treatment">preserve</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="codeblock" use-attribute-sets="pre"/>
  <xsl:attribute-set name="lines" use-attribute-sets="pre"/>
  <xsl:attribute-set name="msgblock" use-attribute-sets="pre"/>
  <xsl:attribute-set name="screen" use-attribute-sets="pre"/>

  <xsl:attribute-set name="codeph">
    <xsl:attribute name="font-family" select="$de-mono-family"/>
    <xsl:attribute name="font-size" select="$de-code-font-size"/>
    <xsl:attribute name="background-color" select="$de-code-bg"/>
    <xsl:attribute name="color" select="$de-title-color"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="tt" use-attribute-sets="codeph"/>
  <xsl:attribute-set name="cmd" use-attribute-sets="codeph"/>
  <xsl:attribute-set name="kwd">
    <xsl:attribute name="font-family" select="$de-mono-family"/>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
  </xsl:attribute-set>
  <xsl:attribute-set name="option" use-attribute-sets="codeph"/>
  <xsl:attribute-set name="parmname" use-attribute-sets="codeph"/>
  <xsl:attribute-set name="varname" use-attribute-sets="codeph"/>
  <xsl:attribute-set name="filepath" use-attribute-sets="codeph"/>
  <xsl:attribute-set name="userinput">
    <xsl:attribute name="font-family" select="$de-mono-family"/>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
  </xsl:attribute-set>
  <xsl:attribute-set name="systemoutput" use-attribute-sets="codeph"/>

  <!-- ============================================================
       Tables - "hairline" modern default; themes switch to full grid /
       three-line / dense grid via their own declarations.
       ============================================================ -->
  <xsl:attribute-set name="table" use-attribute-sets="base-font">
    <xsl:attribute name="space-before">8pt</xsl:attribute>
    <xsl:attribute name="space-after">12pt</xsl:attribute>
    <xsl:attribute name="border-collapse">collapse</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__container"/>

  <xsl:attribute-set name="table.tgroup">
    <xsl:attribute name="border-collapse">collapse</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="table.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size">95%</xsl:attribute>
    <xsl:attribute name="space-before">8pt</xsl:attribute>
    <xsl:attribute name="space-after">3pt</xsl:attribute>
    <xsl:attribute name="text-align">start</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="thead.row">
    <xsl:attribute name="background-color" select="$de-table-head-bg"/>
    <xsl:attribute name="keep-with-next.within-column">always</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.table.head.entry">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
    <xsl:attribute name="padding">4pt</xsl:attribute>
    <xsl:attribute name="border-bottom-width">1pt</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.table.body.entry">
    <xsl:attribute name="padding">4pt</xsl:attribute>
    <xsl:attribute name="border-bottom-width">0.4pt</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-border"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="thead.row.entry" use-attribute-sets="common.table.head.entry"/>
  <xsl:attribute-set name="thead.row.entry__content"/>
  <xsl:attribute-set name="tbody.row.entry" use-attribute-sets="common.table.body.entry"/>
  <xsl:attribute-set name="tbody.row.entry__content"/>
  <xsl:attribute-set name="tbody.row.entry__firstcol" use-attribute-sets="common.table.body.entry"/>
  <xsl:attribute-set name="tfoot.row.entry" use-attribute-sets="common.table.body.entry"/>
  <xsl:attribute-set name="tbody.row">
    <xsl:attribute name="keep-together.within-column">auto</xsl:attribute>
  </xsl:attribute-set>
  <xsl:attribute-set name="tgroup.thead"/>
  <xsl:attribute-set name="tgroup.tbody"/>

  <xsl:attribute-set name="table__tableframe__top">
    <xsl:attribute name="border-top-width">1pt</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__tableframe__bottom">
    <xsl:attribute name="border-bottom-width">1pt</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__tableframe__topbot">
    <xsl:attribute name="border-top-width">1pt</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-accent"/>
    <xsl:attribute name="border-bottom-width">1pt</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__tableframe__all">
    <xsl:attribute name="border-width">0.5pt</xsl:attribute>
    <xsl:attribute name="border-style">solid</xsl:attribute>
    <xsl:attribute name="border-color" select="$de-border"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="simpletable">
    <xsl:attribute name="space-before">8pt</xsl:attribute>
    <xsl:attribute name="space-after">10pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="sthead">
    <xsl:attribute name="background-color" select="$de-table-head-bg"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="sthead.stentry" use-attribute-sets="common.table.head.entry"/>
  <xsl:attribute-set name="sthead.stentry__content"/>
  <xsl:attribute-set name="strow.stentry" use-attribute-sets="common.table.body.entry"/>
  <xsl:attribute-set name="strow.stentry__content"/>

  <!-- ============================================================
       Figures, TOC
       ============================================================ -->
  <xsl:attribute-set name="fig">
    <xsl:attribute name="space-before">8pt</xsl:attribute>
    <xsl:attribute name="space-after">10pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="fig.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size">90%</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="text-align">center</xsl:attribute>
    <xsl:attribute name="space-before">3pt</xsl:attribute>
    <xsl:attribute name="space-after">8pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="image__block"/>

  <xsl:attribute-set name="__toc__title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-chapter-title-size"/>
    <xsl:attribute name="space-after">12pt</xsl:attribute>
    <xsl:attribute name="padding-bottom">4pt</xsl:attribute>
    <xsl:attribute name="border-after-width" select="$de-title-rule"/>
    <xsl:attribute name="border-after-style">solid</xsl:attribute>
    <xsl:attribute name="border-after-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="__toc__header" use-attribute-sets="__toc__title"/>

  <xsl:attribute-set name="__toc__topic__content">
    <xsl:attribute name="font-family" select="$de-font-family"/>
    <xsl:attribute name="font-size">100%</xsl:attribute>
    <xsl:attribute name="space-before">2pt</xsl:attribute>
    <xsl:attribute name="space-after">2pt</xsl:attribute>
    <xsl:attribute name="end-indent">0pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="__toc__content" use-attribute-sets="__toc__topic__content"/>
  <xsl:attribute-set name="__toc__chapter__content" use-attribute-sets="__toc__topic__content"/>
  <xsl:attribute-set name="__toc__appendix__content" use-attribute-sets="__toc__topic__content"/>
  <xsl:attribute-set name="__toc__part__content" use-attribute-sets="__toc__topic__content"/>
  <xsl:attribute-set name="__toc__preface__content" use-attribute-sets="__toc__topic__content"/>
  <xsl:attribute-set name="__toc__notices__content" use-attribute-sets="__toc__topic__content"/>

  <xsl:attribute-set name="__toc__link">
    <xsl:attribute name="color" select="$de-text"/>
    <xsl:attribute name="text-decoration">none</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="__toc__page-number">
    <xsl:attribute name="color" select="$de-muted"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="__toc__leader">
    <xsl:attribute name="color" select="$de-border"/>
  </xsl:attribute-set>

  <!-- ============================================================
       Cover page
       ============================================================ -->
  <xsl:attribute-set name="__frontmatter">
    <xsl:attribute name="space-before">0mm</xsl:attribute>
    <xsl:attribute name="space-after">0mm</xsl:attribute>
    <xsl:attribute name="padding">0mm</xsl:attribute>
    <xsl:attribute name="margin-left">0mm</xsl:attribute>
    <xsl:attribute name="margin-right">0mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover">
    <xsl:attribute name="space-before">0mm</xsl:attribute>
    <xsl:attribute name="space-after">0mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.logo">
    <xsl:attribute name="space-after">10mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.logo.image">
    <xsl:attribute name="content-height">14mm</xsl:attribute>
    <xsl:attribute name="content-width">60mm</xsl:attribute>
    <xsl:attribute name="scaling">uniform</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.rule">
    <xsl:attribute name="border-top-width">6pt</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-accent"/>
    <xsl:attribute name="space-after">8mm</xsl:attribute>
    <xsl:attribute name="width">36mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.title">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-size">30pt</xsl:attribute>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
    <xsl:attribute name="line-height">125%</xsl:attribute>
    <xsl:attribute name="space-before">4mm</xsl:attribute>
    <xsl:attribute name="space-after">4mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.subtitle">
    <xsl:attribute name="font-family" select="$de-font-family"/>
    <xsl:attribute name="font-size">14pt</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="line-height">140%</xsl:attribute>
    <xsl:attribute name="space-after">2mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.kicker">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-size">9pt</xsl:attribute>
    <xsl:attribute name="letter-spacing">1.2pt</xsl:attribute>
    <xsl:attribute name="text-transform">uppercase</xsl:attribute>
    <xsl:attribute name="color" select="$de-accent"/>
    <xsl:attribute name="space-after">6mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.band">
    <xsl:attribute name="background-color" select="$de-accent"/>
    <xsl:attribute name="padding-left">8mm</xsl:attribute>
    <xsl:attribute name="padding-right">8mm</xsl:attribute>
    <xsl:attribute name="padding-top">14mm</xsl:attribute>
    <xsl:attribute name="padding-bottom">14mm</xsl:attribute>
    <xsl:attribute name="space-after">12mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.band.title">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-size">26pt</xsl:attribute>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-accent-contrast"/>
    <xsl:attribute name="line-height">125%</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.band.subtitle">
    <xsl:attribute name="font-size">12pt</xsl:attribute>
    <xsl:attribute name="color" select="$de-accent-contrast"/>
    <xsl:attribute name="space-before">4mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.meta">
    <xsl:attribute name="space-before" select="$de-cover-meta-gap"/>
    <xsl:attribute name="font-size">10pt</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.center">
    <xsl:attribute name="text-align">center</xsl:attribute>
    <xsl:attribute name="space-before">55mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.center.title">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-size">28pt</xsl:attribute>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
    <xsl:attribute name="text-align">center</xsl:attribute>
    <xsl:attribute name="line-height">130%</xsl:attribute>
    <xsl:attribute name="space-before">10mm</xsl:attribute>
    <xsl:attribute name="space-after">6mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.center.rule">
    <xsl:attribute name="border-top-width">0.8pt</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-accent"/>
    <xsl:attribute name="width">40mm</xsl:attribute>
    <xsl:attribute name="space-before">6mm</xsl:attribute>
    <xsl:attribute name="space-after">6mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.center.subtitle">
    <xsl:attribute name="font-family" select="$de-font-family"/>
    <xsl:attribute name="font-size">13pt</xsl:attribute>
    <xsl:attribute name="font-style">italic</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="text-align">center</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.center.meta">
    <xsl:attribute name="space-before" select="$de-cover-meta-gap"/>
    <xsl:attribute name="font-size">10pt</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="text-align">center</xsl:attribute>
  </xsl:attribute-set>

  <!-- Compact cover: a small brand chip above a tight title block. -->
  <xsl:attribute-set name="de.cover.chip">
    <xsl:attribute name="background-color" select="$de-accent-soft"/>
    <xsl:attribute name="border-left-width">3pt</xsl:attribute>
    <xsl:attribute name="border-left-style">solid</xsl:attribute>
    <xsl:attribute name="border-left-color" select="$de-accent"/>
    <xsl:attribute name="padding-left">5mm</xsl:attribute>
    <xsl:attribute name="padding-top">4mm</xsl:attribute>
    <xsl:attribute name="padding-bottom">4mm</xsl:attribute>
    <xsl:attribute name="space-before">35mm</xsl:attribute>
    <xsl:attribute name="space-after">8mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.chip.title">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-size">24pt</xsl:attribute>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
    <xsl:attribute name="line-height">125%</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.chip.subtitle">
    <xsl:attribute name="font-size">11pt</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="space-before">3mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.cover.chip.meta">
    <xsl:attribute name="space-before" select="$de-cover-meta-gap"/>
    <xsl:attribute name="font-size">9pt</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
  </xsl:attribute-set>

  <!-- ============================================================
       Running headers / footers
       ============================================================ -->
  <xsl:attribute-set name="de.header.table">
    <xsl:attribute name="width">100%</xsl:attribute>
    <xsl:attribute name="border-bottom-width" select="$de-header-rule"/>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-border"/>
    <xsl:attribute name="space-after">3mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.header.text">
    <xsl:attribute name="font-family" select="$de-font-family"/>
    <xsl:attribute name="font-size">8pt</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.footer.table">
    <xsl:attribute name="width">100%</xsl:attribute>
    <xsl:attribute name="border-top-width" select="$de-header-rule"/>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-border"/>
    <xsl:attribute name="space-before">3mm</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.footer.text" use-attribute-sets="de.header.text"/>

  <xsl:attribute-set name="de.footer.page">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-size">8pt</xsl:attribute>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-accent"/>
    <xsl:attribute name="text-align">end</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="__body__odd__header" use-attribute-sets="de.header.text"/>
  <xsl:attribute-set name="__body__even__header" use-attribute-sets="de.header.text"/>
  <xsl:attribute-set name="__body__odd__footer" use-attribute-sets="de.footer.text"/>
  <xsl:attribute-set name="__body__even__footer" use-attribute-sets="de.footer.text"/>

</xsl:stylesheet>
