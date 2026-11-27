<?xml version="1.0" encoding="UTF-8"?>
<!--
  Theme: compact-guide (紧凑工程指南).

  Field-guide layout for small paper: tight leading, 9pt-friendly table and code
  cells, hairline grid rules so dense tables stay readable, and a narrow
  top-rule cover that does not waste a page.
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fo="http://www.w3.org/1999/XSL/Format"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                version="3.0"
                exclude-result-prefixes="#all">

  <xsl:variable name="de-table-frame" select="'dense-grid'"/>
  <xsl:variable name="de-note-style" select="'bar'"/>
  <xsl:variable name="de-grid-line" select="'#dbe3ec'"/>
  <xsl:variable name="de-chapter-title-size" select="'17pt'"/>
  <xsl:variable name="de-section-title-size" select="'11.5pt'"/>
  <xsl:variable name="de-title-rule" select="'2pt'"/>
  <xsl:variable name="de-line-height" select="'128%'"/>
  <xsl:variable name="de-cover-meta-gap" select="'40mm'"/>
  <xsl:variable name="de-code-font-size" select="'82%'"/>
  <xsl:variable name="de-header-rule" select="'0.6pt'"/>

  <xsl:attribute-set name="topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-chapter-title-size"/>
    <xsl:attribute name="space-before">2pt</xsl:attribute>
    <xsl:attribute name="space-after">6pt</xsl:attribute>
    <xsl:attribute name="padding-bottom">3pt</xsl:attribute>
    <xsl:attribute name="border-after-width" select="$de-title-rule"/>
    <xsl:attribute name="border-after-style">solid</xsl:attribute>
    <xsl:attribute name="border-after-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-section-title-size"/>
    <xsl:attribute name="space-before">9pt</xsl:attribute>
    <xsl:attribute name="space-after">3pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="section.title" use-attribute-sets="topic.topic.title"/>

  <xsl:attribute-set name="p">
    <xsl:attribute name="space-before">0pt</xsl:attribute>
    <xsl:attribute name="space-after">3.5pt</xsl:attribute>
    <xsl:attribute name="line-height" select="$de-line-height"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="shortdesc">
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="font-size">97%</xsl:attribute>
    <xsl:attribute name="space-after">5pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="body">
    <xsl:attribute name="line-height" select="$de-line-height"/>
  </xsl:attribute-set>

  <!-- Lists and steps: minimal vertical rhythm so procedures fit on one page. -->
  <xsl:attribute-set name="ul" use-attribute-sets="base-font">
    <xsl:attribute name="space-before">1pt</xsl:attribute>
    <xsl:attribute name="space-after">3pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="ol" use-attribute-sets="base-font">
    <xsl:attribute name="space-before">1pt</xsl:attribute>
    <xsl:attribute name="space-after">3pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="ul.li" use-attribute-sets="base-font">
    <xsl:attribute name="space-after">1.5pt</xsl:attribute>
    <xsl:attribute name="provisional-distance-between-starts">12pt</xsl:attribute>
    <xsl:attribute name="provisional-label-separation">4pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="ol.li" use-attribute-sets="ul.li"/>

  <xsl:attribute-set name="dl" use-attribute-sets="base-font">
    <xsl:attribute name="space-before">2pt</xsl:attribute>
    <xsl:attribute name="space-after">4pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="dlentry.dt">
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="space-before">2pt</xsl:attribute>
    <xsl:attribute name="keep-with-next.within-column">always</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="dlentry.dd">
    <xsl:attribute name="start-indent">10pt</xsl:attribute>
    <xsl:attribute name="space-after">2pt</xsl:attribute>
  </xsl:attribute-set>

  <!-- Dense grid tables. -->
  <xsl:attribute-set name="table" use-attribute-sets="base-font">
    <xsl:attribute name="space-before">4pt</xsl:attribute>
    <xsl:attribute name="space-after">6pt</xsl:attribute>
    <xsl:attribute name="font-size">92%</xsl:attribute>
    <xsl:attribute name="border-collapse">collapse</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__tableframe__all">
    <xsl:attribute name="border-width">0.5pt</xsl:attribute>
    <xsl:attribute name="border-style">solid</xsl:attribute>
    <xsl:attribute name="border-color" select="$de-grid-line"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.table.head.entry">
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
    <xsl:attribute name="background-color" select="$de-table-head-bg"/>
    <xsl:attribute name="padding">2.5pt</xsl:attribute>
    <xsl:attribute name="border-width">0.3pt</xsl:attribute>
    <xsl:attribute name="border-style">solid</xsl:attribute>
    <xsl:attribute name="border-color" select="$de-grid-line"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.table.body.entry">
    <xsl:attribute name="padding">2.5pt</xsl:attribute>
    <xsl:attribute name="line-height">120%</xsl:attribute>
    <xsl:attribute name="border-width">0.3pt</xsl:attribute>
    <xsl:attribute name="border-style">solid</xsl:attribute>
    <xsl:attribute name="border-color" select="$de-grid-line"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="table.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size">88%</xsl:attribute>
    <xsl:attribute name="space-before">4pt</xsl:attribute>
    <xsl:attribute name="space-after">2pt</xsl:attribute>
  </xsl:attribute-set>

  <!-- Compact code blocks and notes. -->
  <xsl:attribute-set name="pre">
    <xsl:attribute name="font-family" select="$de-mono-family"/>
    <xsl:attribute name="font-size" select="$de-code-font-size"/>
    <xsl:attribute name="line-height">118%</xsl:attribute>
    <xsl:attribute name="background-color" select="$de-code-bg"/>
    <xsl:attribute name="border-left-width">2pt</xsl:attribute>
    <xsl:attribute name="border-left-style">solid</xsl:attribute>
    <xsl:attribute name="border-left-color" select="$de-accent-border"/>
    <xsl:attribute name="padding">3pt</xsl:attribute>
    <xsl:attribute name="space-before">4pt</xsl:attribute>
    <xsl:attribute name="space-after">5pt</xsl:attribute>
    <xsl:attribute name="white-space-collapse">false</xsl:attribute>
    <xsl:attribute name="linefeed-treatment">preserve</xsl:attribute>
    <xsl:attribute name="white-space-treatment">preserve</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="codeph">
    <xsl:attribute name="font-family" select="$de-mono-family"/>
    <xsl:attribute name="font-size" select="$de-code-font-size"/>
    <xsl:attribute name="background-color" select="$de-code-bg"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.note">
    <xsl:attribute name="space-before">4pt</xsl:attribute>
    <xsl:attribute name="space-after">5pt</xsl:attribute>
    <xsl:attribute name="background-color" select="$de-note-bg"/>
    <xsl:attribute name="border-left-width">3pt</xsl:attribute>
    <xsl:attribute name="border-left-style">solid</xsl:attribute>
    <xsl:attribute name="border-left-color" select="$de-accent"/>
    <xsl:attribute name="padding-left">5pt</xsl:attribute>
    <xsl:attribute name="padding-right">4pt</xsl:attribute>
    <xsl:attribute name="padding-top">3pt</xsl:attribute>
    <xsl:attribute name="padding-bottom">3pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.header.text">
    <xsl:attribute name="font-size">86%</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.footer.text">
    <xsl:attribute name="font-size">86%</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
  </xsl:attribute-set>

</xsl:stylesheet>
