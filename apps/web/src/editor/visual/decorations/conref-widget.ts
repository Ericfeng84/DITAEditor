/* Read-only conref / conkeyref preview widget DOM builder. */

import { type ResolvedConrefResult, type UiLocale } from '@dita/core';
import { renderConrefPreviewDom } from '../conref-renderer';
import { translate } from '../../../i18n/index.js';
export function createConrefWidgetDom(
  resolved: ResolvedConrefResult,
  isInline: boolean,
  locale: UiLocale,
  onJumpToSource?: (filePath: string, line?: number, elementId?: string) => void,
): HTMLElement {
  if (resolved.status !== 'resolved') {
    const alert = document.createElement(isInline ? 'span' : 'div');
    alert.contentEditable = 'false';
    alert.className =
      resolved.status === 'cycle'
        ? isInline
          ? 'dita-conref-inline-alert dita-conref-alert-cycle'
          : 'dita-conref-alert dita-conref-alert-cycle'
        : isInline
          ? 'dita-conref-inline-alert dita-conref-alert-error'
          : 'dita-conref-alert dita-conref-alert-error';

    const title = document.createElement('span');
    title.className = 'dita-conref-alert-title';
    title.textContent =
      resolved.status === 'cycle'
        ? translate(locale, 'decor.conrefCycle', { attr: resolved.attrName, value: resolved.rawValue })
        : translate(locale, 'decor.conrefError', { attr: resolved.attrName, value: resolved.rawValue });
    alert.appendChild(title);

    const msg = document.createElement('span');
    msg.className = 'dita-conref-alert-msg';
    msg.textContent = resolved.errorMessage ?? translate(locale, 'decor.conrefUnresolved');
    alert.appendChild(msg);

    if (resolved.targetFilePath && onJumpToSource) {
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'dita-conref-jump-btn';
      jumpBtn.textContent = translate(locale, 'decor.conrefViewTarget');
      jumpBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      jumpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onJumpToSource(resolved.targetFilePath!, resolved.targetLine, resolved.targetElementId);
      });
      alert.appendChild(jumpBtn);
    }
    return alert;
  }

  if (isInline) {
    const pill = document.createElement('span');
    pill.contentEditable = 'false';
    pill.className = 'dita-conref-preview-inline';
    pill.title = `${resolved.attrName}="${resolved.rawValue}"\n${translate(locale, 'decor.conrefSource')}: ${resolved.targetFilePath}:${resolved.targetLine}`;

    const badge = document.createElement('span');
    badge.className = 'dita-conref-inline-badge';
    badge.textContent = translate(locale, 'decor.conrefBadge');
    pill.appendChild(badge);

    pill.appendChild(renderConrefPreviewDom(resolved.resolvedXml ?? '', true));

    if (resolved.targetFilePath && onJumpToSource) {
      const jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'dita-conref-inline-jump';
      jump.textContent = '↗';
      jump.title = translate(locale, 'decor.conrefJumpTitle', { path: resolved.targetFilePath, line: String(resolved.targetLine ?? 1) });
      jump.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      jump.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onJumpToSource(resolved.targetFilePath!, resolved.targetLine, resolved.targetElementId);
      });
      pill.appendChild(jump);
    }
    return pill;
  }

  const card = document.createElement('div');
  card.contentEditable = 'false';
  card.className = 'dita-conref-preview-block';

  const header = document.createElement('div');
  header.className = 'dita-conref-preview-header';

  const pillTag = document.createElement('span');
  pillTag.className = 'dita-conref-tag';
  pillTag.textContent = `${resolved.attrName}="${resolved.rawValue}"`;
  header.appendChild(pillTag);

  const readonlyChip = document.createElement('span');
  readonlyChip.className = 'dita-conref-ro-chip';
  readonlyChip.textContent = translate(locale, 'decor.conrefReadonly');
  header.appendChild(readonlyChip);

  if (resolved.targetFilePath) {
    const srcLabel = document.createElement('span');
    srcLabel.className = 'dita-conref-source-path';
    srcLabel.textContent = `${resolved.targetFilePath}:${resolved.targetLine ?? 1}`;
    header.appendChild(srcLabel);

    if (onJumpToSource) {
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'dita-conref-jump-btn';
      jumpBtn.textContent = translate(locale, 'decor.conrefJump');
      jumpBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      jumpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onJumpToSource(resolved.targetFilePath!, resolved.targetLine, resolved.targetElementId);
      });
      header.appendChild(jumpBtn);
    }
  }

  card.appendChild(header);
  card.appendChild(renderConrefPreviewDom(resolved.resolvedXml ?? '', false));
  return card;
}

/**
 * Create a Jupyter Notebook-style between-block `+` inserter divider DOM node.
 * Fixed compact track height guarantees zero layout shift on hover/focus.
 */
