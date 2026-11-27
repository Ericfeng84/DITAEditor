<?xml version="1.0" encoding="UTF-8"?>
<!--
  Theme: tech-manual (现代技术手册, default).

  Modern, low-chrome documentation look: teal brand accent, left-aligned accent
  rule cover, hairline tables, tinted code blocks, accent-bar notes. Only the
  pieces that differ from `shared/attrs-base.xsl` are declared here - the job's
  generated `theme-vars.xsl` is imported afterwards and still wins for paper
  size, margins, font family/size, accent colour and the print toggles.
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fo="http://www.w3.org/1999/XSL/Format"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                version="3.0"
                exclude-result-prefixes="#all">

  <xsl:variable name="de-table-frame" select="'hairline'"/>
  <xsl:variable name="de-note-style" select="'bar'"/>
  <xsl:variable name="de-chapter-title-size" select="'20pt'"/>
  <xsl:variable name="de-section-title-size" select="'13pt'"/>
  <xsl:variable name="de-title-rule" select="'2pt'"/>
  <xsl:variable name="de-line-height" select="'140%'"/>
  <xsl:variable name="de-cover-meta-gap" select="'52mm'"/>

  <xsl:attribute-set name="topic.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-chapter-title-size"/>
    <xsl:attribute name="space-after">10pt</xsl:attribute>
    <xsl:attribute name="padding-bottom">5pt</xsl:attribute>
    <xsl:attribute name="border-after-width" select="$de-title-rule"/>
    <xsl:attribute name="border-after-style">solid</xsl:attribute>
    <xsl:attribute name="border-after-color" select="$de-accent"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="section.title" use-attribute-sets="common.title">
    <xsl:attribute name="font-size" select="$de-section-title-size"/>
    <xsl:attribute name="space-before">13pt</xsl:attribute>
    <xsl:attribute name="space-after">5pt</xsl:attribute>
    <xsl:attribute name="border-after-width">0.6pt</xsl:attribute>
    <xsl:attribute name="border-after-style">solid</xsl:attribute>
    <xsl:attribute name="border-after-color" select="$de-accent-border"/>
    <xsl:attribute name="padding-bottom">2pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="shortdesc">
    <xsl:attribute name="color" select="$de-muted"/>
    <xsl:attribute name="font-size">104%</xsl:attribute>
    <xsl:attribute name="space-after">9pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="topic__shortdesc" use-attribute-sets="shortdesc">
    <xsl:attribute name="border-left-width">2pt</xsl:attribute>
    <xsl:attribute name="border-left-style">solid</xsl:attribute>
    <xsl:attribute name="border-left-color" select="$de-accent-border"/>
    <xsl:attribute name="padding-left">6pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="table__tableframe__all">
    <xsl:attribute name="border-width">0pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="thead.row">
    <xsl:attribute name="background-color" select="$de-table-head-bg"/>
    <xsl:attribute name="border-top-width">1pt</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-color" select="$de-accent"/>
  </xsl:attribute-set>

</xsl:stylesheet>
