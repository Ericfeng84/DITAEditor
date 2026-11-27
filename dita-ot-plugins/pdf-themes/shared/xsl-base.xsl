<?xml version="1.0" encoding="UTF-8"?>
<!--
  DITAEditor shared PDF structure templates (Phase 15).

  This module (`cfg:fo/xsl/custom.xsl`) overrides a handful of named templates
  from `org.dita.pdf2/xsl/fo/*` with the same names, so DITA-OT's static
  `<xsl:call-template name="insertBodyOddHeader"/>` style dispatch picks them up:

    createFrontCoverContents          -> four cover layouts ($de-cover-style)
    createFrontMatter                 -> honour the `showCover` toggle
    insertBody*Header/Footer          -> brand + running chapter title + page number
    insertBodyStaticContents          -> only emit even-page flows when mirroring
    getTitle (mode)                   -> automatic chapter numbering
    mode="toc" (root)                 -> honour the `showToc` toggle
    mode="create-page-masters"        -> page size + margins from the job options
    generate-page-sequence-master     -> odd/even masters only when mirroring

  plus one element template (`topic/note`) that wraps pdf2's localized
  `placeNoteContent` output in an accent-bar block.

  This module is `xsl:include`d by the generated `cfg:fo/xsl/custom.xsl`, so the
  unit tokens it reads (`$de-font-size`, `$de-page-width`, …) resolve through
  that stylesheet's imports. Reading pdf2's `$map` / `$productName` /
  `$default-font-size` directly would be a static error here: those globals live
  in modules that are *siblings* of the customization chain, not in its scope.

  Nothing here changes document semantics: when a feature flag is off the
  emitted content matches the DITA-OT default layout.
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fo="http://www.w3.org/1999/XSL/Format"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                version="3.0"
                exclude-result-prefixes="#all">

  <!-- Module-local view of the root map. `//*[contains(@class,…)]` is
       namespace free, so it works for ditamap and bookmap alike. -->
  <xsl:variable name="de-map" select="//*[contains(@class, ' map/map ')][1]"/>
  <xsl:variable name="de-product-name"
                select="normalize-space(string($de-map/*[contains(@class, ' map/title ')][1]))"/>

  <!-- ============================================================
       Front cover
       ============================================================ -->
  <xsl:template name="de-cover-logo">
    <xsl:if test="normalize-space($de-logo-uri) != ''">
      <fo:block xsl:use-attribute-sets="de.cover.logo">
        <fo:external-graphic src="url('{$de-logo-uri}')" xsl:use-attribute-sets="de.cover.logo.image"/>
      </fo:block>
    </xsl:if>
  </xsl:template>

  <xsl:template name="de-cover-meta">
    <fo:block xsl:use-attribute-sets="de.cover.meta">
      <xsl:choose>
        <xsl:when test="$de-map//*[contains(@class,' topic/author ')]">
          <xsl:value-of select="($de-map//*[contains(@class,' topic/author ')])[1]"/>
        </xsl:when>
        <xsl:when test="$de-map//*[contains(@class,' topic/publisher ')]">
          <xsl:value-of select="($de-map//*[contains(@class,' topic/publisher ')])[1]"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$de-product-name"/>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="normalize-space($de-footer-text) != ''">
        <xsl:text> · </xsl:text>
        <xsl:value-of select="normalize-space($de-footer-text)"/>
      </xsl:if>
    </fo:block>
  </xsl:template>

  <xsl:template name="createFrontCoverContents">
    <xsl:variable name="coverTitle" as="xs:string">
      <xsl:choose>
        <xsl:when test="$de-map/*[contains(@class,' topic/title ')][1]">
          <xsl:value-of select="$de-map/*[contains(@class,' topic/title ')][1]"/>
        </xsl:when>
        <xsl:when test="$de-map//*[contains(@class,' bookmap/mainbooktitle ')][1]">
          <xsl:value-of select="($de-map//*[contains(@class,' bookmap/mainbooktitle ')])[1]"/>
        </xsl:when>
        <xsl:when test="//*[contains(@class,' map/map ')]/@title">
          <xsl:value-of select="(//*[contains(@class,' map/map ')]/@title)[1]"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="(/descendant::*[contains(@class,' topic/topic ')][1]/*[contains(@class,' topic/title ')])[1]"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="subtitle" as="xs:string" select="normalize-space($de-cover-subtitle)"/>

    <xsl:choose>
      <!-- 1. Enterprise navy band: inverted title inside a full-width brand band. -->
      <xsl:when test="$de-cover-style = 'navy-band'">
        <fo:block-container xsl:use-attribute-sets="de.cover.band">
          <xsl:call-template name="de-cover-logo"/>
          <fo:block xsl:use-attribute-sets="de.cover.band.title">
            <xsl:value-of select="$coverTitle"/>
          </fo:block>
          <xsl:if test="$subtitle != ''">
            <fo:block xsl:use-attribute-sets="de.cover.band.subtitle">
              <xsl:value-of select="$subtitle"/>
            </fo:block>
          </xsl:if>
        </fo:block-container>
        <fo:block xsl:use-attribute-sets="de.cover.kicker">
          <xsl:value-of select="$de-product-name"/>
        </fo:block>
        <xsl:call-template name="de-cover-meta"/>
      </xsl:when>

      <!-- 2. Editorial centered cover: classical, generous white space. -->
      <xsl:when test="$de-cover-style = 'editorial-center'">
        <fo:block xsl:use-attribute-sets="de.cover.center">
          <xsl:call-template name="de-cover-logo"/>
          <fo:block xsl:use-attribute-sets="de.cover.kicker">
            <xsl:value-of select="$de-product-name"/>
          </fo:block>
          <fo:block xsl:use-attribute-sets="de.cover.center.title">
            <xsl:value-of select="$coverTitle"/>
          </fo:block>
          <fo:block xsl:use-attribute-sets="de.cover.center.rule"/>
          <xsl:if test="$subtitle != ''">
            <fo:block xsl:use-attribute-sets="de.cover.center.subtitle">
              <xsl:value-of select="$subtitle"/>
            </fo:block>
          </xsl:if>
        </fo:block>
        <xsl:call-template name="de-cover-meta"/>
      </xsl:when>

      <!-- 3. Compact guide: small tinted chip, dense layout. -->
      <xsl:when test="$de-cover-style = 'compact-header'">
        <fo:block-container xsl:use-attribute-sets="de.cover.chip">
          <xsl:call-template name="de-cover-logo"/>
          <fo:block xsl:use-attribute-sets="de.cover.chip.title">
            <xsl:value-of select="$coverTitle"/>
          </fo:block>
          <xsl:if test="$subtitle != ''">
            <fo:block xsl:use-attribute-sets="de.cover.chip.subtitle">
              <xsl:value-of select="$subtitle"/>
            </fo:block>
          </xsl:if>
        </fo:block-container>
        <fo:block xsl:use-attribute-sets="de.cover.chip.meta">
          <xsl:call-template name="de-cover-meta-text"/>
        </fo:block>
      </xsl:when>

      <!-- 4. Default: left-aligned accent rule + logo + title (tech manual). -->
      <xsl:otherwise>
        <fo:block xsl:use-attribute-sets="de.cover.kicker">
          <xsl:value-of select="$de-product-name"/>
        </fo:block>
        <fo:block xsl:use-attribute-sets="de.cover.rule"/>
        <xsl:call-template name="de-cover-logo"/>
        <fo:block xsl:use-attribute-sets="de.cover.title">
          <xsl:value-of select="$coverTitle"/>
        </fo:block>
        <xsl:if test="$subtitle != ''">
          <fo:block xsl:use-attribute-sets="de.cover.subtitle">
            <xsl:value-of select="$subtitle"/>
          </fo:block>
        </xsl:if>
        <xsl:call-template name="de-cover-meta"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- Meta text only, for layouts that wrap it in their own block. -->
  <xsl:template name="de-cover-meta-text">
    <xsl:choose>
      <xsl:when test="$de-map//*[contains(@class,' topic/author ')]">
        <xsl:value-of select="($de-map//*[contains(@class,' topic/author ')])[1]"/>
      </xsl:when>
      <xsl:when test="$de-map//*[contains(@class,' topic/publisher ')]">
        <xsl:value-of select="($de-map//*[contains(@class,' topic/publisher ')])[1]"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$de-product-name"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- ============================================================
       Running headers / footers
       ============================================================ -->
  <xsl:template name="de-header-label">
    <xsl:choose>
      <xsl:when test="normalize-space($de-header-text) != ''">
        <xsl:value-of select="normalize-space($de-header-text)"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$de-product-name"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="de-static-header">
    <xsl:param name="flow-name" as="xs:string"/>
    <xsl:param name="swap" as="xs:boolean" select="false()"/>
    <fo:static-content flow-name="{$flow-name}">
      <fo:table xsl:use-attribute-sets="de.header.table">
        <fo:table-column column-width="58%"/>
        <fo:table-column column-width="42%"/>
        <fo:table-body>
          <fo:table-row>
            <fo:table-cell>
              <fo:block xsl:use-attribute-sets="de.header.text">
                <xsl:choose>
                  <xsl:when test="$swap">
                    <fo:retrieve-marker retrieve-class-name="current-header"/>
                  </xsl:when>
                  <xsl:otherwise>
                    <xsl:call-template name="de-header-label"/>
                  </xsl:otherwise>
                </xsl:choose>
              </fo:block>
            </fo:table-cell>
            <fo:table-cell>
              <fo:block xsl:use-attribute-sets="de.header.text" text-align="end">
                <xsl:choose>
                  <xsl:when test="$swap">
                    <xsl:call-template name="de-header-label"/>
                  </xsl:when>
                  <xsl:otherwise>
                    <fo:retrieve-marker retrieve-class-name="current-header"/>
                  </xsl:otherwise>
                </xsl:choose>
              </fo:block>
            </fo:table-cell>
          </fo:table-row>
        </fo:table-body>
      </fo:table>
    </fo:static-content>
  </xsl:template>

  <xsl:template name="de-static-footer">
    <xsl:param name="flow-name" as="xs:string"/>
    <xsl:param name="mirror" as="xs:boolean" select="false()"/>
    <fo:static-content flow-name="{$flow-name}">
      <fo:table xsl:use-attribute-sets="de.footer.table">
        <fo:table-column column-width="72%"/>
        <fo:table-column column-width="28%"/>
        <fo:table-body>
          <fo:table-row>
            <fo:table-cell>
              <fo:block xsl:use-attribute-sets="de.footer.text">
                <xsl:choose>
                  <xsl:when test="$mirror">
                    <fo:page-number/>
                  </xsl:when>
                  <xsl:otherwise>
                    <xsl:value-of select="normalize-space($de-footer-text)"/>
                  </xsl:otherwise>
                </xsl:choose>
              </fo:block>
            </fo:table-cell>
            <fo:table-cell>
              <fo:block xsl:use-attribute-sets="de.footer.page">
                <xsl:choose>
                  <xsl:when test="$mirror">
                    <xsl:value-of select="normalize-space($de-footer-text)"/>
                  </xsl:when>
                  <xsl:otherwise>
                    <fo:page-number/>
                  </xsl:otherwise>
                </xsl:choose>
              </fo:block>
            </fo:table-cell>
          </fo:table-row>
        </fo:table-body>
      </fo:table>
    </fo:static-content>
  </xsl:template>

  <xsl:template name="insertBodyOddHeader">
    <xsl:call-template name="de-static-header">
      <xsl:with-param name="flow-name" select="'odd-body-header'"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="insertBodyEvenHeader">
    <xsl:call-template name="de-static-header">
      <xsl:with-param name="flow-name" select="'even-body-header'"/>
      <xsl:with-param name="swap" select="true()"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="insertBodyFirstHeader">
    <fo:static-content flow-name="first-body-header">
      <fo:block xsl:use-attribute-sets="de.header.text"/>
    </fo:static-content>
  </xsl:template>

  <xsl:template name="insertBodyOddFooter">
    <xsl:call-template name="de-static-footer">
      <xsl:with-param name="flow-name" select="'odd-body-footer'"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="insertBodyEvenFooter">
    <xsl:call-template name="de-static-footer">
      <xsl:with-param name="flow-name" select="'even-body-footer'"/>
      <xsl:with-param name="mirror" select="true()"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="insertBodyFirstFooter">
    <xsl:call-template name="de-static-footer">
      <xsl:with-param name="flow-name" select="'first-body-footer'"/>
    </xsl:call-template>
  </xsl:template>

  <!-- ============================================================
       Automatic chapter numbering (1 / 1.1 / 1.1.1)
       ============================================================ -->
  <xsl:template name="de-chapter-number">
    <xsl:param name="topic" as="element()"/>
    <xsl:variable name="parent" select="$topic/parent::*[contains(@class,' topic/topic ')]"/>
    <xsl:if test="$parent">
      <xsl:call-template name="de-chapter-number">
        <xsl:with-param name="topic" select="$parent"/>
      </xsl:call-template>
      <xsl:text>.</xsl:text>
    </xsl:if>
    <xsl:value-of select="count($topic/preceding-sibling::*[contains(@class,' topic/topic ')]) + 1"/>
  </xsl:template>

  <xsl:template match="*[contains(@class,' topic/title ')]" mode="getTitle">
    <xsl:variable name="topic" select="parent::*"/>
    <xsl:if test="$de-chapter-numbers
                  and $topic[contains(@class,' topic/topic ')]
                  and not($topic/ancestor-or-self::*[contains(@class,' bookmap/preface ')
                        or contains(@class,' bookmap/notices ')]
                    or $topic[contains(@class,' bookmap/preface ') or contains(@class,' bookmap/notices ')])">
      <fo:inline xsl:use-attribute-sets="de.title.number">
        <xsl:call-template name="de-chapter-number">
          <xsl:with-param name="topic" select="$topic"/>
        </xsl:call-template>
        <xsl:text>&#160;&#160;</xsl:text>
      </fo:inline>
    </xsl:if>
    <xsl:choose>
      <xsl:when test="@spectitle">
        <xsl:value-of select="@spectitle"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:apply-templates select="node()"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- ============================================================
       Semantic note blocks: accent bar + tinted background
       ============================================================ -->
  <xsl:template match="*[contains(@class,' topic/note ')]">
    <xsl:variable name="noteType" as="xs:string"
                  select="lower-case(normalize-space(if (@type) then string(@type) else 'note'))"/>
    <xsl:variable name="bar" as="xs:string">
      <xsl:choose>
        <xsl:when test="$noteType = ('danger', 'error')">#dc2626</xsl:when>
        <xsl:when test="$noteType = ('warning', 'caution')">#d97706</xsl:when>
        <xsl:when test="$noteType = ('tip', 'remember', 'fastpath')">#059669</xsl:when>
        <xsl:when test="$noteType = ('important', 'attention', 'restriction', 'trouble')">#7c3aed</xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$de-accent"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <fo:block xsl:use-attribute-sets="de.note">
      <xsl:attribute name="border-left-color" select="$bar"/>
      <xsl:apply-templates select="." mode="placeNoteContent"/>
    </fo:block>
  </xsl:template>

  <!-- ============================================================
       Page geometry: driven by $de-page-width / $de-page-margin-*
       ============================================================ -->
  <xsl:attribute-set name="base-font">
    <xsl:attribute name="font-family" select="$de-font-family"/>
    <xsl:attribute name="font-size" select="$de-font-size"/>
    <xsl:attribute name="line-height" select="$de-line-height"/>
    <xsl:attribute name="color" select="$de-text"/>
    <xsl:attribute name="hyphenate">false</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="simple-page-master">
    <xsl:attribute name="page-width" select="$de-page-width"/>
    <xsl:attribute name="page-height" select="$de-page-height"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="region-before">
    <xsl:attribute name="extent" select="$de-page-margin-top"/>
    <xsl:attribute name="display-align">before</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="region-after">
    <xsl:attribute name="extent" select="$de-page-margin-bottom"/>
    <xsl:attribute name="display-align">after</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="region-body.odd">
    <xsl:attribute name="margin-top" select="$de-page-margin-top"/>
    <xsl:attribute name="margin-bottom" select="$de-page-margin-bottom"/>
    <xsl:attribute name="margin-left" select="$de-page-margin-inside"/>
    <xsl:attribute name="margin-right" select="$de-page-margin-outside"/>
  </xsl:attribute-set>

  <xsl:attribute-set name="region-body.even">
    <xsl:attribute name="margin-top" select="$de-page-margin-top"/>
    <xsl:attribute name="margin-bottom" select="$de-page-margin-bottom"/>
    <xsl:attribute name="margin-left"
                  select="if ($de-mirror-margins) then $de-page-margin-outside else $de-page-margin-inside"/>
    <xsl:attribute name="margin-right"
                  select="if ($de-mirror-margins) then $de-page-margin-inside else $de-page-margin-outside"/>
  </xsl:attribute-set>

  <!-- ============================================================
       Feature toggles that pdf2 hard-codes as variables
       (`$generate-front-cover`, `$generate-toc`, `$mirror-page-margins`),
       so they must be re-expressed as templates / attribute sets.
       ============================================================ -->
  <xsl:template name="createFrontMatter">
    <xsl:if test="$de-cover-enabled">
      <fo:page-sequence master-reference="front-matter" xsl:use-attribute-sets="page-sequence.cover">
        <xsl:call-template name="insertFrontMatterStaticContents"/>
        <fo:flow flow-name="xsl-region-body">
          <fo:block-container xsl:use-attribute-sets="__frontmatter">
            <xsl:call-template name="createFrontCoverContents"/>
          </fo:block-container>
        </fo:flow>
      </fo:page-sequence>
    </xsl:if>
  </xsl:template>

  <!-- pdf2 decides "is there a TOC?" with `count($toc/*) > 0`, where `$toc`
       is built by `apply-templates select="/" mode="toc"`. Suppressing the
       root rule therefore suppresses the whole TOC page sequence. -->
  <xsl:template match="/" mode="toc">
    <xsl:param name="include" as="xs:string?"/>
    <xsl:if test="$de-toc-enabled">
      <xsl:next-match>
        <xsl:with-param name="include" select="$include"/>
      </xsl:next-match>
    </xsl:if>
  </xsl:template>

  <xsl:template name="insertBodyStaticContents">
    <xsl:call-template name="insertBodyFootnoteSeparator"/>
    <xsl:call-template name="insertBodyOddFooter"/>
    <xsl:call-template name="insertBodyOddHeader"/>
    <xsl:if test="$de-mirror-margins">
      <xsl:call-template name="insertBodyEvenFooter"/>
      <xsl:call-template name="insertBodyEvenHeader"/>
    </xsl:if>
    <xsl:call-template name="insertBodyFirstHeader"/>
    <xsl:call-template name="insertBodyFirstFooter"/>
    <xsl:call-template name="insertBodyLastHeader"/>
    <xsl:call-template name="insertBodyLastFooter"/>
  </xsl:template>

  <!-- ============================================================
       Page masters. pdf2's `$mirror-page-margins` is a hard-coded
       variable, so the even masters are always declared here and the
       page-sequence-master decides whether they are used.
       ============================================================ -->
  <xsl:template name="de-page-master">
    <xsl:param name="name" as="xs:string"/>
    <xsl:param name="group" as="xs:string" select="'body'"/>
    <xsl:param name="even" as="xs:boolean" select="false()"/>
    <xsl:param name="header" as="xs:string" select="''"/>
    <xsl:param name="footer" as="xs:string" select="''"/>
    <fo:simple-page-master master-name="{$name}" xsl:use-attribute-sets="simple-page-master">
      <!-- `xsl:use-attribute-sets` cannot take an attribute value template, so the
           region-body set is selected with an explicit choice over (group, even). -->
      <xsl:choose>
        <xsl:when test="$group = 'frontmatter' and not($even)">
          <fo:region-body xsl:use-attribute-sets="region-body__frontmatter.odd"/>
        </xsl:when>
        <xsl:when test="$group = 'frontmatter' and $even">
          <fo:region-body xsl:use-attribute-sets="region-body__frontmatter.even"/>
        </xsl:when>
        <xsl:when test="$group = 'index' and not($even)">
          <fo:region-body xsl:use-attribute-sets="region-body__index.odd"/>
        </xsl:when>
        <xsl:when test="$group = 'index' and $even">
          <fo:region-body xsl:use-attribute-sets="region-body__index.even"/>
        </xsl:when>
        <xsl:when test="$even">
          <fo:region-body xsl:use-attribute-sets="region-body.even"/>
        </xsl:when>
        <xsl:otherwise>
          <fo:region-body xsl:use-attribute-sets="region-body.odd"/>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="string($header) != ''">
        <fo:region-before region-name="{$header}" xsl:use-attribute-sets="region-before"/>
      </xsl:if>
      <xsl:if test="string($footer) != ''">
        <fo:region-after region-name="{$footer}" xsl:use-attribute-sets="region-after"/>
      </xsl:if>
    </fo:simple-page-master>
  </xsl:template>

  <xsl:template match="/" mode="create-page-masters">
    <!-- front matter (cover) -->
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'front-matter-first'"/>
      <xsl:with-param name="group" select="'frontmatter'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'front-matter-odd'"/>
      <xsl:with-param name="group" select="'frontmatter'"/>
      <xsl:with-param name="header" select="'odd-frontmatter-header'"/>
      <xsl:with-param name="footer" select="'odd-frontmatter-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'front-matter-even'"/>
      <xsl:with-param name="group" select="'frontmatter'"/>
      <xsl:with-param name="even" select="true()"/>
      <xsl:with-param name="header" select="'even-frontmatter-header'"/>
      <xsl:with-param name="footer" select="'even-frontmatter-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'front-matter-last'"/>
      <xsl:with-param name="group" select="'frontmatter'"/>
      <xsl:with-param name="even" select="true()"/>
      <xsl:with-param name="header" select="'last-frontmatter-header'"/>
      <xsl:with-param name="footer" select="'last-frontmatter-footer'"/>
    </xsl:call-template>

    <!-- table of contents -->
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'toc-first'"/>
      <xsl:with-param name="header" select="'odd-toc-header'"/>
      <xsl:with-param name="footer" select="'odd-toc-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'toc-odd'"/>
      <xsl:with-param name="header" select="'odd-toc-header'"/>
      <xsl:with-param name="footer" select="'odd-toc-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'toc-even'"/>
      <xsl:with-param name="even" select="true()"/>
      <xsl:with-param name="header" select="'even-toc-header'"/>
      <xsl:with-param name="footer" select="'even-toc-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'toc-last'"/>
      <xsl:with-param name="even" select="true()"/>
      <xsl:with-param name="header" select="'even-toc-header'"/>
      <xsl:with-param name="footer" select="'even-toc-footer'"/>
    </xsl:call-template>

    <!-- body -->
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'body-first'"/>
      <xsl:with-param name="header" select="'first-body-header'"/>
      <xsl:with-param name="footer" select="'first-body-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'body-odd'"/>
      <xsl:with-param name="header" select="'odd-body-header'"/>
      <xsl:with-param name="footer" select="'odd-body-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'body-even'"/>
      <xsl:with-param name="even" select="true()"/>
      <xsl:with-param name="header" select="'even-body-header'"/>
      <xsl:with-param name="footer" select="'even-body-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'body-last'"/>
      <xsl:with-param name="even" select="true()"/>
      <xsl:with-param name="header" select="'last-body-header'"/>
      <xsl:with-param name="footer" select="'last-body-footer'"/>
    </xsl:call-template>

    <!-- index -->
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'index-first'"/>
      <xsl:with-param name="group" select="'index'"/>
      <xsl:with-param name="header" select="'odd-index-header'"/>
      <xsl:with-param name="footer" select="'odd-index-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'index-odd'"/>
      <xsl:with-param name="group" select="'index'"/>
      <xsl:with-param name="header" select="'odd-index-header'"/>
      <xsl:with-param name="footer" select="'odd-index-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'index-even'"/>
      <xsl:with-param name="group" select="'index'"/>
      <xsl:with-param name="even" select="true()"/>
      <xsl:with-param name="header" select="'even-index-header'"/>
      <xsl:with-param name="footer" select="'even-index-footer'"/>
    </xsl:call-template>

    <!-- glossary -->
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'glossary-first'"/>
      <xsl:with-param name="header" select="'odd-glossary-header'"/>
      <xsl:with-param name="footer" select="'odd-glossary-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'glossary-odd'"/>
      <xsl:with-param name="header" select="'odd-glossary-header'"/>
      <xsl:with-param name="footer" select="'odd-glossary-footer'"/>
    </xsl:call-template>
    <xsl:call-template name="de-page-master">
      <xsl:with-param name="name" select="'glossary-even'"/>
      <xsl:with-param name="even" select="true()"/>
      <xsl:with-param name="header" select="'even-glossary-header'"/>
      <xsl:with-param name="footer" select="'even-glossary-footer'"/>
    </xsl:call-template>
  </xsl:template>

  <!-- Re-implemented so mirrored (even) masters are used only when the
       document asked for mirrored margins. -->
  <xsl:template name="generate-page-sequence-master">
    <xsl:param name="master-name" as="xs:string"/>
    <xsl:param name="master-reference" as="xs:string"/>
    <xsl:param name="first" as="xs:boolean" select="true()"/>
    <xsl:param name="last" as="xs:boolean" select="true()"/>
    <fo:page-sequence-master master-name="{$master-name}">
      <fo:repeatable-page-master-alternatives>
        <xsl:if test="$first">
          <fo:conditional-page-master-reference master-reference="{$master-reference}-first"
                                                odd-or-even="odd"
                                                page-position="first"/>
        </xsl:if>
        <xsl:if test="$last">
          <fo:conditional-page-master-reference master-reference="{$master-reference}-last"
                                                odd-or-even="even"
                                                page-position="last"/>
        </xsl:if>
        <xsl:choose>
          <xsl:when test="$de-mirror-margins">
            <fo:conditional-page-master-reference master-reference="{$master-reference}-odd"
                                                  odd-or-even="odd"/>
            <fo:conditional-page-master-reference master-reference="{$master-reference}-even"
                                                  odd-or-even="even"/>
          </xsl:when>
          <xsl:otherwise>
            <fo:conditional-page-master-reference master-reference="{$master-reference}-odd"/>
          </xsl:otherwise>
        </xsl:choose>
      </fo:repeatable-page-master-alternatives>
    </fo:page-sequence-master>
  </xsl:template>

</xsl:stylesheet>
