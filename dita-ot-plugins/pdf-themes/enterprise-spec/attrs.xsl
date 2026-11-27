<?xml version="1.0" encoding="UTF-8"?>
<!--
  Theme: enterprise-spec (企业标准规范).

  High-density specification look: navy brand band cover, fully ruled CALS
  tables, tighter leading, ISO/ANSI style hazard colours (danger / warning /
  caution / tip) rendered as saturated bars with a white body, and automatic
  chapter numbering as the default.
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fo="http://www.w3.org/1999/XSL/Format"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                version="3.0"
                exclude-result-prefixes="#all">

  <xsl:variable name="de-table-frame" select="'grid'"/>
  <xsl:variable name="de-note-style" select="'outline'"/>
  <xsl:variable name="de-grid-line" select="'#C3D0DE'"/>
  <xsl:variable name="de-chapter-title-size" select="'19pt'"/>
  <xsl:variable name="de-section-title-size" select="'12.5pt'"/>
  <xsl:variable name="de-title-rule" select="'3pt'"/>
  <xsl:variable name="de-line-height" select="'132%'"/>
  <xsl:variable name="de-cover-meta-gap" select="'60mm'"/>
  <xsl:variable name="de-header-rule" select="'0.8pt'"/>

  <xsl:attribute-set name="topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-chapter-title-size"/>
    <xsl:attribute name="space-before">4pt</xsl:attribute>
    <xsl:attribute name="space-after">8pt</xsl:attribute>
    <xsl:attribute name="padding-bottom">3pt</xsl:attribute>
    <xsl:attribute name="border-after-width" select="$de-title-rule"/>
    <xsl:attribute name="border-after-style">solid</xsl:attribute>
    <xsl:attribute name="border-after-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="section.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-section-title-size"/>
    <xsl:attribute name="space-before">12pt</xsl:attribute>
    <xsl:attribute name="space-after">4pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic.topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-section-title-size"/>
    <xsl:attribute name="space-before">12pt</xsl:attribute>
    <xsl:attribute name="space-after">4pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="p">
    <xsl:attribute name="space-before">2pt</xsl:attribute>
    <xsl:attribute name="space-after">5pt</xsl:attribute>
    <xsl:attribute name="line-height" select="$de-line-height"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="table" use-attribute-sets="base-font">
    <xsl:attribute name="space-before">7pt</xsl:attribute>
    <xsl:attribute name="space-after">10pt</xsl:attribute>
    <xsl:attribute name="border-collapse">collapse</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.table.head.entry">
    <xsl:attribute name="font-family" select="$de-heading-family"/>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="color" select="$de-title-color"/>
    <xsl:attribute name="background-color" select="$de-table-head-bg"/>
    <xsl:attribute name="padding">3.5pt</xsl:attribute>
    <xsl:attribute name="border-width">0.5pt</xsl:attribute>
    <xsl:attribute name="border-style">solid</xsl:attribute>
    <xsl:attribute name="border-color" select="$de-grid-line"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="common.table.body.entry">
    <xsl:attribute name="padding">3.5pt</xsl:attribute>
    <xsl:attribute name="border-width">0.5pt</xsl:attribute>
    <xsl:attribute name="border-style">solid</xsl:attribute>
    <xsl:attribute name="border-color" select="$de-grid-line"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__tableframe__all">
    <xsl:attribute name="border-width">0.8pt</xsl:attribute>
    <xsl:attribute name="border-style">solid</xsl:attribute>
    <xsl:attribute name="border-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__tableframe__top">
    <xsl:attribute name="border-top-width">0.8pt</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__tableframe__bottom">
    <xsl:attribute name="border-bottom-width">0.8pt</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="de.note">
    <xsl:attribute name="space-before">6pt</xsl:attribute>
    <xsl:attribute name="space-after">8pt</xsl:attribute>
    <xsl:attribute name="background-color">white</xsl:attribute>
    <xsl:attribute name="border-left-width">4pt</xsl:attribute>
    <xsl:attribute name="border-left-style">solid</xsl:attribute>
    <xsl:attribute name="border-left-color" select="$de-accent"/>
    <xsl:attribute name="border-top-width">0.4pt</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-grid-line"/>
    <xsl:attribute name="border-bottom-width">0.4pt</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-color" select="$de-grid-line"/>
    <xsl:attribute name="padding-left">6pt</xsl:attribute>
    <xsl:attribute name="padding-right">6pt</xsl:attribute>
    <xsl:attribute name="padding-top">4pt</xsl:attribute>
    <xsl:attribute name="padding-bottom">4pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="pre">
    <xsl:attribute name="font-family" select="$de-mono-family"/>
    <xsl:attribute name="font-size" select="$de-code-font-size"/>
    <xsl:attribute name="line-height">125%</xsl:attribute>
    <xsl:attribute name="background-color" select="$de-code-bg"/>
    <xsl:attribute name="border-width">0.4pt</xsl:attribute>
    <xsl:attribute name="border-style">solid</xsl:attribute>
    <xsl:attribute name="border-color" select="$de-grid-line"/>
    <xsl:attribute name="padding">4pt</xsl:attribute>
    <xsl:attribute name="space-before">5pt</xsl:attribute>
    <xsl:attribute name="space-after">7pt</xsl:attribute>
    <xsl:attribute name="white-space-collapse">false</xsl:attribute>
    <xsl:attribute name="linefeed-treatment">preserve</xsl:attribute>
    <xsl:attribute name="white-space-treatment">preserve</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="shortdesc">
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="font-size">100%</xsl:attribute>
    <xsl:attribute name="space-after">7pt</xsl:attribute>
  </xsl:attribute-set>

</xsl:stylesheet>
