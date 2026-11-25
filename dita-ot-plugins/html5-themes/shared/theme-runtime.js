/*!
 * DITAEditor HTML5 theme runtime
 * ---------------------------------------------------------------------------
 * Zero-dependency classic script (no modules, no imports, no network) that
 * turns a stock DITA-OT HTML5 page plus the injected chrome into the themed
 * documentation shell: sidebar tree, on-page outline, offline search, code
 * copy, prev/next pager, color mode and the portal landing page.
 *
 * Inputs (written by Html5ThemeEnhancer, see dita-ot-plugins/html5-themes):
 *   <html data-de-theme data-de-root data-de-mode data-de-portal>
 *   window.__DITA_THEME_CONFIG__  { themeId, locale, siteTitle, defaultMode,
 *                                   portal, features{...}, labels{13 keys} }
 *   window.__DITA_SEARCH_INDEX__  [{ href, title, summary, text }]
 *   header.de-header / nav.toc / footer.de-footer / .de-search / .de-backdrop
 *
 * Output layout (this file creates it):
 *   .de-layout > .de-sidebar (nav.toc) | main.de-main#de-main | .de-onpage
 *
 * All user visible strings come from config.labels; every label falls back to
 * a neutral English default so the file contains no locale-specific branches.
 * Runs from file:// as well as from a static host or the workbench preview.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Contract defaults                                                    */
  /* ------------------------------------------------------------------ */

  var DEFAULT_LABELS = {
    search: 'Search',
    searchPlaceholder: 'Search this document set',
    noResults: 'No results found',
    clear: 'Clear',
    copy: 'Copy',
    copied: 'Copied',
    onThisPage: 'On this page',
    menu: 'Contents',
    close: 'Close',
    themeToggle: 'Toggle color mode',
    prev: 'Previous',
    next: 'Next',
    shortcutHint: 'Ctrl K'
  };

  var DEFAULT_FEATURES = {
    search: true,
    toc: true,
    codeCopy: true,
    colorModeToggle: true
  };

  /** Themes whose intrinsic palette is dark; used when config.defaultMode is absent. */
  var DARK_DEFAULT_THEMES = { 'dev-dark': true };

  var MODE_STORAGE_KEY = 'de-color-mode';
  var NAV_STORAGE_KEY = 'de-nav-state';
  var MAX_SEARCH_RESULTS = 20;
  var MAX_ONPAGE_HEADINGS = 60;
  var COPY_RESET_MS = 1500;

  var ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="7"></circle><path d="m20.5 20.5-3.9-3.9"></path>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"></path>',
    close: '<path d="M6 6l12 12M18 6 6 18"></path>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h8"></path>',
    chevron: '<path d="m9 5 7 7-7 7"></path>',
    sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"></path>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"></path>'
  };

  /* ------------------------------------------------------------------ */
  /* Config + shared state                                                */
  /* ------------------------------------------------------------------ */

  var config = readConfig() || {};
  var labels = mergeLabels(DEFAULT_LABELS, config.labels);
  var features = mergeFeatures(DEFAULT_FEATURES, config.features);
  var documentElement = document.documentElement;
  var themeId = config.themeId || documentElement.getAttribute('data-de-theme') || '';
  var siteTitle = typeof config.siteTitle === 'string' ? config.siteTitle : '';
  var rootPrefix = normalizeRoot(documentElement.getAttribute('data-de-root'));
  var searchIndex = Array.isArray(window.__DITA_SEARCH_INDEX__) ? window.__DITA_SEARCH_INDEX__ : [];
  var warned = false;

  var state = {
    header: null,
    main: null,
    sidebar: null,
    nav: null,
    onpage: null,
    search: null,
    backdrop: null,
    searchOpen: false,
    drawerOpen: false,
    activeOnpageId: '',
    modeToggle: null,
    navToggle: null,
    trap: null
  };

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                        */
  /* ------------------------------------------------------------------ */

  function readConfig() {
    var raw = window.__DITA_THEME_CONFIG__;
    return raw && typeof raw === 'object' ? raw : null;
  }

  function mergeLabels(base, override) {
    var merged = {};
    var key;
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) merged[key] = base[key];
    }
    if (override && typeof override === 'object') {
      for (key in override) {
        if (Object.prototype.hasOwnProperty.call(override, key) && typeof override[key] === 'string' && override[key]) {
          merged[key] = override[key];
        }
      }
    }
    return merged;
  }

  function mergeFeatures(base, override) {
    var merged = {};
    var key;
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) merged[key] = base[key];
    }
    if (override && typeof override === 'object') {
      for (key in override) {
        if (Object.prototype.hasOwnProperty.call(override, key) && typeof override[key] === 'boolean') {
          merged[key] = override[key];
        }
      }
    }
    return merged;
  }

  function normalizeRoot(value) {
    var root = typeof value === 'string' ? value : './';
    if (!root || root.charAt(root.length - 1) !== '/') root = root + '/';
    if (root.charAt(0) === '/' || /^[a-z][a-z0-9+.-]*:/i.test(root)) return './';
    return root;
  }

  /** Resolve an output-root-relative href (search index / TOC) against data-de-root. */
  function resolveHref(href) {
    var value = typeof href === 'string' ? href : '';
    if (!value) return rootPrefix + 'index.html';
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.charAt(0) === '/' || value.charAt(0) === '#') return value;
    return rootPrefix + value.replace(/^\.\//, '');
  }

  function warn(message) {
    if (warned) return;
    warned = true;
    if (window.console && window.console.warn) window.console.warn('[ditaeditor] ' + message);
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function icon(name, className) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.75');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (className) svg.setAttribute('class', className);
    svg.innerHTML = ICON_PATHS[name] || '';
    return svg;
  }

  function button(className, label) {
    var node = el('button', className);
    node.type = 'button';
    if (label) node.setAttribute('aria-label', label);
    return node;
  }

  function text(tag, className, value) {
    var node = el(tag, className);
    node.textContent = value == null ? '' : String(value);
    return node;
  }

  function closest(node, selector) {
    var current = node;
    while (current && current.nodeType === 1) {
      if (current.matches && current.matches(selector)) return current;
      current = current.parentNode;
    }
    return null;
  }

  function directChild(node, selector) {
    var children = node.children || [];
    for (var i = 0; i < children.length; i += 1) {
      if (children[i].matches && children[i].matches(selector)) return children[i];
    }
    return null;
  }

  function directChildren(node, selector) {
    var out = [];
    var children = node.children || [];
    for (var i = 0; i < children.length; i += 1) {
      if (children[i].matches && children[i].matches(selector)) out.push(children[i]);
    }
    return out;
  }

  function collect(rootNode, selector) {
    var list = rootNode ? rootNode.querySelectorAll(selector) : [];
    var out = [];
    for (var i = 0; i < list.length; i += 1) out.push(list[i]);
    return out;
  }

  function headerHeight() {
    if (!state.header) return 56;
    var height = state.header.getBoundingClientRect().height;
    return height > 0 ? Math.round(height) : 56;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function storageGet(key) {
    try {
      return window.sessionStorage ? window.sessionStorage.getItem(key) : null;
    } catch (err) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      if (window.sessionStorage) window.sessionStorage.setItem(key, value);
    } catch (err) {
      /* file:// or privacy mode: sidebar collapse state is a nicety, not a requirement */
    }
  }

  function persistGet(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (err) {
      return null;
    }
  }

  function persistSet(key, value) {
    try {
      if (window.localStorage) window.localStorage.setItem(key, value);
    } catch (err) {
      /* ignore: the mode simply will not be remembered */
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                 */
  /* ------------------------------------------------------------------ */

  function boot() {
    var body = document.body;
    if (!body) return;
    if (body.getAttribute('data-de-runtime') === 'ready') return;
    body.setAttribute('data-de-runtime', 'ready');

    state.header = body.querySelector('header.de-header');
    state.backdrop = body.querySelector('.de-backdrop');
    state.nav = findTocNav(body);
    if (!state.header) warn('theme runtime: header.de-header is missing');
    if (!state.nav) warn('theme runtime: nav.toc is missing');

    applyMode();
    state.main = resolveMain(body);
    state.sidebar = buildSidebar();
    state.onpage = buildOnpage();
    assembleLayout(body);
    addSkipLink(body);
    decorateSidebarTree();
    wireHeader();
    wireBackdrop();
    buildPager();
    wrapTables();
    enhanceCodeBlocks();
    if (features.search) buildSearch();
    if (isPortal()) buildPortal();
    handleInitialHash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* ------------------------------------------------------------------ */
  /* Layout                                                               */
  /* ------------------------------------------------------------------ */

  function isChromeNode(node) {
    if (node.nodeType === 3) return !node.nodeValue || !node.nodeValue.trim();
    if (node.nodeType !== 1) return true;
    var tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'template' || tag === 'noscript') return true;
    if (node === state.header || node === state.nav || node === state.backdrop) return true;
    return (
      node.classList.contains('de-header') ||
      node.classList.contains('de-footer') ||
      node.classList.contains('de-search') ||
      node.classList.contains('de-backdrop') ||
      node.classList.contains('de-skip') ||
      node.classList.contains('de-layout') ||
      node.classList.contains('de-portal')
    );
  }

  /**
   * DITA-OT emits the map navigation either as `nav.toc` (topic pages) or as a bare
   * `<nav><ul class="map">` on the generated `index.html`, so fall back to the first
   * direct `<nav>` child that owns a list, never the `.related-links` nav.
   */
  function findTocNav(body) {
    var fallback = null;
    for (var i = 0; i < body.children.length; i += 1) {
      var child = body.children[i];
      if (child.tagName !== 'NAV') continue;
      if (child.classList.contains('toc') || child.getAttribute('role') === 'toc') return child;
      if (fallback || child.classList.contains('related-links')) continue;
      if (child.querySelector('ul')) fallback = child;
    }
    return fallback || body.querySelector('nav.toc');
  }

  /**
   * DITA-OT already emits <main role="main">; adopt it instead of nesting a
   * second <main>, then move every remaining content node inside it.
   */
  function resolveMain(body) {
    var main = body.querySelector('main.de-main') || body.querySelector('main[role="main"]');
    if (!main) {
      main = el('main', 'de-main');
    } else if (!main.classList.contains('de-main')) {
      main.classList.add('de-main');
    }
    if (!main.id) main.id = 'de-main';
    main.setAttribute('tabindex', '-1');

    var nodes = [];
    for (var i = 0; i < body.childNodes.length; i += 1) nodes.push(body.childNodes[i]);
    for (var j = 0; j < nodes.length; j += 1) {
      var node = nodes[j];
      if (node === main) continue;
      if (isChromeNode(node)) continue;
      main.appendChild(node);
    }
    return main;
  }

  function buildSidebar() {
    if (!state.nav || isPortal()) return null;
    var aside = el('aside', 'de-sidebar');
    aside.setAttribute('aria-label', labels.menu);
    var title = text('div', 'de-sidebar-title', siteTitle || document.title || '');
    aside.appendChild(title);
    aside.appendChild(state.nav);
    return aside;
  }

  function assembleLayout(body) {
    var layout = el('div', 'de-layout');
    if (state.sidebar) {
      layout.appendChild(state.sidebar);
    } else {
      layout.classList.add('de-layout--no-sidebar');
    }
    layout.appendChild(state.main);
    if (state.onpage) {
      layout.appendChild(state.onpage);
    } else {
      layout.classList.add('de-layout--no-onpage');
    }
    if (!state.sidebar && !state.onpage) layout.classList.add('de-layout--solo');

    var reference = state.header && state.header.parentNode === body ? state.header.nextSibling : body.firstChild;
    body.insertBefore(layout, reference);
  }

  function addSkipLink(body) {
    var skip = el('a', 'de-skip');
    skip.href = '#de-main';
    skip.textContent = (document.title || siteTitle || labels.menu).trim();
    body.insertBefore(skip, body.firstChild);
  }

  /* ------------------------------------------------------------------ */
  /* Sidebar tree                                                         */
  /* ------------------------------------------------------------------ */

  function collapsedSet() {
    var raw = storageGet(NAV_STORAGE_KEY);
    var map = {};
    if (!raw) return map;
    var parsed = raw.split('|');
    for (var i = 0; i < parsed.length; i += 1) {
      if (parsed[i]) map[parsed[i]] = true;
    }
    return map;
  }

  function saveCollapsed(map) {
    var keys = [];
    for (var key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key) && map[key]) keys.push(key);
    }
    storageSet(NAV_STORAGE_KEY, keys.join('|'));
  }

  function decorateSidebarTree() {
    var nav = state.nav;
    if (!nav) return;
    var items = collect(nav, 'li');
    var collapsed = collapsedSet();
    var activeItem = null;

    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      item.classList.add('de-tree-item');
      var sublist = directChild(item, 'ul');
      if (!sublist) continue;
      item.classList.add('de-tree-item--has-children');
      var link = directChild(item, 'a[href]');
      var key = link ? link.getAttribute('href') : 'item-' + i;
      item.setAttribute('data-de-key', key);

      var toggle = button('de-tree-toggle', link ? (link.textContent || '').trim() || labels.menu : labels.menu);
      toggle.appendChild(icon('chevron', 'de-tree-chevron'));
      toggle.setAttribute('aria-expanded', 'true');
      toggle.addEventListener('click', makeTreeToggle(item, key));
      item.insertBefore(toggle, item.firstChild);

      if (collapsed[key]) {
        item.classList.add('de-tree-item--collapsed');
        toggle.setAttribute('aria-expanded', 'false');
      }
      if (isCurrentLink(link)) {
        activeItem = item;
        item.classList.add('de-tree-item--active');
        if (link) link.setAttribute('aria-current', 'page');
      }
    }

    if (activeItem) {
      var ancestor = activeItem.parentNode;
      while (ancestor && ancestor !== nav) {
        if (ancestor.nodeType === 1 && ancestor.classList && ancestor.classList.contains('de-tree-item--collapsed')) {
          ancestor.classList.remove('de-tree-item--collapsed');
          var parentToggle = directChild(ancestor, '.de-tree-toggle');
          if (parentToggle) parentToggle.setAttribute('aria-expanded', 'true');
        }
        ancestor = ancestor.parentNode;
      }
      scrollSidebarTo(activeItem);
    }
  }

  function makeTreeToggle(item, key) {
    return function onToggle() {
      var toggle = directChild(item, '.de-tree-toggle');
      var isCollapsed = item.classList.toggle('de-tree-item--collapsed');
      if (toggle) toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      var map = collapsedSet();
      if (isCollapsed) map[key] = true;
      else delete map[key];
      saveCollapsed(map);
    };
  }

  function scrollSidebarTo(item) {
    var sidebar = state.sidebar;
    if (!sidebar) return;
    window.requestAnimationFrame(function () {
      var itemRect = item.getBoundingClientRect();
      var sidebarRect = sidebar.getBoundingClientRect();
      if (itemRect.top < sidebarRect.top || itemRect.bottom > sidebarRect.bottom) {
        sidebar.scrollTop += itemRect.top - sidebarRect.top - sidebarRect.height / 3;
      }
    });
  }

  function isCurrentLink(link) {
    if (!link) return false;
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#') return false;
    var path = absolutePath(link);
    return !!path && path === decodeURI(window.location.pathname);
  }

  function absolutePath(link) {
    var href = link.getAttribute('href');
    if (!href) return null;
    try {
      var url = new URL(link.href, document.baseURI || window.location.href);
      return decodeURI(url.pathname);
    } catch (err) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* On-page outline + scroll spy                                         */
  /* ------------------------------------------------------------------ */

  function slugify(value) {
    var slug = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s\u3000]+/g, '-')
      .replace(/[^\w\u00c0-\u024f\u0400-\u04ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af-]+/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug.slice(0, 60);
  }

  function ensureHeadingId(heading, index) {
    if (heading.id) return heading.id;
    var base = slugify(heading.textContent) || 'section-' + (index + 1);
    var candidate = base;
    var suffix = 1;
    while (document.getElementById(candidate)) {
      suffix += 1;
      candidate = base + '-' + suffix;
    }
    heading.id = candidate;
    return candidate;
  }

  function buildOnpage() {
    if (!features.toc || isPortal()) return null;
    var main = state.main;
    if (!main) return null;
    var headings = collect(main, 'h2, h3');
    if (!headings.length) return null;

    var aside = el('aside', 'de-onpage');
    aside.setAttribute('aria-label', labels.onThisPage);
    aside.appendChild(text('p', 'de-onpage-title', labels.onThisPage));

    var list = el('ul', 'de-onpage-list');
    var usable = [];
    for (var i = 0; i < headings.length && usable.length < MAX_ONPAGE_HEADINGS; i += 1) {
      var heading = headings[i];
      if (heading.hidden) continue;
      if (closest(heading, '.note, table, .de-portal-hero')) continue;
      var value = (heading.textContent || '').replace(/\s+/g, ' ').trim();
      if (!value) continue;
      var id = ensureHeadingId(heading, i);
      var item = el('li', 'de-onpage-item');
      var link = el('a', 'de-onpage-link');
      link.href = '#' + id;
      link.textContent = value;
      if (heading.tagName === 'H3') link.classList.add('de-onpage-link--sub');
      item.appendChild(link);
      list.appendChild(item);
      usable.push({ heading: heading, link: link, id: id });
    }
    if (!usable.length) return null;

    aside.appendChild(list);
    setupScrollSpy(aside, usable);
    return aside;
  }

  function activateOnpage(id) {
    if (!state.onpage || state.activeOnpageId === id) return;
    var links = collect(state.onpage, '.de-onpage-link');
    for (var i = 0; i < links.length; i += 1) {
      var isActive = links[i].getAttribute('href') === '#' + id;
      links[i].classList.toggle('de-onpage-link--active', isActive);
      if (isActive) links[i].setAttribute('aria-current', 'true');
      else links[i].removeAttribute('aria-current');
    }
    state.activeOnpageId = id;
  }

  function setupScrollSpy(aside, entries) {
    if (aside) {
      aside.addEventListener('click', function onOutlineClick(ev) {
        var link = closest(ev.target, 'a[href^="#"]');
        if (!link) return;
        var target = document.getElementById(link.getAttribute('href').slice(1));
        if (!target) return;
        ev.preventDefault();
        scrollToTarget(target);
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', link.getAttribute('href'));
        }
        activateOnpage(target.id);
      });
    }

    if ('IntersectionObserver' in window) {
      var visible = {};
      var observer = new IntersectionObserver(
        function onIntersect(records) {
          for (var i = 0; i < records.length; i += 1) {
            var record = records[i];
            if (record.isIntersecting) visible[record.target.id] = record.boundingClientRect.top;
            else delete visible[record.target.id];
          }
          var bestId = '';
          var bestTop = Infinity;
          for (var id in visible) {
            if (Object.prototype.hasOwnProperty.call(visible, id) && visible[id] < bestTop) {
              bestTop = visible[id];
              bestId = id;
            }
          }
          if (!bestId) bestId = nearestHeadingAbove(entries);
          if (bestId) activateOnpage(bestId);
        },
        { rootMargin: '-' + (headerHeight() + 16) + 'px 0px -55% 0px', threshold: [0, 1] }
      );
      for (var i = 0; i < entries.length; i += 1) observer.observe(entries[i].heading);
      return;
    }

    var scheduled = false;
    var onScroll = function onScroll() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        var id = nearestHeadingAbove(entries);
        if (id) activateOnpage(id);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  /** Last heading whose top edge passed the header, else the first heading. */
  function nearestHeadingAbove(entries) {
    var offset = headerHeight() + 16;
    var best = '';
    for (var i = 0; i < entries.length; i += 1) {
      var rect = entries[i].heading.getBoundingClientRect();
      if (rect.top - offset <= 0) best = entries[i].id;
      else break;
    }
    if (!best && entries.length) best = entries[0].id;
    return best;
  }

  function scrollToTarget(target) {
    var top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight() + 1;
    if (top < 0) top = 0;
    if (prefersReducedMotion()) window.scrollTo(0, top);
    else window.scrollTo({ top: top, behavior: 'smooth' });
  }

  function handleInitialHash() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    var target = document.getElementById(hash.slice(1));
    if (!target) return;
    window.requestAnimationFrame(function () {
      window.scrollTo(0, target.getBoundingClientRect().top + window.pageYOffset - headerHeight() + 1);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Header, drawer, focus trap                                           */
  /* ------------------------------------------------------------------ */

  function wireHeader() {
    var header = state.header;
    if (header) {
      var brand = header.querySelector('.de-brand');
      if (brand && brand.tagName === 'A') brand.setAttribute('href', resolveHref('index.html'));

      var searchTrigger = header.querySelector('[data-de="search-trigger"]');
      if (searchTrigger) {
        if (features.search) {
          searchTrigger.setAttribute('aria-label', labels.search);
          searchTrigger.setAttribute('title', labels.search);
          searchTrigger.setAttribute('aria-haspopup', 'dialog');
          searchTrigger.insertBefore(icon('search', 'de-search-icon'), searchTrigger.firstChild);
          searchTrigger.addEventListener('click', openSearch);
        } else {
          searchTrigger.hidden = true;
        }
      }

      var modeToggle = header.querySelector('[data-de="mode-toggle"]');
      state.modeToggle = modeToggle;
      if (modeToggle) {
        if (features.colorModeToggle) {
          modeToggle.setAttribute('aria-label', labels.themeToggle);
          modeToggle.setAttribute('title', labels.themeToggle);
          modeToggle.addEventListener('click', toggleMode);
          syncModeToggle();
        } else {
          modeToggle.hidden = true;
        }
      }

      var navToggle = header.querySelector('[data-de="nav-toggle"]');
      state.navToggle = navToggle;
      if (navToggle) {
        if (state.sidebar) {
          navToggle.setAttribute('aria-label', labels.menu);
          navToggle.setAttribute('title', labels.menu);
          navToggle.setAttribute('aria-expanded', 'false');
          navToggle.setAttribute('aria-controls', 'de-sidebar');
          state.sidebar.id = 'de-sidebar';
          navToggle.appendChild(icon('menu', 'de-nav-icon'));
          navToggle.addEventListener('click', function () {
            setDrawer(!state.drawerOpen);
          });
        } else {
          navToggle.hidden = true;
        }
      }
    }

    document.addEventListener('keydown', onGlobalKey);
  }

  function wireBackdrop() {
    if (!state.backdrop) return;
    state.backdrop.addEventListener('click', function () {
      if (state.searchOpen) closeSearch();
      else setDrawer(false);
    });
  }

  function setDrawer(open) {
    state.drawerOpen = open;
    documentElement.classList.toggle('de-nav-open', open);
    if (state.backdrop) state.backdrop.hidden = !open;
    if (state.navToggle) state.navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) trapFocus(state.sidebar);
    else if (!state.searchOpen) releaseTrap();
  }

  function onGlobalKey(ev) {
    var key = ev.key || '';
    if ((ev.metaKey || ev.ctrlKey) && (key === 'k' || key === 'K')) {
      if (!features.search || !state.search) return;
      ev.preventDefault();
      if (state.searchOpen) closeSearch();
      else openSearch();
      return;
    }
    if (key === 'Escape') {
      if (state.searchOpen) {
        closeSearch();
        return;
      }
      if (state.drawerOpen) setDrawer(false);
    }
  }

  function focusables(container) {
    if (!container) return [];
    return collect(container, 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])').filter(
      function visible(node) {
        return !node.hidden && node.getClientRects().length > 0;
      }
    );
  }

  function trapFocus(container) {
    if (!container) return;
    releaseTrap();
    state.trap = { container: container, previous: document.activeElement };
    document.addEventListener('keydown', onTrapKey, true);
  }

  function releaseTrap() {
    if (!state.trap) return;
    document.removeEventListener('keydown', onTrapKey, true);
    var previous = state.trap.previous;
    state.trap = null;
    if (previous && typeof previous.focus === 'function') {
      try {
        previous.focus();
      } catch (err) {
        /* detached node */
      }
    }
  }

  function onTrapKey(ev) {
    if (ev.key !== 'Tab' || !state.trap) return;
    var nodes = focusables(state.trap.container);
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Color mode                                                           */
  /* ------------------------------------------------------------------ */

  function resolveMode() {
    var stored = persistGet(MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (config && (config.defaultMode === 'light' || config.defaultMode === 'dark')) return config.defaultMode;
    return DARK_DEFAULT_THEMES[themeId] ? 'dark' : 'light';
  }

  function applyMode() {
    documentElement.setAttribute('data-de-mode', resolveMode());
  }

  function currentMode() {
    return documentElement.getAttribute('data-de-mode') === 'dark' ? 'dark' : 'light';
  }

  function toggleMode() {
    var next = currentMode() === 'dark' ? 'light' : 'dark';
    documentElement.setAttribute('data-de-mode', next);
    persistSet(MODE_STORAGE_KEY, next);
    syncModeToggle();
  }

  function syncModeToggle() {
    var toggle = state.modeToggle;
    if (!toggle) return;
    var dark = currentMode() === 'dark';
    toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
    toggle.textContent = '';
    toggle.appendChild(icon(dark ? 'sun' : 'moon', 'de-mode-icon'));
  }

  /* ------------------------------------------------------------------ */
  /* Search                                                               */
  /* ------------------------------------------------------------------ */

  function buildSearch() {
    var host = document.querySelector('.de-search');
    if (!host) {
      warn('theme runtime: .de-search host is missing');
      return;
    }
    host.textContent = '';
    host.setAttribute('role', 'presentation');

    var panel = el('div', 'de-search-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', labels.search);

    var bar = el('div', 'de-search-bar');
    bar.appendChild(icon('search', 'de-search-icon'));

    var input = document.createElement('input');
    input.type = 'search';
    input.className = 'de-search-input';
    input.placeholder = labels.searchPlaceholder;
    input.setAttribute('aria-label', labels.search);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', 'de-search-results');
    bar.appendChild(input);

    bar.appendChild(text('span', 'de-kbd de-search-kbd', labels.shortcutHint));

    var closeBtn = button('de-icon-btn de-search-close', labels.close);
    closeBtn.appendChild(icon('close', 'de-search-close-icon'));
    closeBtn.addEventListener('click', closeSearch);
    bar.appendChild(closeBtn);
    panel.appendChild(bar);

    var results = el('ul', 'de-search-results');
    results.id = 'de-search-results';
    results.setAttribute('role', 'listbox');
    results.setAttribute('aria-label', labels.search);
    panel.appendChild(results);

    var empty = text('div', 'de-search-empty', labels.noResults);
    empty.hidden = true;
    panel.appendChild(empty);

    host.appendChild(panel);
    state.search = { host: host, panel: panel, input: input, results: results, empty: empty, entries: [], active: -1 };

    input.addEventListener('input', onSearchInput);
    input.addEventListener('keydown', onSearchKey);
    results.addEventListener('mousemove', onSearchHover);
    results.addEventListener('click', function onResultClick(ev) {
      if (closest(ev.target, 'a[href]')) closeSearch();
    });
  }

  function openSearch() {
    if (!state.search) return;
    state.searchOpen = true;
    state.search.host.hidden = false;
    documentElement.classList.add('de-search-open');
    trapFocus(state.search.panel);
    state.search.input.value = '';
    renderSearch('');
    state.search.input.focus();
  }

  function closeSearch() {
    if (!state.search || !state.searchOpen) return;
    state.searchOpen = false;
    state.search.host.hidden = true;
    documentElement.classList.remove('de-search-open');
    if (!state.drawerOpen) releaseTrap();
    /* Browsers keep focus on a just-hidden input in some cases; move it back
       to the trigger so keyboard users are not stranded on an invisible node. */
    if (state.search.host.contains(document.activeElement)) {
      var trigger = document.querySelector('[data-de="search-trigger"]');
      if (trigger) trigger.focus();
      else document.activeElement.blur();
    }
  }

  /* Rendered synchronously: ranking the index and writing <= 20 rows is cheap,
     and requestAnimationFrame does not fire in background tabs or prerenders. */
  function onSearchInput() {
    if (!state.search) return;
    renderSearch(state.search.input.value);
  }

  function searchTerms(query) {
    var terms = String(query || '').toLowerCase().split(/\s+/);
    var out = [];
    for (var i = 0; i < terms.length; i += 1) {
      if (terms[i]) out.push(terms[i]);
    }
    return out;
  }

  function rankEntries(terms) {
    if (!terms.length) return [];
    var scored = [];
    for (var i = 0; i < searchIndex.length; i += 1) {
      var entry = searchIndex[i];
      if (!entry || typeof entry !== 'object') continue;
      var title = String(entry.title || '').toLowerCase();
      var summary = String(entry.summary || '').toLowerCase();
      var body = String(entry.text || '').toLowerCase();
      var score = 0;
      var matchedAll = true;
      for (var t = 0; t < terms.length; t += 1) {
        var term = terms[t];
        var termScore = 0;
        if (title === term) termScore += 120;
        else if (title.indexOf(term) === 0) termScore += 80;
        else if (title.indexOf(term) > -1) termScore += 55;
        if (summary.indexOf(term) > -1) termScore += 18;
        if (body.indexOf(term) > -1) termScore += 6;
        if (!termScore) {
          matchedAll = false;
          break;
        }
        score += termScore;
      }
      if (!matchedAll) continue;
      scored.push({ entry: entry, score: score });
    }
    scored.sort(function byScore(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.entry.title || '').localeCompare(String(b.entry.title || ''));
    });
    return scored.slice(0, MAX_SEARCH_RESULTS);
  }

  function renderSearch(query) {
    var dom = state.search;
    if (!dom) return;
    var terms = searchTerms(query);
    dom.results.textContent = '';
    dom.entries = [];
    dom.active = -1;

    if (!terms.length) {
      /* No query yet: show nothing at all, never an empty-state flash. */
      dom.empty.hidden = true;
      return;
    }

    var ranked = rankEntries(terms);
    if (!ranked.length) {
      dom.empty.hidden = false;
      return;
    }
    dom.empty.hidden = true;

    var fragment = document.createDocumentFragment();
    for (var i = 0; i < ranked.length; i += 1) {
      dom.entries.push(ranked[i].entry);
      fragment.appendChild(renderResultRow(ranked[i].entry, i, terms));
    }
    dom.results.appendChild(fragment);
    dom.results.scrollTop = 0;
  }

  function renderResultRow(entry, index, terms) {
    var item = el('li', 'de-search-item');
    item.id = 'de-search-result-' + index;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', 'false');
    item.setAttribute('data-de-index', String(index));

    var link = el('a', 'de-search-link');
    link.href = resolveHref(entry.href);

    var title = el('span', 'de-search-title');
    highlightMatches(title, entry.title, terms);
    link.appendChild(title);

    if (entry.summary) {
      var summary = el('span', 'de-search-summary');
      highlightMatches(summary, entry.summary, terms);
      link.appendChild(summary);
    }
    if (entry.href) link.appendChild(text('span', 'de-search-path', String(entry.href)));

    item.appendChild(link);
    return item;
  }

  /** Build DOM nodes only: the source text is never parsed as HTML. */
  function highlightMatches(container, value, terms) {
    container.textContent = '';
    var source = value == null ? '' : String(value);
    if (!terms.length || !source) {
      container.textContent = source;
      return;
    }
    var haystack = source.toLowerCase();
    var ranges = [];
    for (var t = 0; t < terms.length; t += 1) {
      var term = terms[t];
      if (!term) continue;
      var from = 0;
      var hits = 0;
      while (hits < 12) {
        var at = haystack.indexOf(term, from);
        if (at < 0) break;
        ranges.push([at, at + term.length]);
        from = at + term.length;
        hits += 1;
      }
    }
    if (!ranges.length) {
      container.textContent = source;
      return;
    }
    ranges.sort(function byStart(a, b) {
      return a[0] - b[0];
    });
    var merged = [];
    for (var i = 0; i < ranges.length; i += 1) {
      var last = merged[merged.length - 1];
      if (last && ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
      else merged.push(ranges[i]);
    }
    var cursor = 0;
    for (var r = 0; r < merged.length; r += 1) {
      if (merged[r][0] > cursor) container.appendChild(document.createTextNode(source.slice(cursor, merged[r][0])));
      var mark = el('mark');
      mark.textContent = source.slice(merged[r][0], merged[r][1]);
      container.appendChild(mark);
      cursor = merged[r][1];
    }
    if (cursor < source.length) container.appendChild(document.createTextNode(source.slice(cursor)));
  }

  function moveActive(delta) {
    var dom = state.search;
    if (!dom || !dom.entries.length) return;
    var next = dom.active + delta;
    if (next < 0) next = dom.entries.length - 1;
    if (next >= dom.entries.length) next = 0;
    setActiveResult(next);
  }

  function setActiveResult(index) {
    var dom = state.search;
    if (!dom) return;
    var items = collect(dom.results, '.de-search-item');
    for (var i = 0; i < items.length; i += 1) {
      var active = i === index;
      items[i].classList.toggle('de-search-item--active', active);
      items[i].setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) {
        var link = items[i].querySelector('a[href]');
        if (link) link.setAttribute('aria-current', 'true');
        if (items[i].scrollIntoView) items[i].scrollIntoView({ block: 'nearest' });
      } else {
        var other = items[i].querySelector('a[href]');
        if (other) other.removeAttribute('aria-current');
      }
    }
    dom.active = index;
    if (index > -1) dom.input.setAttribute('aria-activedescendant', items[index].id || '');
  }

  function onSearchHover(ev) {
    var item = closest(ev.target, '.de-search-item');
    if (!item || !state.search) return;
    var index = parseInt(item.getAttribute('data-de-index'), 10);
    if (!isNaN(index) && index !== state.search.active) setActiveResult(index);
  }

  function onSearchKey(ev) {
    var key = ev.key || '';
    if (key === 'ArrowDown') {
      ev.preventDefault();
      moveActive(1);
      return;
    }
    if (key === 'ArrowUp') {
      ev.preventDefault();
      moveActive(-1);
      return;
    }
    if (key === 'Enter') {
      var dom = state.search;
      if (!dom) return;
      var items = collect(dom.results, '.de-search-item');
      var target = items[dom.active > -1 ? dom.active : 0];
      if (!target) return;
      var link = target.querySelector('a[href]');
      if (!link) return;
      ev.preventDefault();
      window.location.href = link.href;
      return;
    }
    if (key === 'Escape') {
      ev.preventDefault();
      closeSearch();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Prev / next pager                                                    */
  /* ------------------------------------------------------------------ */

  function navLinks() {
    if (!state.nav) return [];
    var anchors = collect(state.nav, 'a[href]');
    var out = [];
    for (var i = 0; i < anchors.length; i += 1) {
      var href = anchors[i].getAttribute('href');
      if (!href || href.charAt(0) === '#') continue;
      out.push(anchors[i]);
    }
    return out;
  }

  function buildPager() {
    var main = state.main;
    if (!main || !state.nav || isPortal()) return;
    var links = navLinks();
    if (links.length < 2) return;
    var current = -1;
    for (var i = 0; i < links.length; i += 1) {
      if (isCurrentLink(links[i])) {
        current = i;
        break;
      }
    }
    if (current < 0) return;

    var prev = links[(current - 1 + links.length) % links.length];
    var next = links[(current + 1) % links.length];
    var pager = el('nav', 'de-pager');
    pager.appendChild(pagerLink(prev, 'prev'));
    pager.appendChild(pagerLink(next, 'next'));
    main.appendChild(pager);
  }

  function pagerLink(anchor, kind) {
    var link = el('a', 'de-pager-link de-pager-' + kind);
    link.href = anchor.getAttribute('href');
    link.appendChild(text('span', 'de-pager-label', kind === 'prev' ? labels.prev : labels.next));
    link.appendChild(text('span', 'de-pager-title', (anchor.textContent || '').replace(/\s+/g, ' ').trim()));
    return link;
  }

  /* ------------------------------------------------------------------ */
  /* Tables + code blocks                                                 */
  /* ------------------------------------------------------------------ */

  function wrapTables() {
    var main = state.main;
    if (!main) return;
    var tables = collect(main, 'table');
    for (var i = 0; i < tables.length; i += 1) {
      var table = tables[i];
      var parent = table.parentNode;
      if (!parent || closest(table, '.de-table-wrap')) continue;
      var wrap = el('div', 'de-table-wrap');
      parent.insertBefore(wrap, table);
      wrap.appendChild(table);
    }
  }

  function detectLanguage(pre) {
    var match = /(?:^|\s)language-([\w+#.-]+)/.exec(pre.className || '');
    return match ? match[1] : '';
  }

  function enhanceCodeBlocks() {
    var main = state.main;
    if (!main || !features.codeCopy) return;
    var pres = collect(main, 'pre');
    for (var i = 0; i < pres.length; i += 1) {
      var pre = pres[i];
      if (closest(pre, '.de-code')) continue;
      if (!(pre.textContent || '').trim()) continue;

      var wrap = el('div', 'de-code');
      var parent = pre.parentNode;
      parent.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var language = detectLanguage(pre);
      if (language) wrap.appendChild(text('span', 'de-code-lang', language));

      var copyBtn = button('de-copy', labels.copy);
      copyBtn.setAttribute('data-de-state', 'idle');
      copyBtn.appendChild(icon('copy', 'de-copy-icon'));
      copyBtn.appendChild(text('span', 'de-copy-label', labels.copy));
      copyBtn.addEventListener('click', makeCopyHandler(pre, copyBtn));
      wrap.appendChild(copyBtn);
    }
  }

  function makeCopyHandler(pre, copyBtn) {
    return function onCopy() {
      var value = pre.textContent || '';
      copyToClipboard(value, function afterCopy(ok) {
        if (!ok) return;
        copyBtn.setAttribute('data-de-state', 'copied');
        copyBtn.classList.add('is-copied');
        var label = copyBtn.querySelector('.de-copy-label');
        if (label) label.textContent = labels.copied;
        window.setTimeout(function resetCopy() {
          copyBtn.setAttribute('data-de-state', 'idle');
          copyBtn.classList.remove('is-copied');
          if (label) label.textContent = labels.copy;
        }, COPY_RESET_MS);
      });
    };
  }

  function copyToClipboard(value, done) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(value).then(
          function onSuccess() {
            done(true);
          },
          function onFailure() {
            done(fallbackCopy(value));
          }
        );
        return;
      }
    } catch (err) {
      /* fall through to execCommand */
    }
    done(fallbackCopy(value));
  }

  function fallbackCopy(value) {
    var area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.left = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    var ok = false;
    try {
      area.select();
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  /* ------------------------------------------------------------------ */
  /* Portal landing page                                                  */
  /* ------------------------------------------------------------------ */

  function isPortal() {
    return config.portal === true || document.body.classList.contains('de-portal');
  }

  function indexByHref() {
    var map = {};
    for (var i = 0; i < searchIndex.length; i += 1) {
      var entry = searchIndex[i];
      if (!entry || typeof entry !== 'object' || !entry.href) continue;
      map[normalizeHref(entry.href)] = entry;
    }
    return map;
  }

  function normalizeHref(href) {
    return String(href || '')
      .replace(/\\/g, '/')
      .replace(/^\.\//, '');
  }

  function buildPortal() {
    var main = state.main;
    var body = document.body;
    body.classList.add('de-portal');
    if (!main) return;

    var pageHeading = main.querySelector('h1.title, h1.topictitle1, h1');
    var heroTitle = siteTitle || (pageHeading && pageHeading.textContent.trim()) || document.title || '';
    var byHref = indexByHref();

    var container = el('div', 'de-portal');
    var hero = el('div', 'de-portal-hero');
    hero.appendChild(text('h1', 'de-portal-title', heroTitle));
    var subtitle = (document.title || '').trim();
    if (subtitle && subtitle !== heroTitle.trim()) hero.appendChild(text('p', 'de-portal-subtitle', subtitle));
    container.appendChild(hero);

    var nav = state.nav;
    if (nav) {
      var list = nav.querySelector('ul');
      var topItems = list ? directChildren(list, 'li') : [];
      if (!topItems.length && list) topItems = collect(list, 'li');
      var grid = el('div', 'de-portal-grid');
      for (var i = 0; i < topItems.length; i += 1) {
        var card = buildPortalCard(topItems[i], byHref);
        if (card) grid.appendChild(card);
      }
      if (grid.children.length) container.appendChild(grid);
      nav.hidden = true;
    }

    main.insertBefore(container, main.firstChild);
    if (pageHeading) pageHeading.hidden = true;
  }

  function buildPortalCard(item, byHref) {
    /* A `topichead` group owns no link; its nested topics must not become its own target. */
    var link = directChild(item, 'a[href]');
    var count = countTopics(item, byHref);

    if (!link) {
      /* topichead and other link-less grouping nodes still get a card. */
      var groupTitle = itemLabel(item);
      if (!groupTitle) return null;
      var group = el('div', 'de-portal-card de-portal-card--group');
      group.appendChild(text('span', 'de-portal-card-title', groupTitle));
      if (count > 0) group.appendChild(text('span', 'de-portal-card-meta', String(count)));
      return group;
    }

    var href = link.getAttribute('href');
    if (!href) return null;
    var title = (link.textContent || '').replace(/\s+/g, ' ').trim() || itemLabel(item);
    if (!title) return null;

    var card = el('a', 'de-portal-card');
    card.href = href;
    card.appendChild(text('span', 'de-portal-card-title', title));

    var entry = byHref[normalizeHref(href)];
    if (entry && entry.summary) card.appendChild(text('span', 'de-portal-card-summary', String(entry.summary)));

    if (count > 0) card.appendChild(text('span', 'de-portal-card-meta', String(count)));
    return card;
  }

  /** Own label of a nav item: its direct text, ignoring nested lists. */
  function itemLabel(item) {
    var parts = [];
    var children = item.childNodes;
    for (var i = 0; i < children.length; i += 1) {
      var node = children[i];
      if (node.nodeType === 1) {
        var tag = node.tagName.toLowerCase();
        if (tag === 'ul' || tag === 'li' || tag === 'button') continue;
      }
      var value = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (value) parts.push(value);
    }
    return parts.join(' ').trim();
  }

  /** Number of nested topics below a nav item; 0 for leaf topics. */
  function countTopics(item, byHref) {
    var list = directChild(item, 'ul');
    if (!list) return 0;
    var anchors = collect(list, 'a[href]');
    if (!anchors.length || !searchIndex.length) return 0;
    var seen = {};
    var total = 0;
    for (var i = 0; i < anchors.length; i += 1) {
      var key = normalizeHref(anchors[i].getAttribute('href'));
      if (!key || seen[key]) continue;
      seen[key] = true;
      if (byHref[key]) total += 1;
    }
    return total;
  }
})();
