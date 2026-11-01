// content.js - Veeva Vault RIM Config Documenter In-Page Handler

(function () {
  const CURRENT_SCRIPT_VERSION = 5;
  if (window.__vvRimDocumenterVersion === CURRENT_SCRIPT_VERSION) {
    if (typeof window.__vvRimDocumenterResync === 'function') {
      try {
        window.__vvRimDocumenterResync();
      } catch (e) {}
    }
    return;
  }

  // Clean up any UI artifacts from an older version of content.js in the same tab
  document
    .querySelectorAll(
      '#vv-doc-floating-hud, #vv-doc-hover-tooltip, #vv-doc-toast, .vv-doc-schema-search-bar, #vv-doc-object-fields-popup'
    )
    .forEach((el) => el.remove());

  window.__vvRimDocumenterVersion = CURRENT_SCRIPT_VERSION;
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
    showFloatingHud: true,
    enableObjectSchemaTools: false
  };

  function loadSettingsFromStorage() {
    chrome.storage.local.get(['settings', 'remoteKeyState'], (res) => {
      if (res && res.settings) {
        settings = { ...settings, ...res.settings };
        updateHudVisibility();
        syncObjectSchemaToolsState();
      }
      if (res && res.remoteKeyState) {
        applyRemoteKeyState(res.remoteKeyState);
      }
    });
  }

  window.__vvRimDocumenterResync = loadSettingsFromStorage;
  loadSettingsFromStorage();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) {
      settings = { ...settings, ...(changes.settings.newValue || {}) };
      updateHudVisibility();
      syncObjectSchemaToolsState();
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
        if (
          target &&
          !target.closest('#vv-doc-floating-hud') &&
          !target.closest('.vv-doc-schema-search-bar') &&
          !target.closest('#vv-doc-object-fields-popup')
        ) {
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
      if (
        e.target.closest &&
        (e.target.closest('#vv-doc-floating-hud') ||
          e.target.closest('.vv-doc-schema-search-bar') ||
          e.target.closest('#vv-doc-object-fields-popup'))
      ) {
        return;
      }

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
      if (
        e.target.closest &&
        (e.target.closest('#vv-doc-floating-hud') ||
          e.target.closest('.vv-doc-schema-search-bar') ||
          e.target.closest('#vv-doc-object-fields-popup'))
      ) {
        return;
      }
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

  // ============================================================================
  // Veeva Vault Object Schema & Object Fields Table Search, Dropdowns & Hover Popup
  // Disabled by default (settings.enableObjectSchemaTools === false)
  // ============================================================================
  let schemaSearchState = {
    query: '',
    column: 'all',
    source: 'all',
    objectFilter: 'all',
    parentFilter: 'all'
  };
  let fieldsTableSearchState = {
    objectContext: '',
    query: '',
    column: 'all',
    source: 'all',
    fieldFilter: 'all',
    dataTypeFilter: 'all'
  };
  let observedTbody = null;
  let tbodyObserver = null;
  let observedFieldsTbody = null;
  let fieldsTbodyObserver = null;

  // Hover popup state & local cache
  let fieldsPopupEl = null;
  let hoverShowTimer = null;
  let hoverHideTimer = null;
  let currentPopupKey = '';
  let currentPopupObjectName = '';
  let currentPopupObjectLabel = '';
  let currentPopupFields = [];
  let currentPopupFieldSearch = '';
  let currentPopupDirectFieldAction = null;
  let currentPopupTargetObjectName = '';
  const localObjectFieldsCache = new Map();
  let pendingFieldNavigation = null;

  function syncObjectSchemaToolsState() {
    if (document.body) {
      document.body.classList.toggle(
        'vv-doc-schema-tools-enabled',
        Boolean(settings.enableObjectSchemaTools)
      );
    }
    if (!settings.enableObjectSchemaTools) {
      removeObjectSchemaEnhancements();
    } else {
      scheduleObjectSchemaCheck();
    }
  }

  function removeObjectSchemaEnhancements() {
    if (tbodyObserver) {
      tbodyObserver.disconnect();
      tbodyObserver = null;
    }
    observedTbody = null;

    if (fieldsTbodyObserver) {
      fieldsTbodyObserver.disconnect();
      fieldsTbodyObserver = null;
    }
    observedFieldsTbody = null;

    document.querySelectorAll('.vv-doc-schema-search-bar').forEach((el) => el.remove());
    document
      .querySelectorAll('tr.vv-doc-schema-row-hidden')
      .forEach((tr) => tr.classList.remove('vv-doc-schema-row-hidden'));

    hideObjectFieldsPopupImmediate();
  }

  function isOnObjectSchemaListPage() {
    const schemaContainer = document.querySelector(
      '.vault_admin_vof_object_schema, .vv_gridview.vv_vobject_list'
    );
    if (schemaContainer) {
      const table = schemaContainer.querySelector('table.vv_gridview_table');
      if (table) return true;
    }
    const href = (window.location.href || '').toLowerCase();
    if (
      href.includes('admin/content_setup/object_schema') &&
      !href.includes('object_schema=&d=') &&
      !href.includes('object_schema/fields')
    ) {
      return Boolean(document.querySelector('table.vv_gridview_table'));
    }
    return false;
  }

  function findObjectSchemaTableContext() {
    const schemaRoot =
      document.querySelector('.vault_admin_vof_object_schema') ||
      document.querySelector('.vv_gridview.vv_vobject_list')?.closest('.vv_page_content') ||
      document;

    const gridView =
      schemaRoot.querySelector('.vv_gridview.vv_vobject_list') ||
      schemaRoot.querySelector('.vv_gridview');
    const table =
      (gridView && gridView.querySelector('table.vv_gridview_table')) ||
      schemaRoot.querySelector('table.vv_gridview_table');

    if (!table) return null;
    const tbody = table.querySelector('tbody');
    if (!tbody) return null;

    const hasObjectColumns = Boolean(
      table.querySelector('th[data-column-id="name"], td[data-column-name="name"]')
    );
    if (!hasObjectColumns) return null;

    return { schemaRoot, gridView: gridView || table.parentElement, table, tbody };
  }

  // ============================================================================
  // Object Fields Table Detection (#admin/content_setup/object_schema/fields?t=...)
  // ============================================================================
  function getObjectFromUrlOrLinks(table) {
    const href = window.location.href || '';
    const matchT = href.match(/[?&]t=([a-z0-9_]+__(?:v|c|sys|rim|cda)|[a-z0-9_]+)/i);
    if (matchT && matchT[1]) {
      return matchT[1];
    }
    const matchD = href.match(/object_schema=&d=([a-z0-9_]+__(?:v|c|sys|rim|cda)|[a-z0-9_]+)/i);
    if (matchD && matchD[1]) {
      return matchD[1];
    }
    if (table) {
      const link = table.querySelector('a.objSchemaLink[href*="t="]');
      if (link) {
        const lHref = link.getAttribute('href') || '';
        const m = lHref.match(/[?&]t=([a-z0-9_]+__(?:v|c|sys|rim|cda)|[a-z0-9_]+)/i);
        if (m && m[1]) return m[1];
      }
    }
    return '';
  }

  function findObjectFieldsTableContext() {
    const candidateTables = Array.from(
      document.querySelectorAll(
        'table.tableBody.vv_lists_table, .vv_section_group.vv_generic_table table.vv_lists_table, table.vv_lists_table'
      )
    );

    const matchingContexts = [];

    for (const table of candidateTables) {
      const ths = Array.from(table.querySelectorAll('th'));
      const headerTexts = ths.map((th) => cleanText(th.textContent || '').toLowerCase());
      const hasFieldHeaders =
        (Boolean(table.querySelector('th[key="label"]')) &&
          Boolean(table.querySelector('th[key="name"]')) &&
          Boolean(table.querySelector('th[key="data_type"], th[key="source"]'))) ||
        (headerTexts.some((t) => t.includes('field label')) &&
          headerTexts.some((t) => t.includes('field name')));

      if (!hasFieldHeaders) continue;
      const tbody = table.querySelector('tbody');
      if (!tbody) continue;

      const sectionSubgroup =
        table.closest('.vv_section_subgroup') ||
        table.closest('.vv_section_group') ||
        table.parentElement;
      const dataTablesWrapper = table.closest('.dataTables_wrapper') || table;
      const objectName = getObjectFromUrlOrLinks(table);
      const isVisible = table.offsetParent !== null;

      matchingContexts.push({
        sectionSubgroup,
        dataTablesWrapper,
        table,
        tbody,
        objectName,
        isVisible
      });
    }

    if (matchingContexts.length === 0) return null;
    return matchingContexts.find((c) => c.isVisible) || matchingContexts[0];
  }

  function getFieldRowColumnTexts(tr) {
    const cells = tr.querySelectorAll('td');
    const labelCell = cells[0] || null;
    const nameCell = cells[1] || null;
    const sourceCell = cells[2] || null;
    const dataTypeCell = cells[3] || null;

    const labelLink = labelCell ? labelCell.querySelector('a.objSchemaLink, a') : null;
    const label = cleanText(
      (labelLink && (labelLink.getAttribute('title') || labelLink.textContent)) ||
        (labelCell && labelCell.textContent) ||
        ''
    );
    const name = cleanText(
      tr.getAttribute('key') || (nameCell && nameCell.textContent) || ''
    );
    const source = cleanText((sourceCell && sourceCell.textContent) || '');
    const dataType = cleanText((dataTypeCell && dataTypeCell.textContent) || '');
    const href = (labelLink && labelLink.getAttribute('href')) || '';

    const baseTypeMatch = dataType.match(/^([A-Za-z/ ]+?)(?:\s*\((.+)\))?$/);
    const baseType = baseTypeMatch ? cleanText(baseTypeMatch[1]) : dataType;
    const typeDetail = baseTypeMatch && baseTypeMatch[2] ? cleanText(baseTypeMatch[2]) : '';

    return {
      label,
      name,
      source,
      dataType,
      baseType,
      typeDetail,
      href,
      combined: `${label} ${name} ${source} ${dataType}`.toLowerCase()
    };
  }

  function populateDynamicFieldsTableDropdowns(tbody, searchBar) {
    if (!tbody || !searchBar) return;
    const fieldSelect = searchBar.querySelector('.vv-fields-name-select');
    const dtSelect = searchBar.querySelector('.vv-fields-datatype-select');
    const srcSelect = searchBar.querySelector('.vv-fields-source-select');

    const rows = Array.from(tbody.querySelectorAll('tr.tableRow, tr')).filter((r) =>
      r.querySelector('td')
    );

    const fieldsList = [];
    const seenFieldNames = new Set();
    const exactDataTypes = new Set();
    const baseDataTypes = new Set();
    const sourcesSet = new Set();

    rows.forEach((tr) => {
      const d = getFieldRowColumnTexts(tr);
      if (d.name && !seenFieldNames.has(d.name)) {
        seenFieldNames.add(d.name);
        fieldsList.push({
          name: d.name,
          label: d.label || d.name
        });
      }
      if (d.dataType) {
        exactDataTypes.add(d.dataType);
      }
      if (d.baseType) {
        baseDataTypes.add(d.baseType);
      }
      if (d.source) {
        sourcesSet.add(d.source);
      }
    });

    fieldsList.sort((a, b) => a.label.localeCompare(b.label));
    const sortedBaseTypes = Array.from(baseDataTypes).sort((a, b) => a.localeCompare(b));
    const sortedExactTypes = Array.from(exactDataTypes).sort((a, b) => a.localeCompare(b));

    if (fieldSelect) {
      const currentVal = fieldsTableSearchState.fieldFilter || 'all';
      let html = `<option value="all">All Fields in Table (${fieldsList.length})</option>`;
      fieldsList.forEach((f) => {
        const display = f.label && f.label !== f.name ? `${f.label} (${f.name})` : f.name;
        html += `<option value="${escapeHtml(f.name)}">${escapeHtml(display)}</option>`;
      });
      const sig = `${fieldsList.length}_${fieldsList[0]?.name || ''}`;
      if (fieldSelect.getAttribute('data-sig') !== sig) {
        fieldSelect.innerHTML = html;
        fieldSelect.setAttribute('data-sig', sig);
      }
      fieldSelect.value = seenFieldNames.has(currentVal) ? currentVal : 'all';
      fieldsTableSearchState.fieldFilter = fieldSelect.value;
    }

    if (dtSelect) {
      const currentDt = fieldsTableSearchState.dataTypeFilter || 'all';
      let dtHtml = `<option value="all">All Data Types (${sortedExactTypes.length})</option>`;
      if (sortedBaseTypes.length > 0) {
        dtHtml += `<optgroup label="By Type Category">`;
        sortedBaseTypes.forEach((bt) => {
          dtHtml += `<option value="base:${escapeHtml(bt)}">All ${escapeHtml(bt)} fields</option>`;
        });
        dtHtml += `</optgroup>`;
      }
      if (sortedExactTypes.length > 0) {
        dtHtml += `<optgroup label="Exact Data Type in Table">`;
        sortedExactTypes.forEach((et) => {
          dtHtml += `<option value="exact:${escapeHtml(et)}">${escapeHtml(et)}</option>`;
        });
        dtHtml += `</optgroup>`;
      }
      const dtSig = `${sortedExactTypes.length}_${sortedBaseTypes.length}`;
      if (dtSelect.getAttribute('data-sig') !== dtSig) {
        dtSelect.innerHTML = dtHtml;
        dtSelect.setAttribute('data-sig', dtSig);
      }
      const validOption = Array.from(dtSelect.options).some((o) => o.value === currentDt);
      dtSelect.value = validOption ? currentDt : 'all';
      fieldsTableSearchState.dataTypeFilter = dtSelect.value;
    }

    if (srcSelect && sourcesSet.size > 0) {
      const currentSrc = fieldsTableSearchState.source || 'all';
      const sortedSources = Array.from(sourcesSet).sort((a, b) => a.localeCompare(b));
      const srcSig = sortedSources.join('|');
      if (srcSelect.getAttribute('data-sig') !== srcSig) {
        let sHtml = `<option value="all">All Sources (${sortedSources.length})</option>`;
        sortedSources.forEach((s) => {
          sHtml += `<option value="${escapeHtml(s.toLowerCase())}">${escapeHtml(s)}</option>`;
        });
        srcSelect.innerHTML = sHtml;
        srcSelect.setAttribute('data-sig', srcSig);
      }
      const validSrc = Array.from(srcSelect.options).some((o) => o.value === currentSrc);
      srcSelect.value = validSrc ? currentSrc : 'all';
      fieldsTableSearchState.source = srcSelect.value;
    }
  }

  function applyObjectFieldsTableFilter(tbody, searchBar) {
    if (!tbody || !searchBar) return;
    const countBadge = searchBar.querySelector('.vv-schema-count-badge');
    const clearBtn = searchBar.querySelector('.vv-schema-clear-btn');
    const resetBtn = searchBar.querySelector('.vv-schema-reset-btn');

    const rows = Array.from(tbody.querySelectorAll('tr.tableRow, tr')).filter((r) =>
      r.querySelector('td')
    );

    const rawQuery = (fieldsTableSearchState.query || '').trim().toLowerCase();
    const terms = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];
    const colMode = fieldsTableSearchState.column || 'all';
    const srcMode = (fieldsTableSearchState.source || 'all').toLowerCase();
    const fieldFilter = fieldsTableSearchState.fieldFilter || 'all';
    const dtFilter = fieldsTableSearchState.dataTypeFilter || 'all';

    if (clearBtn) {
      clearBtn.style.display = rawQuery ? 'block' : 'none';
    }

    const anyFilterActive =
      Boolean(rawQuery) ||
      srcMode !== 'all' ||
      fieldFilter !== 'all' ||
      dtFilter !== 'all';

    if (resetBtn) {
      resetBtn.style.display = anyFilterActive ? 'inline-flex' : 'none';
    }

    let visibleCount = 0;
    const totalCount = rows.length;

    rows.forEach((tr) => {
      const d = getFieldRowColumnTexts(tr);

      let matchesSource = true;
      if (srcMode !== 'all') {
        matchesSource = d.source.toLowerCase() === srcMode;
      }

      let matchesField = true;
      if (fieldFilter !== 'all') {
        matchesField = d.name === fieldFilter;
      }

      let matchesDataType = true;
      if (dtFilter !== 'all') {
        if (dtFilter.startsWith('base:')) {
          const wantedBase = dtFilter.slice(5).toLowerCase();
          matchesDataType = d.baseType.toLowerCase() === wantedBase;
        } else if (dtFilter.startsWith('exact:')) {
          const wantedExact = dtFilter.slice(6).toLowerCase();
          matchesDataType = d.dataType.toLowerCase() === wantedExact;
        }
      }

      let matchesQuery = true;
      if (terms.length > 0) {
        let targetHaystack = d.combined;
        if (colMode === 'label') targetHaystack = d.label.toLowerCase();
        else if (colMode === 'name') targetHaystack = d.name.toLowerCase();
        else if (colMode === 'data_type') targetHaystack = d.dataType.toLowerCase();

        matchesQuery = terms.every((t) => targetHaystack.includes(t));
      }

      if (matchesSource && matchesField && matchesDataType && matchesQuery) {
        tr.classList.remove('vv-doc-schema-row-hidden');
        visibleCount++;
      } else {
        tr.classList.add('vv-doc-schema-row-hidden');
      }
    });

    if (countBadge) {
      if (anyFilterActive) {
        countBadge.textContent = `${visibleCount} / ${totalCount} fields`;
      } else {
        countBadge.textContent = `${totalCount} fields`;
      }
    }
  }

  function ensureObjectFieldsTableSearchBar() {
    if (!settings.enableObjectSchemaTools) return;
    const ctx = findObjectFieldsTableContext();
    if (!ctx) return;

    const { sectionSubgroup, dataTablesWrapper, tbody, objectName } = ctx;

    // Reset filter state if user switched to a different Object's Fields page
    if (objectName && fieldsTableSearchState.objectContext !== objectName) {
      fieldsTableSearchState = {
        objectContext: objectName,
        query: '',
        column: 'all',
        source: 'all',
        fieldFilter: 'all',
        dataTypeFilter: 'all'
      };
    }

    let searchBar = sectionSubgroup.querySelector('.vv-doc-fields-search-bar');
    if (!searchBar) {
      searchBar = document.createElement('div');
      searchBar.className = 'vv-doc-schema-search-bar vv-doc-fields-search-bar';
      searchBar.innerHTML = `
        <span class="vv-schema-search-brand" title="Hover over any Field Name or Data Type cell to inspect field details & referenced object fields">
          <span class="vv-schema-search-brand-dot"></span>
          <span>Filter Fields:</span>
        </span>
        <div class="vv-schema-input-wrap">
          <input
            type="text"
            class="vv-schema-search-input"
            placeholder="Search by Field Label, Field Name (e.g. status__v), or Data Type..."
            autocomplete="off"
            spellcheck="false"
          />
          <button type="button" class="vv-schema-clear-btn" title="Clear search (Esc)">&times;</button>
        </div>
        <select class="vv-schema-select vv-fields-name-select" title="Filter by selecting a specific Field from the table">
          <option value="all">All Fields in Table</option>
        </select>
        <select class="vv-schema-select vv-fields-datatype-select" title="Filter by Data Type (Object, Picklist, Text, Yes/No, DateTime...)">
          <option value="all">All Data Types</option>
        </select>
        <select class="vv-schema-select vv-fields-source-select" title="Filter by Field Source">
          <option value="all">All Sources</option>
          <option value="standard">Standard</option>
          <option value="application">Application</option>
          <option value="custom">Custom</option>
          <option value="system">System</option>
        </select>
        <select class="vv-schema-select vv-fields-col-select" title="Choose which column the search box filters">
          <option value="all">All Columns</option>
          <option value="label">Field Label only</option>
          <option value="name">Field Name (API) only</option>
          <option value="data_type">Data Type only</option>
        </select>
        <button type="button" class="vv-schema-select vv-schema-reset-btn" style="display:none; cursor:pointer; font-weight:600; color:#c85a08;" title="Reset all field filters">Reset</button>
        <span class="vv-schema-count-badge">0 fields</span>
      `;

      if (dataTablesWrapper && dataTablesWrapper.parentNode === sectionSubgroup) {
        sectionSubgroup.insertBefore(searchBar, dataTablesWrapper);
      } else {
        sectionSubgroup.insertBefore(searchBar, sectionSubgroup.firstChild);
      }

      const inputEl = searchBar.querySelector('.vv-schema-search-input');
      const clearBtn = searchBar.querySelector('.vv-schema-clear-btn');
      const fieldSelect = searchBar.querySelector('.vv-fields-name-select');
      const dtSelect = searchBar.querySelector('.vv-fields-datatype-select');
      const srcSelect = searchBar.querySelector('.vv-fields-source-select');
      const colSelect = searchBar.querySelector('.vv-fields-col-select');
      const resetBtn = searchBar.querySelector('.vv-schema-reset-btn');

      inputEl.value = fieldsTableSearchState.query;
      colSelect.value = fieldsTableSearchState.column;

      inputEl.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          fieldsTableSearchState.query = '';
          inputEl.value = '';
          const latestCtx = findObjectFieldsTableContext();
          if (latestCtx) {
            applyObjectFieldsTableFilter(latestCtx.tbody, searchBar);
          }
        }
      });
      inputEl.addEventListener('keyup', (e) => e.stopPropagation());
      inputEl.addEventListener('keypress', (e) => e.stopPropagation());

      inputEl.addEventListener('input', () => {
        fieldsTableSearchState.query = inputEl.value;
        const latestCtx = findObjectFieldsTableContext();
        if (latestCtx) {
          applyObjectFieldsTableFilter(latestCtx.tbody, searchBar);
        }
      });

      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fieldsTableSearchState.query = '';
        inputEl.value = '';
        inputEl.focus();
        const latestCtx = findObjectFieldsTableContext();
        if (latestCtx) {
          applyObjectFieldsTableFilter(latestCtx.tbody, searchBar);
        }
      });

      fieldSelect.addEventListener('change', () => {
        fieldsTableSearchState.fieldFilter = fieldSelect.value;
        const latestCtx = findObjectFieldsTableContext();
        if (latestCtx) {
          applyObjectFieldsTableFilter(latestCtx.tbody, searchBar);
        }
      });

      dtSelect.addEventListener('change', () => {
        fieldsTableSearchState.dataTypeFilter = dtSelect.value;
        const latestCtx = findObjectFieldsTableContext();
        if (latestCtx) {
          applyObjectFieldsTableFilter(latestCtx.tbody, searchBar);
        }
      });

      srcSelect.addEventListener('change', () => {
        fieldsTableSearchState.source = srcSelect.value;
        const latestCtx = findObjectFieldsTableContext();
        if (latestCtx) {
          applyObjectFieldsTableFilter(latestCtx.tbody, searchBar);
        }
      });

      colSelect.addEventListener('change', () => {
        fieldsTableSearchState.column = colSelect.value;
        const latestCtx = findObjectFieldsTableContext();
        if (latestCtx) {
          applyObjectFieldsTableFilter(latestCtx.tbody, searchBar);
        }
      });

      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fieldsTableSearchState = {
          objectContext: objectName,
          query: '',
          column: 'all',
          source: 'all',
          fieldFilter: 'all',
          dataTypeFilter: 'all'
        };
        inputEl.value = '';
        colSelect.value = 'all';
        srcSelect.value = 'all';
        fieldSelect.value = 'all';
        dtSelect.value = 'all';
        const latestCtx = findObjectFieldsTableContext();
        if (latestCtx) {
          applyObjectFieldsTableFilter(latestCtx.tbody, searchBar);
        }
      });
    }

    populateDynamicFieldsTableDropdowns(tbody, searchBar);
    applyObjectFieldsTableFilter(tbody, searchBar);

    if (observedFieldsTbody !== tbody) {
      if (fieldsTbodyObserver) {
        fieldsTbodyObserver.disconnect();
      }
      observedFieldsTbody = tbody;
      fieldsTbodyObserver = new MutationObserver(() => {
        populateDynamicFieldsTableDropdowns(tbody, searchBar);
        applyObjectFieldsTableFilter(tbody, searchBar);
      });
      fieldsTbodyObserver.observe(tbody, { childList: true });
    }
  }

  function getRowColumnTexts(tr) {
    const labelCell = tr.querySelector('td[data-column-name="label"]');
    const nameCell = tr.querySelector('td[data-column-name="name"]');
    const sourceCell = tr.querySelector('td[data-column-name="source"]');
    const parentCell = tr.querySelector('td[data-column-name="parent"]');

    const extractCell = (cell, preferSelector) => {
      if (!cell) return '';
      if (preferSelector) {
        const sub = cell.querySelector(preferSelector);
        if (sub) {
          return cleanText(sub.getAttribute('title') || sub.textContent || '');
        }
      }
      return cleanText(cell.getAttribute('title') || cell.textContent || '');
    };

    const label = extractCell(labelCell, 'a.objSchemaLink, a');
    const name = extractCell(nameCell, '.vv-text-cell-for-wrap, .vv_text_cell');
    const source = extractCell(sourceCell, 'span');
    const parent = extractCell(parentCell, '.vv-text-cell-for-wrap, .vv_text_cell');

    if (!label && !name && !source && !parent) {
      const allText = cleanText(tr.textContent || '');
      return {
        label: allText,
        name: allText,
        source: '',
        parent: '',
        combined: allText.toLowerCase()
      };
    }

    return {
      label,
      name,
      source,
      parent,
      combined: `${label} ${name} ${source} ${parent}`.toLowerCase()
    };
  }

  function populateDynamicTableDropdowns(tbody, searchBar) {
    if (!tbody || !searchBar) return;
    const objSelect = searchBar.querySelector('.vv-schema-object-select');
    const parentSelect = searchBar.querySelector('.vv-schema-parent-select');
    if (!objSelect && !parentSelect) return;

    const rows = Array.from(
      tbody.querySelectorAll('tr.gridViewRow, tr.vv_gridview_row, tr')
    ).filter((r) => r.querySelector('td'));

    const objectsList = [];
    const seenObjNames = new Set();
    const parentSet = new Set();
    let hasEmptyParent = false;

    rows.forEach((tr) => {
      const data = getRowColumnTexts(tr);
      if (data.name && !seenObjNames.has(data.name)) {
        seenObjNames.add(data.name);
        objectsList.push({
          name: data.name,
          label: data.label || data.name
        });
      }
      if (data.parent) {
        parentSet.add(data.parent);
      } else {
        hasEmptyParent = true;
      }
    });

    objectsList.sort((a, b) => a.label.localeCompare(b.label));
    const sortedParents = Array.from(parentSet).sort((a, b) => a.localeCompare(b));

    if (objSelect) {
      const currentVal = schemaSearchState.objectFilter || 'all';
      let html = `<option value="all">All Objects in Table (${objectsList.length})</option>`;
      objectsList.forEach((o) => {
        const display =
          o.label && o.label !== o.name ? `${o.label} (${o.name})` : o.name;
        html += `<option value="${escapeHtml(o.name)}">${escapeHtml(display)}</option>`;
      });
      if (objSelect.getAttribute('data-count') !== String(objectsList.length)) {
        objSelect.innerHTML = html;
        objSelect.setAttribute('data-count', String(objectsList.length));
      }
      objSelect.value = seenObjNames.has(currentVal) ? currentVal : 'all';
      schemaSearchState.objectFilter = objSelect.value;
    }

    if (parentSelect) {
      const currentParent = schemaSearchState.parentFilter || 'all';
      let pHtml = `<option value="all">All Parent Objects (${sortedParents.length})</option>`;
      if (hasEmptyParent) {
        pHtml += `<option value="__none__">(No Parent Object)</option>`;
      }
      sortedParents.forEach((p) => {
        pHtml += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
      });
      const sig = `${sortedParents.length}_${hasEmptyParent ? 1 : 0}`;
      if (parentSelect.getAttribute('data-sig') !== sig) {
        parentSelect.innerHTML = pHtml;
        parentSelect.setAttribute('data-sig', sig);
      }
      if (
        currentParent === 'all' ||
        (currentParent === '__none__' && hasEmptyParent) ||
        parentSet.has(currentParent)
      ) {
        parentSelect.value = currentParent;
      } else {
        parentSelect.value = 'all';
      }
      schemaSearchState.parentFilter = parentSelect.value;
    }
  }

  function applyObjectSchemaFilter(tbody, searchBar) {
    if (!tbody || !searchBar) return;
    const countBadge = searchBar.querySelector('.vv-schema-count-badge');
    const clearBtn = searchBar.querySelector('.vv-schema-clear-btn');
    const resetAllBtn = searchBar.querySelector('.vv-schema-reset-btn');

    const rows = Array.from(
      tbody.querySelectorAll('tr.gridViewRow, tr.vv_gridview_row, tr')
    ).filter((r) => r.querySelector('td'));

    const rawQuery = (schemaSearchState.query || '').trim().toLowerCase();
    const terms = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];
    const colMode = schemaSearchState.column || 'all';
    const srcMode = (schemaSearchState.source || 'all').toLowerCase();
    const objFilter = schemaSearchState.objectFilter || 'all';
    const parentFilter = schemaSearchState.parentFilter || 'all';

    if (clearBtn) {
      clearBtn.style.display = rawQuery ? 'block' : 'none';
    }

    const anyFilterActive =
      Boolean(rawQuery) ||
      srcMode !== 'all' ||
      objFilter !== 'all' ||
      parentFilter !== 'all';

    if (resetAllBtn) {
      resetAllBtn.style.display = anyFilterActive ? 'inline-flex' : 'none';
    }

    let visibleCount = 0;
    const totalCount = rows.length;

    rows.forEach((tr) => {
      const data = getRowColumnTexts(tr);

      let matchesSource = true;
      if (srcMode !== 'all') {
        matchesSource = data.source.toLowerCase() === srcMode;
      }

      let matchesObjDropdown = true;
      if (objFilter !== 'all') {
        matchesObjDropdown = data.name === objFilter;
      }

      let matchesParentDropdown = true;
      if (parentFilter !== 'all') {
        if (parentFilter === '__none__') {
          matchesParentDropdown = !data.parent;
        } else {
          matchesParentDropdown = data.parent === parentFilter;
        }
      }

      let matchesQuery = true;
      if (terms.length > 0) {
        let targetHaystack = data.combined;
        if (colMode === 'label') targetHaystack = data.label.toLowerCase();
        else if (colMode === 'name') targetHaystack = data.name.toLowerCase();
        else if (colMode === 'parent') targetHaystack = data.parent.toLowerCase();

        matchesQuery = terms.every((t) => targetHaystack.includes(t));
      }

      if (matchesSource && matchesObjDropdown && matchesParentDropdown && matchesQuery) {
        tr.classList.remove('vv-doc-schema-row-hidden');
        visibleCount++;
      } else {
        tr.classList.add('vv-doc-schema-row-hidden');
      }
    });

    if (countBadge) {
      if (anyFilterActive) {
        countBadge.textContent = `${visibleCount} / ${totalCount} objects`;
      } else {
        countBadge.textContent = `${totalCount} objects`;
      }
    }
  }

  function ensureObjectSchemaSearchBar() {
    if (!settings.enableObjectSchemaTools) {
      removeObjectSchemaEnhancements();
      return;
    }

    if (document.body) {
      document.body.classList.add('vv-doc-schema-tools-enabled');
    }

    checkPendingFieldNavigation();
    ensureObjectFieldsTableSearchBar();

    if (!isOnObjectSchemaListPage()) return;
    const ctx = findObjectSchemaTableContext();
    if (!ctx) return;

    const { gridView, tbody } = ctx;
    let searchBar = gridView.querySelector('.vv-doc-schema-search-bar');

    if (!searchBar) {
      searchBar = document.createElement('div');
      searchBar.className = 'vv-doc-schema-search-bar';
      searchBar.innerHTML = `
        <span class="vv-schema-search-brand" title="Hover over any Object Name cell to inspect and jump to its fields">
          <span class="vv-schema-search-brand-dot"></span>
          <span>Filter Objects:</span>
        </span>
        <div class="vv-schema-input-wrap">
          <input
            type="text"
            class="vv-schema-search-input"
            placeholder="Search by Object Label, Object Name (e.g. commitment__rim), or Parent..."
            autocomplete="off"
            spellcheck="false"
          />
          <button type="button" class="vv-schema-clear-btn" title="Clear search (Esc)">&times;</button>
        </div>
        <select class="vv-schema-select vv-schema-object-select" title="Filter by selecting a specific Object from the table">
          <option value="all">All Objects in Table</option>
        </select>
        <select class="vv-schema-select vv-schema-parent-select" title="Filter by Parent Object from the table">
          <option value="all">All Parent Objects</option>
        </select>
        <select class="vv-schema-select vv-schema-source-select" title="Filter by Object Source">
          <option value="all">All Sources</option>
          <option value="standard">Standard</option>
          <option value="application">Application</option>
          <option value="custom">Custom</option>
          <option value="system">System</option>
        </select>
        <select class="vv-schema-select vv-schema-col-select" title="Choose which column the search box filters">
          <option value="all">All Columns</option>
          <option value="label">Object Label only</option>
          <option value="name">Object Name (API) only</option>
          <option value="parent">Parent Object only</option>
        </select>
        <button type="button" class="vv-schema-select vv-schema-reset-btn" style="display:none; cursor:pointer; font-weight:600; color:#c85a08;" title="Reset all filters">Reset</button>
        <span class="vv-schema-count-badge">0 objects</span>
      `;

      const gridComponent = gridView.querySelector('.gridComponent, .vv_grid_component');
      if (gridComponent && gridComponent.parentNode === gridView) {
        gridView.insertBefore(searchBar, gridComponent);
      } else {
        gridView.insertBefore(searchBar, gridView.firstChild);
      }

      const inputEl = searchBar.querySelector('.vv-schema-search-input');
      const clearBtn = searchBar.querySelector('.vv-schema-clear-btn');
      const objSelect = searchBar.querySelector('.vv-schema-object-select');
      const parentSelect = searchBar.querySelector('.vv-schema-parent-select');
      const colSelect = searchBar.querySelector('.vv-schema-col-select');
      const srcSelect = searchBar.querySelector('.vv-schema-source-select');
      const resetBtn = searchBar.querySelector('.vv-schema-reset-btn');

      inputEl.value = schemaSearchState.query;
      colSelect.value = schemaSearchState.column;
      srcSelect.value = schemaSearchState.source;

      inputEl.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          schemaSearchState.query = '';
          inputEl.value = '';
          const latestCtx = findObjectSchemaTableContext();
          if (latestCtx) {
            applyObjectSchemaFilter(latestCtx.tbody, searchBar);
          }
        }
      });

      inputEl.addEventListener('keyup', (e) => e.stopPropagation());
      inputEl.addEventListener('keypress', (e) => e.stopPropagation());

      inputEl.addEventListener('input', () => {
        schemaSearchState.query = inputEl.value;
        const latestCtx = findObjectSchemaTableContext();
        if (latestCtx) {
          applyObjectSchemaFilter(latestCtx.tbody, searchBar);
        }
      });

      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        schemaSearchState.query = '';
        inputEl.value = '';
        inputEl.focus();
        const latestCtx = findObjectSchemaTableContext();
        if (latestCtx) {
          applyObjectSchemaFilter(latestCtx.tbody, searchBar);
        }
      });

      objSelect.addEventListener('change', () => {
        schemaSearchState.objectFilter = objSelect.value;
        const latestCtx = findObjectSchemaTableContext();
        if (latestCtx) {
          applyObjectSchemaFilter(latestCtx.tbody, searchBar);
        }
      });

      parentSelect.addEventListener('change', () => {
        schemaSearchState.parentFilter = parentSelect.value;
        const latestCtx = findObjectSchemaTableContext();
        if (latestCtx) {
          applyObjectSchemaFilter(latestCtx.tbody, searchBar);
        }
      });

      colSelect.addEventListener('change', () => {
        schemaSearchState.column = colSelect.value;
        const latestCtx = findObjectSchemaTableContext();
        if (latestCtx) {
          applyObjectSchemaFilter(latestCtx.tbody, searchBar);
        }
      });

      srcSelect.addEventListener('change', () => {
        schemaSearchState.source = srcSelect.value;
        const latestCtx = findObjectSchemaTableContext();
        if (latestCtx) {
          applyObjectSchemaFilter(latestCtx.tbody, searchBar);
        }
      });

      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        schemaSearchState = {
          query: '',
          column: 'all',
          source: 'all',
          objectFilter: 'all',
          parentFilter: 'all'
        };
        inputEl.value = '';
        colSelect.value = 'all';
        srcSelect.value = 'all';
        objSelect.value = 'all';
        parentSelect.value = 'all';
        const latestCtx = findObjectSchemaTableContext();
        if (latestCtx) {
          applyObjectSchemaFilter(latestCtx.tbody, searchBar);
        }
      });
    }

    populateDynamicTableDropdowns(tbody, searchBar);
    applyObjectSchemaFilter(tbody, searchBar);

    if (observedTbody !== tbody) {
      if (tbodyObserver) {
        tbodyObserver.disconnect();
      }
      observedTbody = tbody;
      tbodyObserver = new MutationObserver(() => {
        populateDynamicTableDropdowns(tbody, searchBar);
        applyObjectSchemaFilter(tbody, searchBar);
      });
      tbodyObserver.observe(tbody, { childList: true });
    }
  }

  // ============================================================================
  // Hover Popup on Object Name Cell OR Field Name / Data Type Cell
  // ============================================================================
  function ensureFieldsPopupElement() {
    if (fieldsPopupEl && document.body.contains(fieldsPopupEl)) {
      return fieldsPopupEl;
    }
    fieldsPopupEl = document.createElement('div');
    fieldsPopupEl.id = 'vv-doc-object-fields-popup';
    fieldsPopupEl.innerHTML = `
      <div class="vv-fpop-header">
        <div class="vv-fpop-title-wrap">
          <div class="vv-fpop-label">Object</div>
          <div class="vv-fpop-apiname">object__v</div>
        </div>
        <div class="vv-fpop-actions">
          <button type="button" class="vv-fpop-target-btn" style="display:none;" title="Open Referenced Object's Fields">Target Fields &#8599;</button>
          <button type="button" class="vv-fpop-goto-btn" title="Open in Veeva Vault">Go to Fields &#8599;</button>
          <button type="button" class="vv-fpop-close-btn" title="Close">&times;</button>
        </div>
      </div>
      <div class="vv-fpop-meta-strip"></div>
      <div class="vv-fpop-section-banner"></div>
      <div class="vv-fpop-search-row">
        <input
          type="text"
          class="vv-fpop-search-input"
          placeholder="Filter fields by label, API name, or type..."
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <div class="vv-fpop-list"></div>
      <div class="vv-fpop-footer">
        <span class="vv-fpop-count">0 fields</span>
        <span class="vv-fpop-footer-hint">Click any field to open it</span>
      </div>
    `;
    document.body.appendChild(fieldsPopupEl);

    fieldsPopupEl.addEventListener('mouseenter', () => {
      if (hoverHideTimer) {
        clearTimeout(hoverHideTimer);
        hoverHideTimer = null;
      }
    });

    fieldsPopupEl.addEventListener('mouseleave', () => {
      scheduleHideFieldsPopup(260);
    });

    const closeBtn = fieldsPopupEl.querySelector('.vv-fpop-close-btn');
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideObjectFieldsPopupImmediate();
    });

    const gotoBtn = fieldsPopupEl.querySelector('.vv-fpop-goto-btn');
    gotoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof currentPopupDirectFieldAction === 'function') {
        currentPopupDirectFieldAction();
      } else if (currentPopupObjectName) {
        navigateToObjectFields(currentPopupObjectName, null);
      }
    });

    const targetBtn = fieldsPopupEl.querySelector('.vv-fpop-target-btn');
    targetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentPopupTargetObjectName) {
        navigateToObjectFields(currentPopupTargetObjectName, null);
      }
    });

    const searchInput = fieldsPopupEl.querySelector('.vv-fpop-search-input');
    searchInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        if (searchInput.value) {
          searchInput.value = '';
          currentPopupFieldSearch = '';
          renderPopupFieldList();
        } else {
          hideObjectFieldsPopupImmediate();
        }
      }
    });
    searchInput.addEventListener('keyup', (e) => e.stopPropagation());
    searchInput.addEventListener('keypress', (e) => e.stopPropagation());
    searchInput.addEventListener('input', () => {
      currentPopupFieldSearch = searchInput.value;
      renderPopupFieldList();
    });

    return fieldsPopupEl;
  }

  function scheduleHideFieldsPopup(delayMs = 260) {
    if (hoverShowTimer) {
      clearTimeout(hoverShowTimer);
      hoverShowTimer = null;
    }
    if (hoverHideTimer) {
      clearTimeout(hoverHideTimer);
    }
    hoverHideTimer = setTimeout(() => {
      hideObjectFieldsPopupImmediate();
    }, delayMs);
  }

  function hideObjectFieldsPopupImmediate() {
    if (hoverShowTimer) {
      clearTimeout(hoverShowTimer);
      hoverShowTimer = null;
    }
    if (hoverHideTimer) {
      clearTimeout(hoverHideTimer);
      hoverHideTimer = null;
    }
    if (fieldsPopupEl) {
      fieldsPopupEl.style.display = 'none';
    }
    currentPopupKey = '';
    currentPopupObjectName = '';
    currentPopupTargetObjectName = '';
    currentPopupDirectFieldAction = null;
  }

  function positionFieldsPopup(anchorRect) {
    const popup = ensureFieldsPopupElement();
    const popupWidth = 440;
    const popupMaxHeight = 450;

    let left = anchorRect.left;
    if (left + popupWidth > window.innerWidth - 16) {
      left = Math.max(12, window.innerWidth - popupWidth - 16);
    }

    let top = anchorRect.bottom + 6;
    if (top + popupMaxHeight > window.innerHeight - 12 && anchorRect.top > popupMaxHeight) {
      top = Math.max(12, anchorRect.top - popupMaxHeight - 6);
    }

    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  }

  async function gatherInPageCandidateTokens() {
    const tokens = [];
    const addToken = (t) => {
      if (!t || typeof t !== 'string') return;
      const clean = t.trim().replace(/^"|"$/g, '');
      if (clean.length > 15 && !tokens.includes(clean)) {
        tokens.push(clean);
      }
    };

    // 1. Read from chrome.storage.local (vaultSession.ssid and vaultCookieTokens synced by Side Panel / Background)
    try {
      const store = await new Promise((resolve) => {
        chrome.storage.local.get(
          ['vaultSession', 'vaultCookieTokens', 'vaultCookieTokenList'],
          (res) => resolve(res || {})
        );
      });
      if (store.vaultCookieTokens && store.vaultCookieTokens[window.location.hostname]) {
        addToken(store.vaultCookieTokens[window.location.hostname]);
      }
      if (store.vaultSession && store.vaultSession.ssid) {
        addToken(store.vaultSession.ssid);
      }
      if (store.vaultCookieTokens) {
        Object.values(store.vaultCookieTokens).forEach((v) => addToken(v));
      }
      if (Array.isArray(store.vaultCookieTokenList)) {
        store.vaultCookieTokenList.forEach((v) => addToken(v));
      }
    } catch (e) {}

    // 2. Ask background service worker via AUTO_DETECT_SSID if no token found yet
    if (tokens.length === 0) {
      try {
        const autoRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'AUTO_DETECT_SSID' }, (res) => {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(res);
          });
        });
        if (autoRes && autoRes.ssid) {
          addToken(autoRes.ssid);
        }
        if (autoRes && autoRes.vaultSession && autoRes.vaultSession.ssid) {
          addToken(autoRes.vaultSession.ssid);
        }
      } catch (e) {}
    }

    // 2. Read from document.cookie (TK, vaultSessionId, SESSION_ID, etc.)
    try {
      const cookieStr = document.cookie || '';
      const cookieNames = ['TK', 'vaultSessionId', 'SESSION_ID', 'veeva_session_id', 'sid'];
      for (const name of cookieNames) {
        const re = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`, 'i');
        const m = cookieStr.match(re);
        if (m && m[1]) {
          addToken(decodeURIComponent(m[1]));
        }
      }
    } catch (e) {}

    // 3. Read from sessionStorage / localStorage
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        const v = sessionStorage.getItem(k);
        if (k && /session|ssid|tk|token/i.test(k) && v && v.length > 20 && v.length < 400) {
          addToken(v);
        }
      }
    } catch (e) {}

    return tokens;
  }

  async function fetchObjectFieldsWithFallback(objectName) {
    const key = objectName.toLowerCase();
    if (localObjectFieldsCache.has(key)) {
      return localObjectFieldsCache.get(key);
    }

    // 1. Try via background service worker (uses chrome.cookies HttpOnly TK + session SSID)
    try {
      const bgRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_OBJECT_FIELDS',
            objectName,
            pageUrl: window.location.href
          },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(res);
            }
          }
        );
      });
      if (bgRes && (bgRes.ok || bgRes.success) && Array.isArray(bgRes.fields)) {
        const normalized = { ...bgRes, ok: true };
        localObjectFieldsCache.set(key, normalized);
        return normalized;
      }
    } catch (e) {}

    // 2. Direct same-origin GET request from content script using discovered Authorization tokens
    const candidateTokens = await gatherInPageCandidateTokens();
    const authHeadersToTry = candidateTokens.map((t) => ({
      Authorization: t,
      Accept: 'application/json'
    }));
    authHeadersToTry.push({ Accept: 'application/json' });

    const apiVersions = ['v24.1', 'v23.3', 'v22.3'];
    for (const headers of authHeadersToTry) {
      for (const ver of apiVersions) {
        try {
          const resp = await fetch(
            `${window.location.origin}/api/${ver}/metadata/vobjects/${encodeURIComponent(
              objectName
            )}`,
            {
              method: 'GET',
              credentials: 'include',
              headers
            }
          );
          if (!resp.ok) continue;
          const json = await resp.json();
          if (json && json.responseStatus === 'SUCCESS' && json.object) {
            const rawFields = Array.isArray(json.object.fields) ? json.object.fields : [];
            const fields = rawFields
              .map((f) => ({
                name: f.name || '',
                label: f.label || f.name || '',
                type: f.type || 'Field',
                required: Boolean(f.required),
                editable: f.editable !== undefined ? Boolean(f.editable) : true,
                maxLength: f.max_length || f.length || null,
                source: f.source || '',
                picklist: f.picklist || '',
                helpContent: f.help_content || f.description || '',
                lookupObject:
                  (typeof f.object === 'object' && f.object && f.object.name) ||
                  (typeof f.object === 'string' ? f.object : '') ||
                  f.lookup_object_name ||
                  ''
              }))
              .sort((a, b) =>
                (a.label || a.name).localeCompare(b.label || b.name, undefined, {
                  sensitivity: 'base'
                })
              );
            const result = {
              ok: true,
              objectName: json.object.name || objectName,
              objectLabel: json.object.label || objectName,
              fields
            };
            localObjectFieldsCache.set(key, result);
            return result;
          }
          // If INVALID_SESSION_ID with this token, try AUTO_DETECT_SSID once or move to next token
          if (json && json.errors && json.errors[0] && /SESSION/i.test(json.errors[0].type || '')) {
            break;
          }
        } catch (err) {}
      }
    }

    // 3. Final retry: force AUTO_DETECT_SSID in case stored token was expired
    try {
      const freshAuto = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'AUTO_DETECT_SSID' }, (res) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res);
        });
      });
      const freshSsid =
        (freshAuto && freshAuto.ssid) ||
        (freshAuto && freshAuto.vaultSession && freshAuto.vaultSession.ssid) ||
        '';
      if (freshSsid && !candidateTokens.includes(freshSsid)) {
        for (const ver of apiVersions) {
          try {
            const resp = await fetch(
              `${window.location.origin}/api/${ver}/metadata/vobjects/${encodeURIComponent(
                objectName
              )}`,
              {
                method: 'GET',
                credentials: 'include',
                headers: {
                  Authorization: freshSsid,
                  Accept: 'application/json'
                }
              }
            );
            if (!resp.ok) continue;
            const json = await resp.json();
            if (json && json.responseStatus === 'SUCCESS' && json.object) {
              const rawFields = Array.isArray(json.object.fields) ? json.object.fields : [];
              const fields = rawFields
                .map((f) => ({
                  name: f.name || '',
                  label: f.label || f.name || '',
                  type: f.type || 'Field',
                  required: Boolean(f.required),
                  editable: f.editable !== undefined ? Boolean(f.editable) : true,
                  maxLength: f.max_length || f.length || null,
                  source: f.source || '',
                  picklist: f.picklist || '',
                  helpContent: f.help_content || f.description || '',
                  lookupObject:
                    (typeof f.object === 'object' && f.object && f.object.name) ||
                    (typeof f.object === 'string' ? f.object : '') ||
                    f.lookup_object_name ||
                    ''
                }))
                .sort((a, b) =>
                  (a.label || a.name).localeCompare(b.label || b.name, undefined, {
                    sensitivity: 'base'
                  })
                );
              const result = {
                ok: true,
                objectName: json.object.name || objectName,
                objectLabel: json.object.label || objectName,
                fields
              };
              localObjectFieldsCache.set(key, result);
              return result;
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    return {
      ok: false,
      error:
        'Unable to load object fields from Vault API. Click "Auto-SSID" in the Side Panel to connect your Vault session.'
    };
  }

  function inferReferencedObjectCandidates(fieldRowData, apiFieldMeta) {
    const candidates = [];
    const addCandidate = (c) => {
      if (!c) return;
      const clean = c.trim().toLowerCase();
      if (clean && !candidates.includes(clean)) {
        candidates.push(clean);
      }
    };

    if (apiFieldMeta) {
      addCandidate(apiFieldMeta.lookupObject);
      addCandidate(apiFieldMeta.lookupObjectName);
    }

    const dt = fieldRowData.dataType || '';
    const isObjectRef = /^(?:parent\s+)?object\b/i.test(dt);
    if (!isObjectRef && !candidates.length) {
      return [];
    }

    const detail = (fieldRowData.typeDetail || '').trim();
    if (/^user$/i.test(detail)) {
      addCandidate('user__sys');
    } else if (/^documents?$/i.test(detail)) {
      addCandidate('document__v');
    }

    // Many Veeva standard/custom object reference fields have the exact same API name as the target object (e.g. active_dossier_item__v -> active_dossier_item__v)
    if (fieldRowData.name && /__(?:v|c|rim|sys|cda)$/i.test(fieldRowData.name)) {
      addCandidate(fieldRowData.name);
    }

    if (detail) {
      const slug = detail
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (slug) {
        addCandidate(`${slug}__v`);
        addCandidate(`${slug}__rim`);
        addCandidate(`${slug}__sys`);
        addCandidate(`${slug}__c`);
      }
    }

    return candidates;
  }

  function renderPopupFieldList() {
    if (!fieldsPopupEl) return;
    const listEl = fieldsPopupEl.querySelector('.vv-fpop-list');
    const countEl = fieldsPopupEl.querySelector('.vv-fpop-count');
    if (!listEl || !countEl) return;

    const query = (currentPopupFieldSearch || '').trim().toLowerCase();
    const filtered = query
      ? currentPopupFields.filter(
          (f) =>
            (f.label || '').toLowerCase().includes(query) ||
            (f.name || '').toLowerCase().includes(query) ||
            (f.type || '').toLowerCase().includes(query)
        )
      : currentPopupFields;

    countEl.textContent = query
      ? `${filtered.length} / ${currentPopupFields.length} fields`
      : `${currentPopupFields.length} fields`;

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="vv-fpop-status">No matching fields found.</div>`;
      return;
    }

    const navObj = currentPopupTargetObjectName || currentPopupObjectName;

    listEl.innerHTML = filtered
      .map(
        (f) => `
        <div class="vv-fpop-item" data-field-name="${escapeHtml(f.name)}" data-field-label="${escapeHtml(f.label)}">
          <div class="vv-fpop-item-main">
            <div class="vv-fpop-item-label" title="${escapeHtml(f.label)}">${escapeHtml(f.label)}</div>
            <div class="vv-fpop-item-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
          </div>
          <div class="vv-fpop-item-meta">
            <span class="vv-fpop-type-badge">${escapeHtml(f.type || 'Field')}</span>
            <span class="vv-fpop-open-hint">Open &rarr;</span>
          </div>
        </div>
      `
      )
      .join('');

    listEl.querySelectorAll('.vv-fpop-item').forEach((itemEl) => {
      itemEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fieldName = itemEl.getAttribute('data-field-name');
        const fieldLabel = itemEl.getAttribute('data-field-label');
        if (navObj) {
          navigateToObjectFields(navObj, {
            name: fieldName,
            label: fieldLabel
          });
        }
      });
    });
  }

  async function openObjectFieldsPopupForCell(nameCell) {
    if (!settings.enableObjectSchemaTools) return;
    const tr = nameCell.closest('tr');
    if (!tr) return;
    const rowData = getRowColumnTexts(tr);
    const objectName = rowData.name;
    const objectLabel = rowData.label || objectName;
    if (!objectName) return;

    const popupKey = `obj:${objectName}`;
    const popup = ensureFieldsPopupElement();
    const labelEl = popup.querySelector('.vv-fpop-label');
    const apiEl = popup.querySelector('.vv-fpop-apiname');
    const gotoBtn = popup.querySelector('.vv-fpop-goto-btn');
    const targetBtn = popup.querySelector('.vv-fpop-target-btn');
    const metaStrip = popup.querySelector('.vv-fpop-meta-strip');
    const bannerEl = popup.querySelector('.vv-fpop-section-banner');
    const listEl = popup.querySelector('.vv-fpop-list');
    const countEl = popup.querySelector('.vv-fpop-count');
    const searchInput = popup.querySelector('.vv-fpop-search-input');

    currentPopupKey = popupKey;
    currentPopupObjectName = objectName;
    currentPopupObjectLabel = objectLabel;
    currentPopupTargetObjectName = '';
    currentPopupDirectFieldAction = null;
    currentPopupFieldSearch = '';
    if (searchInput) searchInput.value = '';

    labelEl.textContent = objectLabel;
    apiEl.textContent = objectName;
    gotoBtn.innerHTML = 'Go to Fields &#8599;';
    gotoBtn.title = `Open ${objectName} Fields tab`;
    targetBtn.style.display = 'none';
    metaStrip.style.display = 'none';
    bannerEl.style.display = 'none';

    countEl.textContent = 'Loading...';
    listEl.innerHTML = `<div class="vv-fpop-status">Loading fields for <strong>${escapeHtml(objectName)}</strong>...</div>`;

    const rect = nameCell.getBoundingClientRect();
    positionFieldsPopup(rect);
    popup.style.display = 'flex';

    const res = await fetchObjectFieldsWithFallback(objectName);
    if (currentPopupKey !== popupKey) return;

    if (!res || !res.ok) {
      countEl.textContent = '0 fields';
      listEl.innerHTML = `<div class="vv-fpop-status error">${escapeHtml(
        (res && res.error) || 'Could not load object fields.'
      )}</div>`;
      return;
    }

    if (res.objectLabel) {
      labelEl.textContent = res.objectLabel;
    }
    currentPopupFields = res.fields || [];
    renderPopupFieldList();
  }

  async function openFieldRowInspectorPopup(tr, anchorCell, fieldsCtx) {
    if (!settings.enableObjectSchemaTools || !tr || !fieldsCtx) return;
    const fieldData = getFieldRowColumnTexts(tr);
    if (!fieldData.name) return;

    const currentObjectName = fieldsCtx.objectName || getObjectFromUrlOrLinks(fieldsCtx.table);
    const popupKey = `field:${currentObjectName}:${fieldData.name}`;

    const popup = ensureFieldsPopupElement();
    const labelEl = popup.querySelector('.vv-fpop-label');
    const apiEl = popup.querySelector('.vv-fpop-apiname');
    const gotoBtn = popup.querySelector('.vv-fpop-goto-btn');
    const targetBtn = popup.querySelector('.vv-fpop-target-btn');
    const metaStrip = popup.querySelector('.vv-fpop-meta-strip');
    const bannerEl = popup.querySelector('.vv-fpop-section-banner');
    const listEl = popup.querySelector('.vv-fpop-list');
    const countEl = popup.querySelector('.vv-fpop-count');
    const searchInput = popup.querySelector('.vv-fpop-search-input');

    currentPopupKey = popupKey;
    currentPopupObjectName = currentObjectName;
    currentPopupTargetObjectName = '';
    currentPopupFieldSearch = '';
    if (searchInput) searchInput.value = '';

    labelEl.textContent = fieldData.label || fieldData.name;
    apiEl.textContent = currentObjectName
      ? `${currentObjectName}.${fieldData.name}`
      : fieldData.name;

    gotoBtn.innerHTML = 'Open Field &#8599;';
    gotoBtn.title = `Open field ${fieldData.name}`;
    targetBtn.style.display = 'none';

    currentPopupDirectFieldAction = () => {
      navigateToObjectFields(currentObjectName, {
        name: fieldData.name,
        label: fieldData.label,
        directHref: fieldData.href
      });
    };

    // Show immediate row metadata in the strip
    metaStrip.style.display = 'flex';
    metaStrip.innerHTML = `
      <span><strong>Type:</strong> ${escapeHtml(fieldData.dataType || 'Field')}</span>
      <span><strong>Source:</strong> ${escapeHtml(fieldData.source || 'Standard')}</span>
    `;

    bannerEl.style.display = 'flex';
    bannerEl.innerHTML = `<span>Loading metadata...</span>`;
    countEl.textContent = 'Loading...';
    listEl.innerHTML = `<div class="vv-fpop-status">Inspecting <strong>${escapeHtml(fieldData.name)}</strong>...</div>`;

    const rect = anchorCell.getBoundingClientRect();
    positionFieldsPopup(rect);
    popup.style.display = 'flex';

    // Fetch current object's metadata to enrich this field and resolve lookup target object
    let currentObjRes = null;
    let apiFieldMeta = null;
    if (currentObjectName) {
      currentObjRes = await fetchObjectFieldsWithFallback(currentObjectName);
      if (currentPopupKey !== popupKey) return;
      if (currentObjRes && currentObjRes.ok && Array.isArray(currentObjRes.fields)) {
        apiFieldMeta = currentObjRes.fields.find(
          (f) => (f.name || '').toLowerCase() === fieldData.name.toLowerCase()
        );
      }
    }

    // Update metadata strip with extra API details if available
    const metaBadges = [
      `<span><strong>Type:</strong> ${escapeHtml(fieldData.dataType || (apiFieldMeta && apiFieldMeta.type) || 'Field')}</span>`,
      `<span><strong>Source:</strong> ${escapeHtml(fieldData.source || (apiFieldMeta && apiFieldMeta.source) || 'Standard')}</span>`
    ];
    if (apiFieldMeta) {
      metaBadges.push(
        `<span><strong>Required:</strong> ${apiFieldMeta.required ? 'Yes' : 'No'}</span>`
      );
      if (apiFieldMeta.maxLength) {
        metaBadges.push(`<span><strong>Max Length:</strong> ${escapeHtml(String(apiFieldMeta.maxLength))}</span>`);
      }
      if (apiFieldMeta.picklist) {
        metaBadges.push(`<span><strong>Picklist:</strong> ${escapeHtml(apiFieldMeta.picklist)}</span>`);
      }
    }
    metaStrip.innerHTML = metaBadges.join('');

    // Check if this field is an Object / Parent Object reference field
    const refCandidates = inferReferencedObjectCandidates(fieldData, apiFieldMeta);
    let resolvedTargetRes = null;
    let resolvedTargetObjName = '';

    for (const candidateObj of refCandidates) {
      const res = await fetchObjectFieldsWithFallback(candidateObj);
      if (currentPopupKey !== popupKey) return;
      if (res && res.ok && Array.isArray(res.fields) && res.fields.length > 0) {
        resolvedTargetRes = res;
        resolvedTargetObjName = res.objectName || candidateObj;
        break;
      }
    }

    if (resolvedTargetRes && resolvedTargetObjName) {
      currentPopupTargetObjectName = resolvedTargetObjName;
      targetBtn.style.display = 'inline-block';
      targetBtn.innerHTML = `Target Object (${escapeHtml(resolvedTargetObjName)}) &#8599;`;
      targetBtn.title = `Open all Fields of referenced object ${resolvedTargetObjName}`;

      bannerEl.style.display = 'flex';
      bannerEl.innerHTML = `
        <span>Referenced Object Fields: ${escapeHtml(resolvedTargetRes.objectLabel || resolvedTargetObjName)} (${escapeHtml(resolvedTargetObjName)})</span>
      `;
      currentPopupFields = resolvedTargetRes.fields || [];
      renderPopupFieldList();
      return;
    }

    // Otherwise, show all fields of the current object (from API or from the DOM table) for quick jump
    currentPopupTargetObjectName = currentObjectName;
    bannerEl.style.display = 'flex';
    bannerEl.innerHTML = `
      <span>Fields on ${escapeHtml((currentObjRes && currentObjRes.objectLabel) || currentObjectName || 'Current Object')} (Quick Jump)</span>
    `;

    if (currentObjRes && currentObjRes.ok && Array.isArray(currentObjRes.fields)) {
      currentPopupFields = currentObjRes.fields;
    } else {
      // Fallback: build field list directly from the current Fields table rows in the DOM!
      const domRows = Array.from(
        fieldsCtx.tbody.querySelectorAll('tr.tableRow, tr')
      ).filter((r) => r.querySelector('td'));
      currentPopupFields = domRows.map((r) => {
        const d = getFieldRowColumnTexts(r);
        return {
          name: d.name,
          label: d.label || d.name,
          type: d.dataType || 'Field',
          source: d.source || ''
        };
      });
    }
    renderPopupFieldList();
  }

  function navigateToObjectFields(objectName, targetField) {
    hideObjectFieldsPopupImmediate();

    if (targetField && targetField.directHref) {
      const hashIdx = targetField.directHref.indexOf('#');
      if (hashIdx !== -1) {
        window.location.hash = targetField.directHref.slice(hashIdx);
        showToast(`Opened field: ${targetField.label || targetField.name}`);
        return;
      }
    }

    if (objectName && targetField && targetField.name) {
      // Check if there is already a direct link in the current Fields table
      const fieldsCtx = findObjectFieldsTableContext();
      if (fieldsCtx && fieldsCtx.tbody && (!fieldsCtx.objectName || fieldsCtx.objectName.toLowerCase() === objectName.toLowerCase())) {
        const directLink = fieldsCtx.tbody.querySelector(
          `tr[key="${CSS.escape(targetField.name)}"] a.objSchemaLink, a.objSchemaLink[href*="d=${CSS.escape(targetField.name)}"]`
        );
        if (directLink) {
          directLink.click();
          showToast(`Opened field: ${targetField.label || targetField.name}`);
          return;
        }
      }

      // Direct Veeva Vault URL for a specific field on an object
      showToast(
        `Navigating to ${objectName} -> Field: ${targetField.label || targetField.name}...`
      );
      window.location.hash = `#admin/content_setup/object_schema/fields?t=${encodeURIComponent(
        objectName
      )}&d=${encodeURIComponent(targetField.name)}`;
      return;
    }

    if (objectName && !targetField) {
      // Direct Veeva Vault URL for an object's Fields list
      showToast(`Navigating to ${objectName} -> Fields...`);
      window.location.hash = `#admin/content_setup/object_schema/fields?t=${encodeURIComponent(
        objectName
      )}`;
      return;
    }
  }

  function checkPendingFieldNavigation() {
    if (!pendingFieldNavigation || pendingFieldNavigation.completed) return;
    if (Date.now() - pendingFieldNavigation.startedAt > 15000) {
      pendingFieldNavigation = null;
      return;
    }
  }

  // Hover delegation for Object Name cells (Objects table) AND Field Name / Data Type cells (Fields table)
  document.addEventListener(
    'mouseover',
    (e) => {
      if (!settings.enableObjectSchemaTools) return;
      if (!e.target || !e.target.closest) return;

      // Case 1: Object Schema Table -> Object Name cell (td[data-column-name="name"])
      const nameCell = e.target.closest('td[data-column-name="name"]');
      if (nameCell) {
        const table = nameCell.closest('table.vv_gridview_table');
        if (table && isOnObjectSchemaListPage()) {
          if (hoverHideTimer) {
            clearTimeout(hoverHideTimer);
            hoverHideTimer = null;
          }

          const tr = nameCell.closest('tr');
          const rowData = tr ? getRowColumnTexts(tr) : null;
          if (rowData && rowData.name && currentPopupKey === `obj:${rowData.name}`) {
            return;
          }

          if (hoverShowTimer) {
            clearTimeout(hoverShowTimer);
          }
          hoverShowTimer = setTimeout(() => {
            openObjectFieldsPopupForCell(nameCell);
          }, 220);
          return;
        }
      }

      // Case 2: Object Fields Table -> Field Name (2nd td) or Data Type (4th td) cell
      const fieldTd = e.target.closest('table.vv_lists_table tr.tableRow td');
      if (fieldTd) {
        const tr = fieldTd.closest('tr.tableRow');
        const cells = tr ? Array.from(tr.querySelectorAll('td')) : [];
        const cellIndex = cells.indexOf(fieldTd);
        if (cellIndex === 1 || cellIndex === 3) {
          const fieldsCtx = findObjectFieldsTableContext();
          if (fieldsCtx && fieldsCtx.table === fieldTd.closest('table')) {
            if (hoverHideTimer) {
              clearTimeout(hoverHideTimer);
              hoverHideTimer = null;
            }

            const fData = getFieldRowColumnTexts(tr);
            const expectedKey = `field:${fieldsCtx.objectName}:${fData.name}`;
            if (fData.name && currentPopupKey === expectedKey) {
              return;
            }

            if (hoverShowTimer) {
              clearTimeout(hoverShowTimer);
            }
            hoverShowTimer = setTimeout(() => {
              openFieldRowInspectorPopup(tr, fieldTd, fieldsCtx);
            }, 220);
          }
        }
      }
    },
    true
  );

  document.addEventListener(
    'mouseout',
    (e) => {
      if (!settings.enableObjectSchemaTools) return;
      if (!e.target || !e.target.closest) return;

      const triggerCell =
        e.target.closest('td[data-column-name="name"]') ||
        e.target.closest('table.vv_lists_table tr.tableRow td');
      if (!triggerCell) return;

      const related = e.relatedTarget;
      if (
        related &&
        related.closest &&
        (related.closest('td') === triggerCell ||
          related.closest('#vv-doc-object-fields-popup'))
      ) {
        return;
      }

      scheduleHideFieldsPopup(280);
    },
    true
  );

  // Observe SPA navigation and DOM changes for Object Schema table
  let schemaCheckScheduled = false;
  function scheduleObjectSchemaCheck() {
    if (schemaCheckScheduled) return;
    schemaCheckScheduled = true;
    requestAnimationFrame(() => {
      schemaCheckScheduled = false;
      ensureObjectSchemaSearchBar();
    });
  }

  window.addEventListener('hashchange', scheduleObjectSchemaCheck);
  window.addEventListener('popstate', scheduleObjectSchemaCheck);

  if (document.body) {
    const pageObserver = new MutationObserver(scheduleObjectSchemaCheck);
    pageObserver.observe(document.body, { childList: true, subtree: true });
    syncObjectSchemaToolsState();
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      const pageObserver = new MutationObserver(scheduleObjectSchemaCheck);
      pageObserver.observe(document.body, { childList: true, subtree: true });
      syncObjectSchemaToolsState();
    });
  }
})();
