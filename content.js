// content.js - Veeva Vault RIM Config Documenter In-Page Handler

(function () {
  if (window.__vvRimDocumenterLoaded) return;
  window.__vvRimDocumenterLoaded = true;

  let activeMode = null; // '0', '1', '2', '3', '4' or null
  let stickyMode = false;
  let lastActiveMode = null;
  let lastActiveModeTime = 0; // 750ms grace window if user releases key right before click
  let hoveredEl = null;
  let lastClickTime = 0;

  let settings = {
    isRecording: true,
    autoGoToPrefix: true,
    passClickThrough: true,
    highlightOnScreenshot: false,
    includeApiNames: true,
    mode1Style: 'blank_line',
    showFloatingHud: true
  };

  chrome.storage.local.get(['settings', 'remoteKeyState'], (res) => {
    if (res && res.settings) {
      settings = { ...settings, ...res.settings };
      updateHudVisibility();
    }
    if (res && res.remoteKeyState) {
      applyRemoteKeyState(res.remoteKeyState);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) {
      settings = { ...settings, ...(changes.settings.newValue || {}) };
      updateHudVisibility();
    }
    if (changes.remoteKeyState && changes.remoteKeyState.newValue) {
      applyRemoteKeyState(changes.remoteKeyState.newValue);
    }
  });

  function applyRemoteKeyState(state) {
    if (!state) return;
    // Ignore stale non-sticky states older than 4 seconds
    if (!state.sticky && state.mode && Date.now() - (state.timestamp || 0) > 4000) {
      return;
    }
    activeMode = state.mode || null;
    stickyMode = Boolean(state.sticky);
    if (activeMode) {
      lastActiveMode = activeMode;
      lastActiveModeTime = Date.now();
    }
    updateHudActiveBadge();
    if (!activeMode) {
      clearHighlight();
      tooltip.style.display = 'none';
    }
  }

  const tooltip = document.createElement('div');
  tooltip.id = 'vv-doc-cursor-tooltip';
  document.documentElement.appendChild(tooltip);

  let toast = null;
  let hud = null;
  let toastTimer = null;

  if (window === window.top) {
    toast = document.createElement('div');
    toast.id = 'vv-doc-toast';
    document.documentElement.appendChild(toast);

    hud = document.createElement('div');
    hud.id = 'vv-doc-floating-hud';
    hud.innerHTML = `
      <span class="vv-dot" title="Recording status"></span>
      <span style="font-weight:700;color:#f7941d;">Vault Doc</span>
      <span class="vv-hud-key" data-mode="0" title="0 + Left Click (or click here to lock): Append with ' > '">0: &gt; Chain</span>
      <span class="vv-hud-key" data-mode="1" title="1 + Left Click (or click here): New line">1: New Line</span>
      <span class="vv-hud-key" data-mode="3" title="3 + Left Click (or click here): Indented sub-item (   > )">3: Sub-item</span>
      <span class="vv-hud-key" data-mode="2" title="2 + Left Click (or click here): Insert screenshot">2: +Shot</span>
      <span class="vv-hud-key" data-mode="4" title="4 + Left Click (or click here): Record component">4: +Comp</span>
      <span class="vv-hud-undo" title="Undo last recorded item" style="padding:2px 6px;border-radius:2px;background:#4a5568;color:#fff;cursor:pointer;font-weight:600;">Undo</span>
    `;
    document.documentElement.appendChild(hud);

    hud.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const undoBtn = e.target.closest('.vv-hud-undo');
      if (undoBtn) {
        e.preventDefault();
        chrome.runtime.sendMessage({ type: 'UNDO_LAST_SEGMENT' }, (res) => {
          if (res && res.success) {
            showToast('Last item undone.');
          }
        });
        return;
      }
      const keyBtn = e.target.closest('.vv-hud-key');
      if (keyBtn) {
        e.preventDefault();
        const clickedMode = keyBtn.getAttribute('data-mode');
        if (activeMode === clickedMode && stickyMode) {
          setMode(null, false);
        } else {
          setMode(clickedMode, true);
        }
      }
    });
  }

  function updateHudVisibility() {
    if (!hud) return;
    hud.style.display = settings.showFloatingHud ? 'flex' : 'none';
    if (settings.isRecording) {
      hud.classList.remove('vv-paused');
    } else {
      hud.classList.add('vv-paused');
    }
  }

  function updateHudActiveBadge() {
    if (!hud) return;
    hud.querySelectorAll('.vv-hud-key').forEach((el) => {
      if (el.getAttribute('data-mode') === activeMode) {
        el.classList.add('vv-active-key');
      } else {
        el.classList.remove('vv-active-key');
      }
    });
  }

  function showToast(msg) {
    if (window !== window.top) {
      window.top.postMessage({ type: 'VV_DOC_SHOW_TOAST', msg }, '*');
      return;
    }
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('vv-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('vv-show');
    }, 2600);
  }

  function setMode(mode, isSticky = false, broadcast = true) {
    activeMode = mode;
    stickyMode = isSticky;
    if (mode) {
      lastActiveMode = mode;
      lastActiveModeTime = Date.now();
    }
    updateHudActiveBadge();
    if (!activeMode) {
      clearHighlight();
      tooltip.style.display = 'none';
    }
    if (broadcast) {
      try {
        window.top.postMessage({ type: 'VV_DOC_SYNC_MODE', mode: activeMode, sticky: stickyMode }, '*');
      } catch (e) {}
      try {
        chrome.runtime.sendMessage({
          type: 'SYNC_KEY_MODE',
          mode: activeMode,
          sticky: stickyMode
        });
      } catch (e) {}
    }
  }

  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'VV_DOC_SYNC_MODE') {
      activeMode = e.data.mode;
      stickyMode = e.data.sticky;
      if (activeMode) {
        lastActiveMode = activeMode;
        lastActiveModeTime = Date.now();
      }
      updateHudActiveBadge();
      if (!activeMode) {
        clearHighlight();
        tooltip.style.display = 'none';
      }
      if (window === window.top) {
        for (let i = 0; i < window.frames.length; i++) {
          try {
            window.frames[i].postMessage(e.data, '*');
          } catch (err) {}
        }
      }
    } else if (e.data.type === 'VV_DOC_SHOW_TOAST' && window === window.top) {
      showToast(e.data.msg);
    }
  });

  /**
   * Supports Hungarian QWERTZ ('0' on Backquote / IntlBackslash), US/UK top row digits,
   * and Numpad keys (both NumLock ON and NumLock OFF).
   */
  function getModeFromKeyEvent(e) {
    const key = e.key || '';
    const code = e.code || '';
    const kc = e.keyCode || e.which || 0;

    if (
      key === '0' ||
      key === '§' ||
      code === 'Digit0' ||
      code === 'Numpad0' ||
      code === 'Backquote' ||
      kc === 48 ||
      kc === 96 ||
      kc === 192
    ) {
      return '0';
    }
    if (key === '1' || code === 'Digit1' || code === 'Numpad1' || kc === 49 || kc === 97) {
      return '1';
    }
    if (key === '2' || code === 'Digit2' || code === 'Numpad2' || kc === 50 || kc === 98) {
      return '2';
    }
    if (key === '3' || code === 'Digit3' || code === 'Numpad3' || kc === 51 || kc === 99) {
      return '3';
    }
    if (key === '4' || code === 'Digit4' || code === 'Numpad4' || kc === 52 || kc === 100) {
      return '4';
    }
    return null;
  }

  function isEditableElement(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || el.isContentEditable) {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return !['button', 'submit', 'checkbox', 'radio', 'reset'].includes(type);
    }
    return false;
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!settings.isRecording) return;
      if (e.key === 'Escape' && activeMode) {
        setMode(null, false);
        return;
      }
      const mode = getModeFromKeyEvent(e);
      if (!mode) return;

      if (!isEditableElement(document.activeElement)) {
        e.preventDefault();
      }
      lastActiveMode = mode;
      lastActiveModeTime = Date.now();
      if (activeMode !== mode) {
        setMode(mode, false);
      }
    },
    true
  );

  window.addEventListener(
    'keyup',
    (e) => {
      const mode = getModeFromKeyEvent(e);
      if (mode) {
        lastActiveMode = mode;
        lastActiveModeTime = Date.now();
        if (activeMode === mode && !stickyMode) {
          setMode(null, false);
        }
      }
    },
    true
  );

  // Ensure page regains keyboard focus when user moves mouse from Side Panel onto the page
  window.addEventListener(
    'mouseenter',
    () => {
      if (!document.hasFocus() && !isEditableElement(document.activeElement)) {
        try {
          window.focus();
        } catch (e) {}
      }
    },
    true
  );

  window.addEventListener(
    'mousemove',
    (e) => {
      if (!document.hasFocus() && !isEditableElement(document.activeElement)) {
        try {
          window.focus();
        } catch (err) {}
      }

      if (!settings.isRecording || !activeMode) {
        if (hoveredEl) clearHighlight();
        tooltip.style.display = 'none';
        return;
      }

      const target = findMeaningfulElement(e.target);
      if (target !== hoveredEl) {
        clearHighlight();
        if (target && !target.closest('#vv-doc-floating-hud')) {
          hoveredEl = target;
          hoveredEl.classList.add('vv-doc-highlight-target');
        }
      }

      if (hoveredEl) {
        if (activeMode === '4') {
          const comp = extractComponentMetadataFromElement(hoveredEl, true);
          renderTooltip(
            e.clientX,
            e.clientY,
            activeMode,
            `${comp.name} [${comp.componentName} | ${comp.componentType}]`
          );
        } else {
          const extracted = extractVeevaLabel(hoveredEl);
          renderTooltip(e.clientX, e.clientY, activeMode, extracted);
        }
      } else {
        tooltip.style.display = 'none';
      }
    },
    true
  );

  function renderTooltip(x, y, mode, label) {
    const preview = label || '(Select element)';
    let badgeHtml = '';
    if (mode === '0') {
      badgeHtml = `<span class="vv-badge">0 + Click</span> &gt; ${escapeHtml(preview)}`;
    } else if (mode === '1') {
      badgeHtml = `<span class="vv-badge">1 + Click</span> New line: ${escapeHtml(preview)}`;
    } else if (mode === '2') {
      badgeHtml = `<span class="vv-badge">2 + Click</span> +Screenshot (${escapeHtml(preview)})`;
    } else if (mode === '3') {
      badgeHtml = `<span class="vv-badge">3 + Click</span> &nbsp;&nbsp;&gt; ${escapeHtml(preview)}`;
    } else if (mode === '4') {
      badgeHtml = `<span class="vv-badge">4 + Click</span> Component: ${escapeHtml(preview)}`;
    }
    tooltip.innerHTML = badgeHtml;
    tooltip.style.display = 'block';

    const maxX = window.innerWidth - 470;
    const maxY = window.innerHeight - 50;
    tooltip.style.left = Math.max(8, Math.min(x + 14, maxX)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(y + 16, maxY)) + 'px';
  }

  function clearHighlight() {
    if (hoveredEl) {
      hoveredEl.classList.remove('vv-doc-highlight-target');
      hoveredEl = null;
    }
  }

  function getEffectiveClickMode() {
    if (activeMode) return activeMode;
    // Allow 750ms grace window if user tapped 0/1/2/3/4 and released right as they clicked
    if (lastActiveMode && Date.now() - lastActiveModeTime < 750) {
      return lastActiveMode;
    }
    return null;
  }

  window.addEventListener(
    'mousedown',
    async (e) => {
      if (!settings.isRecording) return;
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('#vv-doc-floating-hud')) return;

      const currentMode = getEffectiveClickMode();
      if (!currentMode) return;

      const now = Date.now();
      if (now - lastClickTime < 150) return;
      lastClickTime = now;

      const targetEl = findMeaningfulElement(e.target) || e.target;
      const label = extractVeevaLabel(targetEl);
      const componentData = extractComponentMetadataFromElement(
        targetEl,
        currentMode === '4'
      );

      if (!settings.passClickThrough || currentMode === '4') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }

      if (currentMode === '2') {
        await handleScreenshotAction(targetEl, label, componentData);
      } else if (currentMode === '4') {
        sendActionWithFallback(
          {
            mode: '4',
            label,
            componentData,
            pageUrl: window.location.href
          },
          () => {
            showToast(
              `Component recorded: ${componentData.name} (${componentData.componentName})`
            );
          }
        );
      } else {
        if (!label) {
          showToast('No text label found on this element.');
          return;
        }
        sendActionWithFallback(
          {
            mode: currentMode,
            label,
            componentData,
            pageUrl: window.location.href
          },
          () => {
            const prefix =
              currentMode === '0' ? '> ' : currentMode === '1' ? 'New line: ' : '   > ';
            const compSuffix =
              componentData && componentData.componentName
                ? ` [+Component: ${componentData.componentName}]`
                : '';
            showToast(`Recorded: ${prefix}${label}${compSuffix}`);
          }
        );
      }
    },
    true
  );

  /**
   * Sends RECORD_ACTION to background.js, and if the service worker was asleep or unreachable,
   * writes directly to chrome.storage.local so no click is ever lost.
   */
  function sendActionWithFallback(payload, onSuccess) {
    try {
      chrome.runtime.sendMessage({ type: 'RECORD_ACTION', payload }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success) {
          directStorageFallbackWrite(payload).then(onSuccess);
        } else {
          onSuccess();
        }
      });
    } catch (err) {
      directStorageFallbackWrite(payload).then(onSuccess);
    }
  }

  async function directStorageFallbackWrite(payload) {
    const { mode, label, pageUrl, componentData } = payload;
    const store = await chrome.storage.local.get(['docSteps', 'settings', 'affectedComponents']);
    const docSteps = Array.isArray(store.docSteps) ? store.docSteps : [];
    const affectedComponents = Array.isArray(store.affectedComponents)
      ? store.affectedComponents
      : [];
    const s = { ...settings, ...(store.settings || {}) };

    if (componentData && componentData.componentName) {
      const exists = affectedComponents.some(
        (c) => c.componentName === componentData.componentName
      );
      if (!exists) {
        affectedComponents.push({
          id: 'comp_' + Date.now(),
          name: componentData.name || componentData.componentName,
          componentName: componentData.componentName,
          componentType: componentData.componentType || 'Component',
          modifiedDate: componentData.modifiedDate || new Date().toISOString().slice(0, 16)
        });
        await chrome.storage.local.set({ affectedComponents });
      }
    }

    if (mode === '4') return;

    const cleanLabel = (label || '').trim();
    if (!cleanLabel) return;

    const startsWithVerb = /^(go to|click|remove|add|select|on |set|change|delete|create|edit|open)\b/i.test(
      cleanLabel
    );
    const lineStart =
      s.autoGoToPrefix && !startsWithVerb ? 'Go to ' + cleanLabel : cleanLabel;

    const lastStep = docSteps.length > 0 ? docSteps[docSteps.length - 1] : null;

    if (mode === '0') {
      if (lastStep && lastStep.type === 'text') {
        if (!lastStep.text.trim()) {
          lastStep.text = lineStart;
        } else if (lastStep.text.endsWith('\n') || lastStep.text.endsWith('\n   > ')) {
          lastStep.text += cleanLabel;
        } else {
          lastStep.text += ' > ' + cleanLabel;
        }
      } else {
        docSteps.push({
          id: 'step_' + Date.now(),
          type: 'text',
          text: lineStart,
          timestamp: new Date().toISOString(),
          pageUrl
        });
      }
    } else if (mode === '1') {
      if (lastStep && lastStep.type === 'text' && s.mode1Style !== 'new_block') {
        lastStep.text += (s.mode1Style === 'sub_item' ? '\n   > ' : '\n\n') + lineStart;
      } else {
        docSteps.push({
          id: 'step_' + Date.now(),
          type: 'text',
          text: lineStart,
          timestamp: new Date().toISOString(),
          pageUrl
        });
      }
    } else if (mode === '3') {
      if (lastStep && lastStep.type === 'text') {
        lastStep.text += '\n   > ' + cleanLabel;
      } else {
        docSteps.push({
          id: 'step_' + Date.now(),
          type: 'text',
          text: '   > ' + cleanLabel,
          timestamp: new Date().toISOString(),
          pageUrl
        });
      }
    }

    await chrome.storage.local.set({ docSteps });
  }

  window.addEventListener(
    'click',
    (e) => {
      if (!settings.isRecording) return;
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('#vv-doc-floating-hud')) return;
      const currentMode = getEffectiveClickMode();
      if (!currentMode) return;
      if (!settings.passClickThrough || currentMode === '4') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  async function handleScreenshotAction(targetEl, label, componentData) {
    clearHighlight();
    tooltip.style.display = 'none';
    if (toast) toast.classList.remove('vv-show');
    if (hud) hud.style.visibility = 'hidden';

    if (settings.highlightOnScreenshot && targetEl) {
      targetEl.classList.add('vv-doc-screenshot-box');
    }

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    chrome.runtime.sendMessage(
      {
        type: 'RECORD_ACTION',
        payload: {
          mode: '2',
          label: label || '',
          componentData,
          pageUrl: window.location.href
        }
      },
      (res) => {
        if (targetEl) targetEl.classList.remove('vv-doc-screenshot-box');
        if (hud) hud.style.visibility = 'visible';
        if (res && res.success) {
          showToast('Screenshot appended to document.');
        } else {
          showToast('Error capturing screenshot.');
        }
      }
    );
  }

  function extractComponentMetadataFromElement(el, forceExtract = false) {
    if (!el) return null;
    const row = el.closest(
      '[data-component-name], [data-api-name], tr, [role="treeitem"], [role="row"], li, .vv-component-row'
    );
    const target = row || el;

    let compName =
      target.getAttribute('data-component-name') ||
      target.getAttribute('data-api-name') ||
      el.getAttribute('data-api-name') ||
      '';
    let compLabel = target.getAttribute('data-component-label') || '';
    let compType = target.getAttribute('data-component-type') || '';
    let modDate = target.getAttribute('data-modified-date') || '';

    if (row && row.tagName === 'TR') {
      const cells = Array.from(row.querySelectorAll('td')).map((c) => cleanText(c.textContent));
      if (cells.length >= 2) {
        const apiIdx = cells.findIndex((c) =>
          /^[a-z][a-z0-9_.]*__(?:c|v|sys|cda|rim)$/i.test(c)
        );
        if (apiIdx >= 0) {
          compName = compName || cells[apiIdx];
          compLabel = compLabel || (apiIdx > 0 ? cells[0] : cells[1]);
          compType = compType || cells[apiIdx + 1] || '';
          modDate = modDate || cells[apiIdx + 2] || '';
        }
      }
    }

    if (!compName) {
      compName = findAssociatedApiName(el);
    }

    if (!compName && !forceExtract) {
      return null;
    }

    if (!compLabel) {
      const rawLbl = extractVeevaLabel(el) || cleanText(el.textContent);
      compLabel = rawLbl
        .replace(/^Click the action menu next to\s+/i, '')
        .replace(/\s*\([a-z0-9_.]+__(?:c|v|sys|cda|rim)\)\s*$/i, '')
        .trim();
    }

    if (!compName && forceExtract) {
      compName =
        compLabel
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 42) + '__c';
    }

    if (!compType) {
      compType = inferVeevaComponentType(el);
    }

    return {
      name: compLabel || compName,
      componentName: compName,
      componentType: compType,
      modifiedDate: modDate || ''
    };
  }

  function inferVeevaComponentType(el) {
    const pageContext = (
      document.title +
      ' ' +
      window.location.href +
      ' ' +
      document.body.innerText.slice(0, 600)
    ).toLowerCase();
    const sectionCard = el.closest('.card, section, [data-component-type]');
    if (sectionCard) {
      const heading = sectionCard.querySelector('h2, h3, h4');
      const hTxt = heading ? heading.textContent.toLowerCase() : '';
      if (hTxt.includes('report')) return 'Report';
      if (hTxt.includes('document type')) return 'Doctype';
      if (hTxt.includes('document field') || hTxt.includes('shared field')) return 'Docfield';
      if (hTxt.includes('layout')) return 'Objectlayout';
      if (hTxt.includes('object')) return 'Object';
      if (hTxt.includes('lifecycle')) return 'Objectlifecycle';
      if (hTxt.includes('workflow')) return 'Workflow';
      if (hTxt.includes('picklist')) return 'Picklist';
    }
    if (pageContext.includes('report')) return 'Report';
    if (pageContext.includes('doctype') || pageContext.includes('document type')) return 'Doctype';
    if (pageContext.includes('docfield') || pageContext.includes('document field')) return 'Docfield';
    if (pageContext.includes('layout')) return 'Objectlayout';
    if (pageContext.includes('object')) return 'Object';
    return 'Component';
  }

  function findMeaningfulElement(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    const interactiveSelector = [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      'label',
      'th',
      'summary',
      '[role="button"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[role="treeitem"]',
      '[role="option"]',
      '[role="link"]',
      '.vv-button',
      '.vv-menu-item',
      '.vv-tab',
      '.vv-tree-node',
      '.vv-action-menu',
      '[data-component-name]',
      'li',
      'td',
      'span',
      'div'
    ].join(',');

    const directInteractive = el.closest(
      'a, button, input, select, textarea, label, [role="button"], [role="menuitem"], [role="tab"], [role="treeitem"], [role="option"], [data-component-name]'
    );
    if (directInteractive) return directInteractive;

    return el.closest(interactiveSelector) || el;
  }

  function extractVeevaLabel(el) {
    if (!el) return '';

    if (el.getAttribute('data-vv-doc-label')) {
      return el.getAttribute('data-vv-doc-label').trim();
    }

    const tag = (el.tagName || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    const titleAttr = (el.getAttribute('title') || '').trim();
    const classNames = (typeof el.className === 'string' ? el.className : '').toLowerCase();

    const rawOwnText = getVisibleText(el);
    const isActionMenuTrigger =
      /^(actions?|action menu|\.\.\.|⋯|⋮|▾|▼)$/i.test(rawOwnText) ||
      /action[-_]?menu|vv[-_]?action|more[-_]?actions|row[-_]?action/i.test(
        `${classNames} ${ariaLabel} ${titleAttr}`
      );

    if (isActionMenuTrigger) {
      const rowContext = findRowOrTreeItemContext(el);
      if (rowContext) {
        return `Click the action menu next to ${rowContext}`;
      }
      return 'Click the action menu';
    }

    const isRemoveTrigger =
      /^(remove|delete|✕|×|x)$/i.test(rawOwnText) ||
      /\b(remove|delete)\b/i.test(`${ariaLabel} ${titleAttr} ${classNames}`);

    if (isRemoveTrigger && rawOwnText.length <= 8) {
      const fieldContext = findFieldOrRowLabelWithoutApi(el);
      if (fieldContext) {
        return `Remove “${fieldContext}”`;
      }
    }

    if (tag === 'input' || tag === 'textarea') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (['button', 'submit', 'reset'].includes(type)) {
        return el.value || titleAttr || ariaLabel || 'Button';
      }
      if (el.value && el.value.trim()) {
        return el.value.trim();
      }
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) return cleanText(lbl.textContent);
      }
      return el.getAttribute('placeholder') || ariaLabel || titleAttr || '';
    }

    if (tag === 'select') {
      const selectedOpt = el.options && el.options[el.selectedIndex];
      if (selectedOpt && selectedOpt.text) {
        return cleanText(selectedOpt.text);
      }
    }

    let text = rawOwnText || ariaLabel || titleAttr || el.getAttribute('alt') || '';
    text = cleanText(text);

    if (text.length > 120) {
      const directText = getDirectTextNodes(el);
      if (directText) {
        text = directText;
      } else {
        text = text.slice(0, 100) + '...';
      }
    }

    if (settings.includeApiNames && text && !/\([a-z0-9_]+__[cv]\b/i.test(text)) {
      const apiName = findAssociatedApiName(el);
      if (apiName && !text.toLowerCase().includes(apiName.toLowerCase())) {
        text = `${text} (${apiName})`;
      }
    }

    return text;
  }

  function findRowOrTreeItemContext(actionEl) {
    const container = actionEl.closest(
      'tr, [role="treeitem"], [role="row"], .vv-tree-row, .vv-row, li'
    );
    if (!container) return '';

    const clone = container.cloneNode(true);
    clone
      .querySelectorAll(
        'button, [role="button"], .vv-action-menu, ul, ol, [role="group"], .action-popup'
      )
      .forEach((n) => n.remove());

    const primaryCell = clone.querySelector('td:first-child, .vv-label, a, span');
    let labelText = cleanText(primaryCell ? primaryCell.textContent : clone.textContent);
    if (!labelText) {
      labelText = cleanText(container.textContent.replace(/\.\.\.|⋯|⋮/g, ''));
    }

    if (settings.includeApiNames && labelText && !/\([a-z0-9_]+__[cv]\b/i.test(labelText)) {
      const apiName = findAssociatedApiName(container);
      if (apiName && !labelText.toLowerCase().includes(apiName.toLowerCase())) {
        labelText = `${labelText} (${apiName})`;
      }
    }
    return labelText;
  }

  function findFieldOrRowLabelWithoutApi(removeEl) {
    const container = removeEl.closest(
      '[data-field], [data-field-label], .vv-layout-field, .field-pill, .field-item, tr, [role="row"], li, div'
    );
    if (!container) return '';
    if (container.getAttribute('data-field-label')) {
      return container.getAttribute('data-field-label').trim();
    }
    const clone = container.cloneNode(true);
    clone.querySelectorAll('button, [role="button"], .remove, .delete').forEach((n) => n.remove());
    const txt = cleanText(clone.textContent);
    return txt.length <= 80 ? txt : '';
  }

  function findAssociatedApiName(el) {
    const row = el.closest(
      'tr, [role="treeitem"], [role="row"], li, [data-api-name], [data-component-name]'
    );
    const attrApi =
      el.getAttribute('data-component-name') ||
      el.getAttribute('data-api-name') ||
      el.getAttribute('data-name') ||
      (row &&
        (row.getAttribute('data-component-name') ||
          row.getAttribute('data-api-name') ||
          row.getAttribute('data-name')));
    if (attrApi && /^[a-z0-9_.]+__(?:c|v|sys|cda|rim)$/i.test(attrApi.trim())) {
      return attrApi.trim();
    }

    if (row) {
      const textContent = row.textContent || '';
      const match = textContent.match(/\b([a-z][a-z0-9_]*__(?:c|v|sys|cda|rim))\b/i);
      if (match) {
        return match[1];
      }
    }
    return '';
  }

  function getVisibleText(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone
      .querySelectorAll('script, style, ul, ol, [role="menu"], [role="group"], .sr-only')
      .forEach((n) => n.remove());
    return cleanText(clone.textContent || '');
  }

  function getDirectTextNodes(el) {
    let str = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        str += ' ' + node.nodeValue;
      }
    }
    return cleanText(str);
  }

  function cleanText(str) {
    return (str || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[▸▾▶▼•·\s]+/, '')
      .trim();
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
