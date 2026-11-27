<?xml version="1.0" encoding="UTF-8"?>
<!--
  Theme: editorial-book (出版书籍).

  Print-book typography: serif body and headings (Noto Serif CJK via the
  `Serif` logical font), caramel accent, centered classical cover, airy leading,
  academic three-line tables, and mirrored binding margins by default.
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fo="http://www.w3.org/1999/XSL/Format"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                version="3.0"
                exclude-result-prefixes="#all">

  <xsl:variable name="de-table-frame" select="'three-line'"/>
  <xsl:variable name="de-note-style" select="'bar'"/>
  <xsl:variable name="de-chapter-title-size" select="'24pt'"/>
  <xsl:variable name="de-section-title-size" select="'14pt'"/>
  <xsl:variable name="de-title-rule" select="'0.8pt'"/>
  <xsl:variable name="de-line-height" select="'155%'"/>
  <xsl:variable name="de-cover-meta-gap" select="'62mm'"/>
  <xsl:variable name="de-body-align" select="'justify'"/>

  <xsl:attribute-set name="common.title">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
    <xsl:attribute name="line-height">130%</xsl:attribute>
    <xsl:attribute name="keep-with-next.within-column">always</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-chapter-title-size"/>
    <xsl:attribute name="space-before">6pt</xsl:attribute>
    <xsl:attribute name="space-after">14pt</xsl:attribute>
    <xsl:attribute name="text-align">center</xsl:attribute>
    <xsl:attribute name="padding-bottom">8pt</xsl:attribute>
    <xsl:attribute name="border-after-width" select="$de-title-rule"/>
    <xsl:attribute name="border-after-style">solid</xsl:attribute>
    <xsl:attribute name="border-after-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-section-title-size"/>
    <xsl:attribute name="space-before">18pt</xsl:attribute>
    <xsl:attribute name="space-after">8pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="section.title" use-attribute-sets="topic.topic.title"/>

  <xsl:attribute-set name="p">
    <xsl:attribute name="space-before">0pt</xsl:attribute>
    <xsl:attribute name="space-after">7pt</xsl:attribute>
    <xsl:attribute name="line-height" select="$de-line-height"/>
    <xsl:attribute name="text-align" select="$de-body-align"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="shortdesc">
    <xsl:attribute name="font-family" select="$de-font-family"/>
    <xsl:attribute name="font-style">italic</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="font-size">103%</xsl:attribute>
    <xsl:attribute name="space-after">10pt</xsl:attribute>
    <xsl:attribute name="text-align">center</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic__shortdesc" use-attribute-sets="shortdesc"/>

  <!-- Academic three-line table: no vertical rules, rules above/below the head. -->
  <xsl:attribute-set name="table__tableframe__all">
    <xsl:attribute name="border-width">0pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="thead.row">
    <xsl:attribute name="background-color">white</xsl:attribute>
    <xsl:attribute name="border-top-width">1pt</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.table.head.entry">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
    <xsl:attribute name="padding">5pt</xsl:attribute>
    <xsl:attribute name="border-bottom-width">0.6pt</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.table.body.entry">
    <xsl:attribute name="padding">5pt</xsl:attribute>
    <xsl:attribute name="border-bottom-width">0pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__tableframe__bottom">
    <xsl:attribute name="border-bottom-width">1pt</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="table.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size">90%</xsl:attribute>
    <xsl:attribute name="text-align">center</xsl:attribute>
    <xsl:attribute name="space-before">8pt</xsl:attribute>
    <xsl:attribute name="space-after">3pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="fig.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size">85%</xsl:attribute>
    <xsl:attribute name="font-weight">normal</xsl:attribute>
    <xsl:attribute name="font-style">italic</xsl:attribute>
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="text-align">center</xsl:attribute>
    <xsl:attribute name="space-before">4pt</xsl:attribute>
    <xsl:attribute name="space-after">10pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="pre">
    <xsl:attribute name="font-family" select="$de-mono-family"/>
    <xsl:attribute name="font-size" select="$de-code-font-size"/>
    <xsl:attribute name="line-height">130%</xsl:attribute>
    <xsl:attribute name="background-color" select="$de-code-bg"/>
    <xsl:attribute name="border-top-width">0.4pt</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-border"/>
    <xsl:attribute name="border-bottom-width">0.4pt</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-border"/>
    <xsl:attribute name="padding">5pt</xsl:attribute>
    <xsl:attribute name="space-before">7pt</xsl:attribute>
    <xsl:attribute name="space-after">9pt</xsl:attribute>
    <xsl:attribute name="white-space-collapse">false</xsl:attribute>
    <xsl:attribute name="linefeed-treatment">preserve</xsl:attribute>
    <xsl:attribute name="white-space-treatment">preserve</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="codeph">
    <xsl:attribute name="font-family" select="$de-mono-family"/>
    <xsl:attribute name="font-size" select="$de-code-font-size"/>
    <xsl:attribute name="color" select="$de-title-color"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.title.number">
    <xsl:attribute name="color" select="$de-accent"/>
    <xsl:attribute name="font-weight">normal</xsl:attribute>
  </xsl:attribute-set>

</xsl:stylesheet>
