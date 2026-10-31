// sidepanel.js - User-Friendly Veeva Vault RIM Config Documenter Controller

document.addEventListener('DOMContentLoaded', () => {
  const btnToggleRecord = document.getElementById('btnToggleRecord');
  const recordStatusText = document.getElementById('recordStatusText');
  const btnPopoutWindow = document.getElementById('btnPopoutWindow');
  const btnFontSmaller = document.getElementById('btnFontSmaller');
  const btnFontLarger = document.getElementById('btnFontLarger');

  const toggleAuthPanel = document.getElementById('toggleAuthPanel');
  const authPanelBody = document.getElementById('authPanelBody');
  const caretAuth = document.getElementById('caretAuth');
  const ssidBadge = document.getElementById('ssidBadge');
  const connectedVaultLabel = document.getElementById('connectedVaultLabel');
  const btnQuickAutoSsid = document.getElementById('btnQuickAutoSsid');

  const toggleShortcutsPanel = document.getElementById('toggleShortcutsPanel');
  const shortcutsPanelBody = document.getElementById('shortcutsPanelBody');
  const caretShortcuts = document.getElementById('caretShortcuts');
  const detailsKeymapBar = document.getElementById('detailsKeymapBar');

  const toggleCompQueryPanel = document.getElementById('toggleCompQueryPanel');
  const compQueryPanelBody = document.getElementById('compQueryPanelBody');
  const caretCompQuery = document.getElementById('caretCompQuery');

  const inputVaultDns = document.getElementById('inputVaultDns');
  const inputSsid = document.getElementById('inputSsid');
  const btnAutoDetectSsid = document.getElementById('btnAutoDetectSsid');
  const btnVerifySsid = document.getElementById('btnVerifySsid');
  const btnShowSsid = document.getElementById('btnShowSsid');

  const inputUsername = document.getElementById('inputUsername');
  const inputPassword = document.getElementById('inputPassword');
  const btnLoginVault = document.getElementById('btnLoginVault');
  const authFeedback = document.getElementById('authFeedback');

  const chkAutoGoTo = document.getElementById('chkAutoGoTo');
  const chkPassClick = document.getElementById('chkPassClick');
  const chkIncludeApiNames = document.getElementById('chkIncludeApiNames');
  const chkHighlightScreenshot = document.getElementById('chkHighlightScreenshot');
  const chkAppendComponents = document.getElementById('chkAppendComponents');
  const chkShowHud = document.getElementById('chkShowHud');
  const selMode1Style = document.getElementById('selMode1Style');
  const selComponentsFormat = document.getElementById('selComponentsFormat');

  const countSteps = document.getElementById('countSteps');
  const countComponents = document.getElementById('countComponents');

  const btnAddTextStep = document.getElementById('btnAddTextStep');
  const btnTakeScreenshotNow = document.getElementById('btnTakeScreenshotNow');
  const btnUndoLast = document.getElementById('btnUndoLast');
  const btnToggleAllCards = document.getElementById('btnToggleAllCards');
  const btnLoadSample = document.getElementById('btnLoadSample');
  const btnOpenMockPage = document.getElementById('btnOpenMockPage');
  const btnClearAll = document.getElementById('btnClearAll');
  const stepsContainer = document.getElementById('stepsContainer');
  const docPreviewContainer = document.getElementById('docPreviewContainer');

  const selCompQueryMode = document.getElementById('selCompQueryMode');
  const inputCompSearch = document.getElementById('inputCompSearch');
  const btnQueryComponents = document.getElementById('btnQueryComponents');
  const compQueryFeedback = document.getElementById('compQueryFeedback');
  const btnAddComponentManual = document.getElementById('btnAddComponentManual');
  const btnToggleAllComps = document.getElementById('btnToggleAllComps');
  const btnLoadSampleComponents = document.getElementById('btnLoadSampleComponents');
  const btnCopyComponentsBlock = document.getElementById('btnCopyComponentsBlock');
  const btnClearComponents = document.getElementById('btnClearComponents');
  const componentsContainer = document.getElementById('componentsContainer');

  const inputDocTitle = document.getElementById('inputDocTitle');
  const inputTicketId = document.getElementById('inputTicketId');
  const selEnvironment = document.getElementById('selEnvironment');

  const toggleRequestMetaPanel = document.getElementById('toggleRequestMetaPanel');
  const requestMetaPanelBody = document.getElementById('requestMetaPanelBody');
  const caretRequestMeta = document.getElementById('caretRequestMeta');
  const requestMetaSummary = document.getElementById('requestMetaSummary');
  const inputCycleName = document.getElementById('inputCycleName');
  const inputRequesterName = document.getElementById('inputRequesterName');
  const inputDeveloperName = document.getElementById('inputDeveloperName');
  const textareaOriginalRequest = document.getElementById('textareaOriginalRequest');

  const btnGenerateVql = document.getElementById('btnGenerateVql');
  const textareaVqlOutput = document.getElementById('textareaVqlOutput');
  const btnCopyVql = document.getElementById('btnCopyVql');
  const btnCopyConfluence = document.getElementById('btnCopyConfluence');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnImportJson = document.getElementById('btnImportJson');
  const fileInputJson = document.getElementById('fileInputJson');

  const annotatorModal = document.getElementById('annotatorModal');
  const annotatorCanvas = document.getElementById('annotatorCanvas');
  const btnCloseAnnotator = document.getElementById('btnCloseAnnotator');
  const btnCancelAnnotator = document.getElementById('btnCancelAnnotator');
  const btnSaveAnnotator = document.getElementById('btnSaveAnnotator');
  const btnAnnotatorUndo = document.getElementById('btnAnnotatorUndo');

  const btnCopyText = document.getElementById('btnCopyText');
  const btnExportDocx = document.getElementById('btnExportDocx');
  const btnResetEverythingHeader = document.getElementById('btnResetEverythingHeader');
  const btnResetEverythingFooter = document.getElementById('btnResetEverythingFooter');

  let docSteps = [];
  let affectedComponents = [];
  let maximizedStepId = null;
  let localStepsSavePending = 0;
  let localCompsSavePending = 0;
  let settings = {
    isRecording: true,
    autoGoToPrefix: true,
    passClickThrough: true,
    highlightOnScreenshot: false,
    includeApiNames: true,
    mode1Style: 'blank_line',
    showFloatingHud: true,
    appendComponentsToDoc: true,
    componentsFormat: 'text',
    fontScale: 'font-compact'
  };
  let docMeta = {
    title: 'Veeva Vault RIM Configuration Steps',
    ticketId: '',
    environment: 'Sandbox',
    cycleName: '',
    requesterName: '',
    developerName: '',
    originalRequest: ''
  };
  let vaultSession = {
    connected: false,
    vaultDns: '',
    ssid: '',
    userName: ''
  };

  // Ensure content.js is injected in all open Veeva tabs immediately when Side Panel opens
  chrome.runtime.sendMessage({ type: 'ENSURE_CONTENT_SCRIPTS' }).catch(() => {});

  // Pop-out Floating Window button ('Külön ablak')
  const isPopoutWindow = window.location.search.includes('window=1');
  if (btnPopoutWindow) {
    if (isPopoutWindow) {
      btnPopoutWindow.style.display = 'none';
    } else {
      btnPopoutWindow.addEventListener('click', () => {
        const popoutUrl = chrome.runtime.getURL('sidepanel.html?window=1');
        chrome.windows.create({
          url: popoutUrl,
          type: 'popup',
          width: 520,
          height: 760
        });
      });
    }
  }

  // Font Scale Controls (A- / A+)
  const fontScaleOrder = ['font-small', 'font-compact', 'font-normal', 'font-large'];

  function applyFontScale(scaleClass) {
    const valid = fontScaleOrder.includes(scaleClass) ? scaleClass : 'font-compact';
    fontScaleOrder.forEach((cls) => document.body.classList.remove(cls));
    document.body.classList.add(valid);
    settings.fontScale = valid;
  }

  if (btnFontSmaller) {
    btnFontSmaller.addEventListener('click', () => {
      const idx = fontScaleOrder.indexOf(settings.fontScale || 'font-compact');
      if (idx > 0) {
        applyFontScale(fontScaleOrder[idx - 1]);
        saveSettings();
      }
    });
  }

  if (btnFontLarger) {
    btnFontLarger.addEventListener('click', () => {
      const idx = fontScaleOrder.indexOf(settings.fontScale || 'font-compact');
      if (idx < fontScaleOrder.length - 1) {
        applyFontScale(fontScaleOrder[idx + 1]);
        saveSettings();
      }
    });
  }

  let panelActiveMode = null;
  let panelStickyMode = false;

  function syncModeFromPanel(mode, sticky) {
    panelActiveMode = mode;
    panelStickyMode = sticky;
    updatePanelKeyBadges();
    chrome.runtime
      .sendMessage({
        type: 'SYNC_KEY_MODE',
        mode: panelActiveMode,
        sticky: panelStickyMode
      })
      .catch(() => {});
  }

  function updatePanelKeyBadges() {
    document.querySelectorAll('.vv-key-item[data-mode]').forEach((el) => {
      if (el.getAttribute('data-mode') === panelActiveMode) {
        el.classList.add('active-mode');
      } else {
        el.classList.remove('active-mode');
      }
    });
  }

  // Allow clicking the 0/1/2/3/4 shortcut badges in Side Panel to lock/unlock that click mode
  document.querySelectorAll('.vv-key-item[data-mode]').forEach((item) => {
    item.addEventListener('click', () => {
      const clickedMode = item.getAttribute('data-mode');
      if (panelActiveMode === clickedMode && panelStickyMode) {
        syncModeFromPanel(null, false);
      } else {
        syncModeFromPanel(clickedMode, true);
      }
    });
  });

  // Also capture 0/1/2/3/4 keys if keyboard focus is still inside the Side Panel
  function getPanelKeyMode(e) {
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
    if (key === '1' || code === 'Digit1' || code === 'Numpad1' || kc === 49 || kc === 97) return '1';
    if (key === '2' || code === 'Digit2' || code === 'Numpad2' || kc === 50 || kc === 98) return '2';
    if (key === '3' || code === 'Digit3' || code === 'Numpad3' || kc === 51 || kc === 99) return '3';
    if (key === '4' || code === 'Digit4' || code === 'Numpad4' || kc === 52 || kc === 100) return '4';
    return null;
  }

  window.addEventListener('keydown', (e) => {
    const activeTag = (document.activeElement?.tagName || '').toLowerCase();
    if (
      activeTag === 'input' ||
      activeTag === 'textarea' ||
      activeTag === 'select' ||
      document.activeElement?.isContentEditable
    ) {
      if (e.key === 'Escape' && maximizedStepId) {
        e.preventDefault();
        maximizedStepId = null;
        renderSteps();
      }
      return;
    }
    if (e.key === 'Escape') {
      if (maximizedStepId) {
        e.preventDefault();
        maximizedStepId = null;
        renderSteps();
        return;
      }
      if (panelActiveMode) {
        syncModeFromPanel(null, false);
        return;
      }
    }
    const m = getPanelKeyMode(e);
    if (m) {
      e.preventDefault();
      if (panelActiveMode !== m) {
        syncModeFromPanel(m, false);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const m = getPanelKeyMode(e);
    if (m && panelActiveMode === m && !panelStickyMode) {
      syncModeFromPanel(null, false);
    }
  });

  chrome.storage.local.get(
    ['docSteps', 'affectedComponents', 'settings', 'vaultSession', 'docMeta', 'remoteKeyState'],
    (res) => {
      if (Array.isArray(res.docSteps)) docSteps = res.docSteps;
      if (Array.isArray(res.affectedComponents)) affectedComponents = res.affectedComponents;
      if (res.settings) settings = { ...settings, ...res.settings };
      if (res.vaultSession) vaultSession = { ...vaultSession, ...res.vaultSession };
      if (res.docMeta) docMeta = { ...docMeta, ...res.docMeta };
      if (res.remoteKeyState && res.remoteKeyState.sticky) {
        panelActiveMode = res.remoteKeyState.mode;
        panelStickyMode = true;
        updatePanelKeyBadges();
      }

      syncSettingsUi();
      syncAuthUi();
      syncMetaUi();
      renderSteps();
      renderComponents();
      renderDocPreview();
      updateVqlBox();
    }
  );

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STEPS_UPDATED' && Array.isArray(msg.docSteps)) {
      docSteps = msg.docSteps;
      renderSteps(true);
      renderDocPreview();
      updateVqlBox();
    }
    if (msg.type === 'COMPONENTS_UPDATED' && Array.isArray(msg.affectedComponents)) {
      affectedComponents = msg.affectedComponents;
      renderComponents();
      renderDocPreview();
      updateVqlBox();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.docSteps) {
        if (localStepsSavePending > 0) {
          // Ignore self-triggered storage change so active textarea never loses focus or resize height
          return;
        }
        docSteps = changes.docSteps.newValue || [];
        renderSteps();
        renderDocPreview();
      }
      if (changes.affectedComponents) {
        if (localCompsSavePending > 0) {
          return;
        }
        affectedComponents = changes.affectedComponents.newValue || [];
        renderComponents();
        renderDocPreview();
        updateVqlBox();
      }
      if (changes.remoteKeyState && changes.remoteKeyState.newValue) {
        panelActiveMode = changes.remoteKeyState.newValue.mode || null;
        panelStickyMode = Boolean(changes.remoteKeyState.newValue.sticky);
        updatePanelKeyBadges();
      }
    }
  });

  // Main Navigation Tabs
  document.querySelectorAll('.ws-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ws-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-wstab');
      document.getElementById('viewSteps').classList.toggle('active', target === 'steps');
      document
        .getElementById('viewComponents')
        .classList.toggle('active', target === 'components');
      document.getElementById('viewPreview').classList.toggle('active', target === 'preview');
      document.getElementById('viewAdminPro').classList.toggle('active', target === 'adminpro');
      if (target === 'preview') renderDocPreview();
      if (target === 'adminpro') updateVqlBox();
    });
  });

  // Auth Subtabs
  document.querySelectorAll('.auth-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
      const target = tabBtn.getAttribute('data-tab');
      document.getElementById('tabContentSsid').classList.toggle('active', target === 'ssid');
      document
        .getElementById('tabContentCredentials')
        .classList.toggle('active', target === 'credentials');
    });
  });

  function updateSectionCaret(bodyEl, caretEl) {
    if (!bodyEl || !caretEl) return;
    caretEl.textContent = bodyEl.classList.contains('collapsed') ? '▸' : '▾';
  }

  toggleAuthPanel.addEventListener('click', (e) => {
    if (e.target.closest('#btnQuickAutoSsid')) return;
    authPanelBody.classList.toggle('collapsed');
    updateSectionCaret(authPanelBody, caretAuth);
  });

  if (toggleShortcutsPanel && shortcutsPanelBody) {
    toggleShortcutsPanel.addEventListener('click', () => {
      shortcutsPanelBody.classList.toggle('collapsed');
      updateSectionCaret(shortcutsPanelBody, caretShortcuts);
      settings.shortcutsPanelCollapsed = shortcutsPanelBody.classList.contains('collapsed');
      saveSettings();
    });
  }

  if (detailsKeymapBar) {
    detailsKeymapBar.addEventListener('toggle', () => {
      settings.keymapBarCollapsed = !detailsKeymapBar.open;
      saveSettings();
    });
  }

  if (toggleCompQueryPanel && compQueryPanelBody) {
    toggleCompQueryPanel.addEventListener('click', () => {
      compQueryPanelBody.classList.toggle('collapsed');
      updateSectionCaret(compQueryPanelBody, caretCompQuery);
    });
  }

  if (toggleRequestMetaPanel && requestMetaPanelBody) {
    toggleRequestMetaPanel.addEventListener('click', () => {
      requestMetaPanelBody.classList.toggle('collapsed');
      updateSectionCaret(requestMetaPanelBody, caretRequestMeta);
      settings.requestMetaCollapsed = requestMetaPanelBody.classList.contains('collapsed');
      saveSettings();
    });
  }

  // Collapsible cards in VQL & Projekt tab
  document.querySelectorAll('.collapsible-card-header').forEach((hdr) => {
    hdr.addEventListener('click', () => {
      const targetId = hdr.getAttribute('data-target');
      const bodyEl = targetId ? document.getElementById(targetId) : null;
      const caretEl = hdr.querySelector('.vv-caret');
      if (bodyEl) {
        bodyEl.classList.toggle('collapsed');
        hdr.classList.toggle('collapsed-header', bodyEl.classList.contains('collapsed'));
        updateSectionCaret(bodyEl, caretEl);
      }
    });
  });

  btnShowSsid.addEventListener('click', () => {
    if (inputSsid.type === 'password') {
      inputSsid.type = 'text';
      btnShowSsid.textContent = 'Hide';
    } else {
      inputSsid.type = 'password';
      btnShowSsid.textContent = 'Show';
    }
  });

  function triggerAutoSsid() {
    setAuthFeedback('Searching for active Veeva Vault session...', '#1a73e8');
    chrome.runtime.sendMessage({ type: 'AUTO_DETECT_SSID' }, (res) => {
      if (!res) {
        setAuthFeedback('Failed to read active session.', '#c62828');
        authPanelBody.classList.remove('collapsed');
        updateSectionCaret(authPanelBody, caretAuth);
        return;
      }
      if (res.vaultDns) inputVaultDns.value = res.vaultDns;
      if (res.ssid) inputSsid.value = res.ssid;
      if (res.vaultSession) {
        vaultSession = res.vaultSession;
        syncAuthUi();
      } else {
        authPanelBody.classList.remove('collapsed');
        updateSectionCaret(authPanelBody, caretAuth);
      }
      setAuthFeedback(
        res.message || (res.ssid ? 'SSID auto-detected successfully.' : 'No active SSID cookie found.'),
        res.ssid ? '#2e7d32' : '#e07f0b'
      );
    });
  }

  btnAutoDetectSsid.addEventListener('click', triggerAutoSsid);
  if (btnQuickAutoSsid) {
    btnQuickAutoSsid.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerAutoSsid();
    });
  }

  btnVerifySsid.addEventListener('click', () => {
    const dns = inputVaultDns.value.trim();
    const ssid = inputSsid.value.trim();
    if (!dns || !ssid) {
      setAuthFeedback('Please provide both Vault DNS and Session ID (SSID)!', '#c62828');
      return;
    }
    setAuthFeedback('Verifying SSID (Read-Only)...', '#1a73e8');
    chrome.runtime.sendMessage({ type: 'VERIFY_SSID', vaultDns: dns, ssid }, (res) => {
      if (res && res.success) {
        vaultSession = res.vaultSession;
        syncAuthUi();
        setAuthFeedback(res.message || 'Connected.', '#2e7d32');
      } else {
        setAuthFeedback((res && res.error) || 'Authentication failed.', '#c62828');
      }
    });
  });

  btnLoginVault.addEventListener('click', () => {
    const dns = inputVaultDns.value.trim();
    const username = inputUsername.value.trim();
    const password = inputPassword.value;
    if (!dns || !username || !password) {
      setAuthFeedback('All fields are required!', '#c62828');
      return;
    }
    setAuthFeedback('Signing in via Veeva Vault REST API...', '#1a73e8');
    chrome.runtime.sendMessage(
      { type: 'LOGIN_VAULT_CREDENTIALS', vaultDns: dns, username, password },
      (res) => {
        if (res && res.success) {
          vaultSession = res.vaultSession;
          inputSsid.value = vaultSession.ssid;
          syncAuthUi();
          setAuthFeedback(res.message || 'Signed in successfully.', '#2e7d32');
        } else {
          setAuthFeedback((res && res.error) || 'Sign-in failed.', '#c62828');
        }
      }
    );
  });

  function setAuthFeedback(msg, color) {
    authFeedback.textContent = msg;
    authFeedback.style.color = color || '#333333';
  }

  function syncAuthUi() {
    if (vaultSession && vaultSession.connected && vaultSession.ssid) {
      ssidBadge.textContent = 'Connected';
      ssidBadge.className = 'vv-badge vv-badge-active';
      connectedVaultLabel.textContent = vaultSession.vaultDns || '';
      inputVaultDns.value = vaultSession.vaultDns || '';
      inputSsid.value = vaultSession.ssid || '';
      authPanelBody.classList.add('collapsed');
    } else {
      ssidBadge.textContent = 'Not Connected';
      ssidBadge.className = 'vv-badge vv-badge-inactive';
      connectedVaultLabel.textContent = '';
    }
    updateSectionCaret(authPanelBody, caretAuth);
  }

  // Settings Controls
  btnToggleRecord.addEventListener('click', () => {
    settings.isRecording = !settings.isRecording;
    saveSettings();
    syncSettingsUi();
  });

  chkAutoGoTo.addEventListener('change', () => {
    settings.autoGoToPrefix = chkAutoGoTo.checked;
    saveSettings();
  });
  chkPassClick.addEventListener('change', () => {
    settings.passClickThrough = chkPassClick.checked;
    saveSettings();
  });
  chkIncludeApiNames.addEventListener('change', () => {
    settings.includeApiNames = chkIncludeApiNames.checked;
    saveSettings();
  });
  chkHighlightScreenshot.addEventListener('change', () => {
    settings.highlightOnScreenshot = chkHighlightScreenshot.checked;
    saveSettings();
  });
  chkAppendComponents.addEventListener('change', () => {
    settings.appendComponentsToDoc = chkAppendComponents.checked;
    saveSettings();
  });
  chkShowHud.addEventListener('change', () => {
    settings.showFloatingHud = chkShowHud.checked;
    saveSettings();
  });
  selMode1Style.addEventListener('change', () => {
    settings.mode1Style = selMode1Style.value;
    saveSettings();
  });
  selComponentsFormat.addEventListener('change', () => {
    settings.componentsFormat = selComponentsFormat.value;
    saveSettings();
  });

  function saveDocMeta() {
    chrome.storage.local.set({ docMeta });
    updateRequestMetaSummary();
    renderDocPreview();
  }

  function updateRequestMetaSummary() {
    if (!requestMetaSummary) return;
    const parts = [];
    if (docMeta.cycleName) parts.push(docMeta.cycleName);
    if (docMeta.requesterName) parts.push(`Req: ${docMeta.requesterName}`);
    if (docMeta.developerName) parts.push(`Dev: ${docMeta.developerName}`);
    requestMetaSummary.textContent = parts.length > 0 ? `(${parts.join(' | ')})` : '';
  }

  inputDocTitle.addEventListener('input', () => {
    docMeta.title = inputDocTitle.value;
    saveDocMeta();
  });
  inputTicketId.addEventListener('input', () => {
    docMeta.ticketId = inputTicketId.value;
    saveDocMeta();
  });
  selEnvironment.addEventListener('change', () => {
    docMeta.environment = selEnvironment.value;
    saveDocMeta();
  });

  if (inputCycleName) {
    inputCycleName.addEventListener('input', () => {
      docMeta.cycleName = inputCycleName.value;
      saveDocMeta();
    });
  }
  if (inputRequesterName) {
    inputRequesterName.addEventListener('input', () => {
      docMeta.requesterName = inputRequesterName.value;
      saveDocMeta();
    });
  }
  if (inputDeveloperName) {
    inputDeveloperName.addEventListener('input', () => {
      docMeta.developerName = inputDeveloperName.value;
      saveDocMeta();
    });
  }
  if (textareaOriginalRequest) {
    textareaOriginalRequest.addEventListener('input', () => {
      docMeta.originalRequest = textareaOriginalRequest.value;
      textareaOriginalRequest.rows = Math.max(
        2,
        Math.min(6, (textareaOriginalRequest.value || '').split('\n').length)
      );
      saveDocMeta();
    });
  }

  function syncSettingsUi() {
    btnToggleRecord.classList.toggle('active', settings.isRecording);
    recordStatusText.textContent = settings.isRecording ? 'Active' : 'Paused';
    chkAutoGoTo.checked = Boolean(settings.autoGoToPrefix);
    chkPassClick.checked = Boolean(settings.passClickThrough);
    chkIncludeApiNames.checked = Boolean(settings.includeApiNames);
    chkHighlightScreenshot.checked = Boolean(settings.highlightOnScreenshot);
    chkAppendComponents.checked = settings.appendComponentsToDoc !== false;
    chkShowHud.checked = Boolean(settings.showFloatingHud);
    selMode1Style.value = settings.mode1Style || 'blank_line';
    selComponentsFormat.value = settings.componentsFormat || 'text';
    applyFontScale(settings.fontScale || 'font-compact');

    if (shortcutsPanelBody && caretShortcuts) {
      shortcutsPanelBody.classList.toggle('collapsed', Boolean(settings.shortcutsPanelCollapsed));
      updateSectionCaret(shortcutsPanelBody, caretShortcuts);
    }
    if (detailsKeymapBar) {
      detailsKeymapBar.open = !settings.keymapBarCollapsed;
    }
    if (requestMetaPanelBody && caretRequestMeta) {
      requestMetaPanelBody.classList.toggle('collapsed', Boolean(settings.requestMetaCollapsed));
      updateSectionCaret(requestMetaPanelBody, caretRequestMeta);
    }
  }

  function syncMetaUi() {
    if (docMeta.title) inputDocTitle.value = docMeta.title;
    if (docMeta.ticketId !== undefined) inputTicketId.value = docMeta.ticketId || '';
    if (docMeta.environment) selEnvironment.value = docMeta.environment;
    if (inputCycleName) inputCycleName.value = docMeta.cycleName || '';
    if (inputRequesterName) inputRequesterName.value = docMeta.requesterName || '';
    if (inputDeveloperName) inputDeveloperName.value = docMeta.developerName || '';
    if (textareaOriginalRequest) {
      textareaOriginalRequest.value = docMeta.originalRequest || '';
      textareaOriginalRequest.rows = Math.max(
        2,
        Math.min(6, (textareaOriginalRequest.value || '').split('\n').length)
      );
    }
    updateRequestMetaSummary();
  }

  function saveSettings() {
    chrome.storage.local.set({ settings });
  }
  function saveSteps() {
    localStepsSavePending++;
    chrome.storage.local.set({ docSteps }, () => {
      setTimeout(() => {
        localStepsSavePending = Math.max(0, localStepsSavePending - 1);
      }, 120);
    });
    renderDocPreview();
  }
  function saveComponents() {
    localCompsSavePending++;
    chrome.storage.local.set({ affectedComponents }, () => {
      setTimeout(() => {
        localCompsSavePending = Math.max(0, localCompsSavePending - 1);
      }, 120);
    });
    renderDocPreview();
  }

  // Steps Toolbar Actions
  btnAddTextStep.addEventListener('click', () => {
    docSteps.push({
      id: 'step_' + Date.now(),
      type: 'text',
      text: '',
      timestamp: new Date().toISOString()
    });
    saveSteps();
    renderSteps(true);
  });

  btnTakeScreenshotNow.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'MANUAL_CAPTURE_SCREENSHOT' }, (res) => {
      if (!res || !res.success) {
        alert('Screenshot error: ' + (res?.error || 'Unknown error'));
      }
    });
  });

  btnUndoLast.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'UNDO_LAST_SEGMENT' });
  });

  btnOpenMockPage.addEventListener('click', () => {
    const mockUrl = chrome.runtime.getURL('test-veeva-mock.html');
    chrome.tabs.create({ url: mockUrl });
  });

  btnClearAll.addEventListener('click', () => {
    if (docSteps.length === 0) return;
    if (confirm('Are you sure you want to clear all recorded steps and screenshots?')) {
      docSteps = [];
      saveSteps();
      renderSteps();
    }
  });

  function resetAllData() {
    const hasAnyData =
      docSteps.length > 0 ||
      affectedComponents.length > 0 ||
      Boolean(docMeta.cycleName) ||
      Boolean(docMeta.requesterName) ||
      Boolean(docMeta.developerName) ||
      Boolean(docMeta.originalRequest) ||
      Boolean(docMeta.ticketId) ||
      (docMeta.title && docMeta.title !== 'Veeva Vault RIM Configuration Steps') ||
      Boolean(inputCompSearch && inputCompSearch.value);

    if (!hasAnyData) {
      return;
    }

    if (
      !confirm(
        'Are you sure you want to reset and clear ALL recorded steps, screenshots, components, and entered fields?'
      )
    ) {
      return;
    }

    docSteps = [];
    affectedComponents = [];
    docMeta = {
      title: 'Veeva Vault RIM Configuration Steps',
      ticketId: '',
      environment: 'Sandbox',
      cycleName: '',
      requesterName: '',
      developerName: '',
      originalRequest: ''
    };

    if (inputCompSearch) inputCompSearch.value = '';
    if (compQueryFeedback) compQueryFeedback.textContent = '';

    syncModeFromPanel(null, false);
    chrome.storage.local.set({
      docSteps: [],
      affectedComponents: [],
      docMeta
    });

    syncMetaUi();
    renderSteps();
    renderComponents();
    renderDocPreview();
    updateVqlBox();
  }

  if (btnResetEverythingHeader) {
    btnResetEverythingHeader.addEventListener('click', resetAllData);
  }
  if (btnResetEverythingFooter) {
    btnResetEverythingFooter.addEventListener('click', resetAllData);
  }

  btnLoadSample.addEventListener('click', () => {
    if (!docMeta.cycleName) docMeta.cycleName = '2026 R2 - Cycle 3';
    if (!docMeta.requesterName) docMeta.requesterName = 'Jane Doe (Regulatory Operations)';
    if (!docMeta.developerName) docMeta.developerName = 'John Smith (Vault RIM Admin)';
    if (!docMeta.originalRequest) {
      docMeta.originalRequest =
        'Add 4 new Document Types next to Comparison Table (comparison_table__c), assign the Additional Information (additional_information__c) shared field to all 4 Document Types, and remove "Commitment Status" from the Commitment Detail Page Layout.';
    }
    syncMetaUi();
    saveDocMeta();
    const sampleImg1 = createSampleMockScreenshot(
      'Admin > Configuration > Document Types > Regulatory > Administrative Information',
      [
        'Drug Substance Specification Comparison',
        'Drug Substance Batch Analysis Comparison',
        'Drug Product Specification Comparison',
        'Drug Product Batch Analysis Comparison'
      ]
    );
    const sampleImg2 = createSampleMockScreenshot(
      'Admin > Configuration > Document Fields > Shared Field',
      ['Additional Information (additional_information__c) added to 4 Document Types']
    );
    const sampleImg3 = createSampleMockScreenshot(
      'Admin > Configuration > Objects > Commitment > Layouts',
      ['Commitment Detail Page Layout > Details section > Removed "Commitment Status" > Saved']
    );

    docSteps = [
      {
        id: 'sample_1',
        type: 'text',
        text:
          'Go to Admin > Configuration > Document Types > Regulatory > Administrative Information > Click the action menu next to Comparison Table (comparison_table__c) > Add Sibling > Add the following Document Types:\n' +
          '   > Drug Substance Specification Comparison\n' +
          '   > Drug Substance Batch Analysis Comparison\n' +
          '   > Drug Product Specification Comparison\n' +
          '   > Drug Product Batch Analysis Comparison',
        timestamp: new Date().toISOString()
      },
      {
        id: 'sample_img_1',
        type: 'image',
        imageDataUrl: sampleImg1,
        caption: '',
        timestamp: new Date().toISOString()
      },
      {
        id: 'sample_2',
        type: 'text',
        text:
          'Go to Admin > Configuration > Document Fields > Regulatory > Administrative Information > On all four Document Types created in the previous step > Add > Existing Shared Field > Additional Information (additional_information__c)',
        timestamp: new Date().toISOString()
      },
      {
        id: 'sample_img_2',
        type: 'image',
        imageDataUrl: sampleImg2,
        caption: '',
        timestamp: new Date().toISOString()
      },
      {
        id: 'sample_3',
        type: 'text',
        text:
          'Go to Admin > Configuration > Objects > Commitment > Layouts > Commitment Detail Page Layout > Details section > Remove “Commitment Status” > Save',
        timestamp: new Date().toISOString()
      },
      {
        id: 'sample_img_3',
        type: 'image',
        imageDataUrl: sampleImg3,
        caption: '',
        timestamp: new Date().toISOString()
      }
    ];

    loadSampleComponentsList();
    saveSteps();
    renderSteps(true);
    updateVqlBox();
  });

  function loadSampleComponentsList() {
    affectedComponents = [
      {
        id: 'comp_sample_1',
        name: '(Inactive) Dienog tb 2 mg MRP KZ-EAEU KZ -',
        componentName: 'inactive_dienog_tb_2_mg_mrp_kzeaeu_kz__c',
        componentType: 'Report',
        modifiedDate: '2026-08-08 3:07 AM - 2026-01-20 3:08 PM'
      },
      {
        id: 'comp_sample_2',
        name: '(Inactive) Dienog tb 2 mg MRP KZ-EAEU KZ -',
        componentName: 'inactive_dienog_tb_2_mg_mrp_kzeaeu_k1__c',
        componentType: 'Report',
        modifiedDate: '2026-08-08 3:21 AM - 2026-01-20 3:08 PM'
      },
      {
        id: 'comp_sample_3',
        name: 'Comparison Table',
        componentName: 'comparison_table__c',
        componentType: 'Doctype',
        modifiedDate: '2026-08-08 3:25 AM - 2026-01-15 10:12 AM'
      },
      {
        id: 'comp_sample_4',
        name: 'Additional Information',
        componentName: 'additional_information__c',
        componentType: 'Docfield',
        modifiedDate: '2026-08-08 3:28 AM - 2026-01-10 09:00 AM'
      }
    ];
    saveComponents();
    renderComponents();
  }

  btnLoadSampleComponents.addEventListener('click', () => {
    loadSampleComponentsList();
    updateVqlBox();
  });

  if (btnToggleAllCards) {
    btnToggleAllCards.addEventListener('click', () => {
      if (!docSteps.length) return;
      const allCollapsed = docSteps.every((s) => s.collapsed);
      docSteps.forEach((s) => {
        s.collapsed = !allCollapsed;
      });
      btnToggleAllCards.textContent = !allCollapsed ? 'Expand All' : 'Collapse All';
      saveSteps();
      renderSteps();
    });
  }

  if (btnToggleAllComps) {
    btnToggleAllComps.addEventListener('click', () => {
      if (!affectedComponents.length) return;
      const allCollapsed = affectedComponents.every((c) => c.collapsed);
      affectedComponents.forEach((c) => {
        c.collapsed = !allCollapsed;
      });
      btnToggleAllComps.textContent = !allCollapsed ? 'Expand All' : 'Collapse All';
      saveComponents();
      renderComponents();
    });
  }

  // Render Steps List
  function renderSteps(scrollToBottom = false) {
    countSteps.textContent = docSteps.length;
    stepsContainer.innerHTML = '';

    if (!docSteps || docSteps.length === 0) {
      stepsContainer.innerHTML = `
        <div class="empty-state">
          <h3>No configuration steps recorded yet</h3>
          <p>
            Open Veeva Vault (or click the <strong>Test Page</strong> button above) and click on elements:<br/><br/>
            &bull; <strong>0 + Left Click</strong>: Append element label with <code>&nbsp;&gt;&nbsp;</code><br/>
            &bull; <strong>1 + Left Click</strong>: Start a new line (skipping 1 blank line)<br/>
            &bull; <strong>2 + Left Click</strong>: Capture &amp; insert screenshot<br/>
            &bull; <strong>3 + Left Click</strong>: Indented sub-item (<code>&nbsp;&nbsp;&nbsp;&gt;&nbsp;</code>) on a new line<br/>
            &bull; <strong>4 + Left Click</strong>: Add affected component to the <code>Components</code> list
          </p>
        </div>
      `;
      return;
    }

    if (btnToggleAllCards) {
      const allCollapsed = docSteps.every((s) => s.collapsed);
      btnToggleAllCards.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
    }

    const isLastStepText = docSteps[docSteps.length - 1]?.type === 'text';

    docSteps.forEach((step, idx) => {
      if (!step.id) {
        step.id = 'step_' + idx + '_' + Date.now();
      }
      const isActiveTarget = idx === docSteps.length - 1 && isLastStepText;
      const isMaximized = maximizedStepId === step.id;
      const isCollapsed = isMaximized ? false : Boolean(step.collapsed);
      const card = document.createElement('div');
      card.className = `step-card ${step.type === 'image' ? 'image-step' : 'text-step'}${
        isActiveTarget ? ' active-target' : ''
      }${isCollapsed ? ' collapsed' : ''}${isMaximized ? ' maximized-step' : ''}`;

      const header = document.createElement('div');
      header.className = 'step-header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'step-title-clickable';
      titleWrap.title = isMaximized
        ? 'Click Restore to exit fullscreen'
        : 'Click to collapse / expand step';

      const caret = document.createElement('span');
      caret.className = 'vv-caret';
      caret.textContent = isCollapsed ? '▸' : '▾';

      const badge = document.createElement('span');
      badge.className = 'step-badge';
      badge.textContent =
        step.type === 'image'
          ? `#${idx + 1} SCREENSHOT`
          : `#${idx + 1} STEP`;

      titleWrap.append(caret, badge);

      if (isActiveTarget) {
        const activePill = document.createElement('span');
        activePill.className = 'active-target-pill';
        activePill.textContent = 'ACTIVE LINE';
        titleWrap.appendChild(activePill);
      }

      const collapsedPreview = document.createElement('span');
      collapsedPreview.className = 'step-collapsed-preview';
      if (step.type === 'text') {
        const firstLine = (step.text || '').replace(/\s+/g, ' ').trim();
        collapsedPreview.textContent = isCollapsed ? firstLine || '(empty step)' : '';
      } else {
        collapsedPreview.textContent = isCollapsed ? step.caption || '[Screenshot]' : '';
      }
      titleWrap.appendChild(collapsedPreview);

      const bodyWrap = document.createElement('div');
      bodyWrap.className = 'step-body';

      titleWrap.addEventListener('click', () => {
        if (maximizedStepId === step.id) return;
        step.collapsed = !step.collapsed;
        const nowCollapsed = Boolean(step.collapsed);
        card.classList.toggle('collapsed', nowCollapsed);
        caret.textContent = nowCollapsed ? '▸' : '▾';
        if (step.type === 'text') {
          const firstLine = (step.text || '').replace(/\s+/g, ' ').trim();
          collapsedPreview.textContent = nowCollapsed ? firstLine || '(empty step)' : '';
        } else {
          collapsedPreview.textContent = nowCollapsed ? step.caption || '[Screenshot]' : '';
        }
        saveSteps();
      });

      const actions = document.createElement('div');
      actions.className = 'step-actions';

      const btnMaximize = document.createElement('button');
      btnMaximize.className = `btn-mini btn-maximize${isMaximized ? ' active-max' : ''}`;
      btnMaximize.textContent = isMaximized ? '↙ Restore' : '⛶ Fullscreen';
      btnMaximize.title = isMaximized
        ? 'Restore step to normal view (Esc)'
        : 'Expand step to fill the entire screen';
      btnMaximize.addEventListener('click', (e) => {
        e.stopPropagation();
        if (maximizedStepId === step.id) {
          maximizedStepId = null;
        } else {
          maximizedStepId = step.id;
          step.collapsed = false;
        }
        renderSteps();
      });
      actions.appendChild(btnMaximize);

      if (step.type === 'image') {
        const btnEditImg = document.createElement('button');
        btnEditImg.className = 'btn-mini';
        btnEditImg.textContent = 'Annotate';
        btnEditImg.addEventListener('click', () => openAnnotatorModal(idx));
        actions.appendChild(btnEditImg);
      } else {
        const btnInsertShotBelow = document.createElement('button');
        btnInsertShotBelow.className = 'btn-mini';
        btnInsertShotBelow.textContent = '+Shot Below';
        btnInsertShotBelow.title = 'Capture screenshot and insert directly below this step';
        btnInsertShotBelow.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'INSERT_SCREENSHOT_AT', index: idx });
        });
        actions.appendChild(btnInsertShotBelow);
      }

      const btnUp = document.createElement('button');
      btnUp.className = 'btn-mini';
      btnUp.textContent = '↑';
      btnUp.title = 'Move Up';
      btnUp.disabled = idx === 0;
      btnUp.addEventListener('click', () => moveStep(idx, -1));

      const btnDown = document.createElement('button');
      btnDown.className = 'btn-mini';
      btnDown.textContent = '↓';
      btnDown.title = 'Move Down';
      btnDown.disabled = idx === docSteps.length - 1;
      btnDown.addEventListener('click', () => moveStep(idx, 1));

      const btnDel = document.createElement('button');
      btnDel.className = 'btn-mini delete';
      btnDel.textContent = '×';
      btnDel.title = 'Delete Step';
      btnDel.addEventListener('click', () => deleteStep(idx));

      actions.append(btnUp, btnDown, btnDel);
      header.append(titleWrap, actions);
      card.appendChild(header);

      if (step.type === 'text') {
        const textarea = document.createElement('textarea');
        textarea.className = 'step-textarea';
        textarea.value = step.text || '';
        textarea.placeholder = 'Click with 0+Click in Veeva Vault or type directly here...';
        const lineCount = (step.text || '').split('\n').length;
        textarea.rows = Math.max(isActiveTarget ? 4 : 3, Math.min(12, lineCount));

        if (!isMaximized && step.customHeight) {
          textarea.style.height = step.customHeight;
        }

        // Stop key events from bubbling to any global shortcut listeners while typing
        textarea.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape' && maximizedStepId === step.id) {
            ev.preventDefault();
            maximizedStepId = null;
            renderSteps();
            return;
          }
          ev.stopPropagation();
        });

        textarea.addEventListener('keyup', (ev) => {
          ev.stopPropagation();
        });

        textarea.addEventListener('input', () => {
          docSteps[idx].text = textarea.value;
          if (!isMaximized && !docSteps[idx].customHeight) {
            if (textarea.scrollHeight > textarea.clientHeight) {
              textarea.style.height = textarea.scrollHeight + 'px';
            }
          }
          saveSteps();
        });

        // Persist user's manual drag-resize height so it never snaps back
        textarea.addEventListener('mouseup', () => {
          if (!isMaximized && textarea.style.height) {
            docSteps[idx].customHeight = textarea.style.height;
            saveSteps();
          }
        });

        const quickRow = document.createElement('div');
        quickRow.className = 'step-quick-inserts';

        const snippets = [
          { label: '+ " > "', text: ' > ' },
          { label: '+ Sub-item (   > )', text: '\n   > ' },
          { label: '+ Add the following:', text: ' > Add the following:\n   > ' },
          { label: '+ Action menu', text: ' > Click the action menu next to ' },
          { label: '+ Save', text: ' > Save' }
        ];

        snippets.forEach((s) => {
          const b = document.createElement('button');
          b.textContent = s.label;
          b.addEventListener('click', () => appendTextToStep(idx, textarea, s.text));
          quickRow.appendChild(b);
        });

        // Per-card undo last segment button
        const btnStripLast = document.createElement('button');
        btnStripLast.textContent = 'Remove last >';
        btnStripLast.style.marginLeft = 'auto';
        btnStripLast.addEventListener('click', () => {
          const t = docSteps[idx].text || '';
          if (t.includes('\n   > ')) {
            docSteps[idx].text = t.slice(0, t.lastIndexOf('\n   > '));
          } else if (t.includes(' > ')) {
            docSteps[idx].text = t.slice(0, t.lastIndexOf(' > '));
          }
          textarea.value = docSteps[idx].text;
          saveSteps();
        });
        quickRow.appendChild(btnStripLast);

        bodyWrap.append(textarea, quickRow);

        if (isMaximized) {
          setTimeout(() => textarea.focus(), 20);
        }
      } else if (step.type === 'image') {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'screenshot-preview-wrap';

        const img = document.createElement('img');
        img.src = step.imageDataUrl;
        img.alt = 'Veeva Vault Screenshot';
        img.title = 'Click to view full size';
        img.addEventListener('click', () => {
          const w = window.open();
          if (w) {
            w.document.write(
              `<body style="margin:0;background:#2b3643;display:flex;justify-content:center;align-items:center;"><img src="${step.imageDataUrl}" style="max-width:100%;"/></body>`
            );
          }
        });

        imgWrap.appendChild(img);

        const captionInput = document.createElement('input');
        captionInput.type = 'text';
        captionInput.placeholder = 'Optional caption below screenshot...';
        captionInput.value = step.caption || '';
        captionInput.addEventListener('input', () => {
          docSteps[idx].caption = captionInput.value;
          saveSteps();
        });

        bodyWrap.append(imgWrap, captionInput);
      }

      card.appendChild(bodyWrap);
      stepsContainer.appendChild(card);
    });

    if (scrollToBottom) {
      stepsContainer.scrollTop = stepsContainer.scrollHeight;
    }
  }

  // Render Live Document Preview (Word-like continuous view)
  function renderDocPreview() {
    if (!docPreviewContainer) return;
    docPreviewContainer.innerHTML = '';

    const hasHeaderData =
      Boolean(docMeta.cycleName) ||
      Boolean(docMeta.requesterName) ||
      Boolean(docMeta.developerName) ||
      Boolean(docMeta.originalRequest);

    if (docSteps.length === 0 && affectedComponents.length === 0 && !hasHeaderData) {
      docPreviewContainer.innerHTML =
        '<div style="color:#5e6c84;text-align:center;padding:20px;">No content to preview yet.</div>';
      return;
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'prev-doc-title';
    titleEl.textContent = docMeta.title || 'Veeva Vault RIM Configuration Steps';
    docPreviewContainer.appendChild(titleEl);

    const metaTable = document.createElement('table');
    metaTable.className = 'prev-meta-table';

    const envDateParts = [];
    if (docMeta.ticketId) envDateParts.push(`Ticket: ${docMeta.ticketId}`);
    if (docMeta.environment) envDateParts.push(`Env: ${docMeta.environment}`);
    envDateParts.push(`Date: ${new Date().toLocaleDateString()}`);

    const metaRows = [
      ['Cycle / Release:', docMeta.cycleName || '-'],
      ['Requester:', docMeta.requesterName || '-'],
      ['Developer:', docMeta.developerName || vaultSession.userName || '-'],
      ['Environment / Date:', envDateParts.join('  |  ')]
    ];

    metaRows.forEach(([lbl, val]) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = lbl;
      const td = document.createElement('td');
      td.textContent = val;
      tr.append(th, td);
      metaTable.appendChild(tr);
    });
    docPreviewContainer.appendChild(metaTable);

    if (docMeta.originalRequest && docMeta.originalRequest.trim()) {
      const reqTitle = document.createElement('div');
      reqTitle.className = 'prev-request-title';
      reqTitle.textContent = 'Original Request:';
      const reqBox = document.createElement('div');
      reqBox.className = 'prev-request-box';
      reqBox.textContent = docMeta.originalRequest.trim();
      docPreviewContainer.append(reqTitle, reqBox);
    }

    const stepsTitle = document.createElement('div');
    stepsTitle.className = 'prev-section-title';
    stepsTitle.textContent = 'Configuration Steps:';
    docPreviewContainer.appendChild(stepsTitle);

    docSteps.forEach((step) => {
      if (step.type === 'text' && step.text) {
        const p = document.createElement('div');
        p.className = 'prev-step';
        p.textContent = step.text;
        docPreviewContainer.appendChild(p);
      } else if (step.type === 'image' && step.imageDataUrl) {
        const img = document.createElement('img');
        img.className = 'prev-img';
        img.src = step.imageDataUrl;
        docPreviewContainer.appendChild(img);
      }
    });

    if (settings.appendComponentsToDoc !== false && affectedComponents.length > 0) {
      const compDiv = document.createElement('div');
      compDiv.className = 'prev-components';
      compDiv.textContent = formatComponentsAsPlainText(affectedComponents);
      docPreviewContainer.appendChild(compDiv);
    }
  }

  function appendTextToStep(idx, textarea, snippet) {
    docSteps[idx].text = (docSteps[idx].text || '') + snippet;
    textarea.value = docSteps[idx].text;
    if (maximizedStepId !== docSteps[idx].id && !docSteps[idx].customHeight) {
      if (textarea.scrollHeight > textarea.clientHeight) {
        textarea.style.height = textarea.scrollHeight + 'px';
      }
    }
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    saveSteps();
  }

  function moveStep(idx, dir) {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= docSteps.length) return;
    const temp = docSteps[idx];
    docSteps[idx] = docSteps[targetIdx];
    docSteps[targetIdx] = temp;
    saveSteps();
    renderSteps();
  }

  function deleteStep(idx) {
    if (docSteps[idx] && docSteps[idx].id === maximizedStepId) {
      maximizedStepId = null;
    }
    docSteps.splice(idx, 1);
    saveSteps();
    renderSteps();
  }

  // Affected Components Logic
  btnQueryComponents.addEventListener('click', () => {
    const mode = selCompQueryMode.value;
    const kw = inputCompSearch.value.trim();

    compQueryFeedback.textContent = 'Running read-only query against Veeva Vault...';
    compQueryFeedback.style.color = '#1a73e8';

    if (mode === 'dom_scan') {
      chrome.runtime.sendMessage({ type: 'SCAN_DOM_COMPONENTS' }, (res) => {
        if (res && res.success) {
          affectedComponents = res.components || affectedComponents;
          renderComponents();
          compQueryFeedback.textContent = `${res.addedCount || 0} component(s) scanned from the active page.`;
          compQueryFeedback.style.color = '#2e7d32';
        } else {
          compQueryFeedback.textContent = 'No component table found on the active page.';
          compQueryFeedback.style.color = '#e07f0b';
        }
      });
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: 'QUERY_VAULT_COMPONENTS',
        options: {
          filterMode: mode,
          searchKeyword: kw
        }
      },
      (res) => {
        if (res && res.success) {
          affectedComponents = res.components || affectedComponents;
          renderComponents();
          compQueryFeedback.textContent = res.message || 'Query completed.';
          compQueryFeedback.style.color = '#2e7d32';
        } else {
          compQueryFeedback.textContent = res?.error || 'Query error.';
          compQueryFeedback.style.color = '#c62828';
        }
      }
    );
  });

  btnAddComponentManual.addEventListener('click', () => {
    const nowFormatted = formatVeevaDateNow();
    affectedComponents.push({
      id: 'comp_' + Date.now(),
      name: '',
      componentName: '',
      componentType: 'Report',
      modifiedDate: `${nowFormatted} - ${nowFormatted}`
    });
    saveComponents();
    renderComponents();
  });

  btnClearComponents.addEventListener('click', () => {
    if (!affectedComponents.length) return;
    if (confirm('Are you sure you want to clear all recorded components?')) {
      affectedComponents = [];
      saveComponents();
      renderComponents();
    }
  });

  btnCopyComponentsBlock.addEventListener('click', async () => {
    const text = formatComponentsAsPlainText(affectedComponents);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    const orig = btnCopyComponentsBlock.textContent;
    btnCopyComponentsBlock.textContent = 'Copied';
    setTimeout(() => {
      btnCopyComponentsBlock.textContent = orig;
    }, 1500);
  });

  function renderComponents() {
    countComponents.textContent = affectedComponents.length;
    componentsContainer.innerHTML = '';

    if (!affectedComponents || affectedComponents.length === 0) {
      componentsContainer.innerHTML = `
        <div class="empty-state">
          <h3>No affected components in the list yet</h3>
          <p>
            &bull; Click the <strong>Query</strong> button above to run a Read-Only <code>vault_component__v</code> query,<br/>
            &bull; Or hold <strong>4 + Left Click</strong> on any component row in Veeva Vault,<br/>
            &bull; Or click the <strong>Sample</strong> button!
          </p>
        </div>
      `;
      return;
    }

    if (btnToggleAllComps) {
      const allCollapsed = affectedComponents.every((c) => c.collapsed);
      btnToggleAllComps.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
    }

    affectedComponents.forEach((comp, idx) => {
      const isCollapsed = Boolean(comp.collapsed);
      const card = document.createElement('div');
      card.className = `step-card component-card${isCollapsed ? ' collapsed' : ''}`;

      const header = document.createElement('div');
      header.className = 'step-header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'step-title-clickable';
      titleWrap.title = 'Click to collapse / expand component';

      const caret = document.createElement('span');
      caret.className = 'vv-caret';
      caret.textContent = isCollapsed ? '▸' : '▾';

      const badge = document.createElement('span');
      badge.className = 'step-badge';
      badge.textContent = `#${idx + 1} ${comp.componentType || 'Component'}`;

      const collapsedPreview = document.createElement('span');
      collapsedPreview.className = 'step-collapsed-preview';
      collapsedPreview.textContent = isCollapsed
        ? `${comp.name || ''} (${comp.componentName || ''})`
        : '';

      titleWrap.append(caret, badge, collapsedPreview);

      titleWrap.addEventListener('click', () => {
        comp.collapsed = !comp.collapsed;
        const nowCollapsed = Boolean(comp.collapsed);
        card.classList.toggle('collapsed', nowCollapsed);
        caret.textContent = nowCollapsed ? '▸' : '▾';
        collapsedPreview.textContent = nowCollapsed
          ? `${comp.name || ''} (${comp.componentName || ''})`
          : '';
        saveComponents();
      });

      const btnDel = document.createElement('button');
      btnDel.className = 'btn-mini delete';
      btnDel.textContent = '×';
      btnDel.title = 'Delete Component';
      btnDel.addEventListener('click', () => {
        affectedComponents.splice(idx, 1);
        saveComponents();
        renderComponents();
      });

      header.append(titleWrap, btnDel);

      const bodyWrap = document.createElement('div');
      bodyWrap.className = 'step-body';

      const grid = document.createElement('div');
      grid.className = 'comp-grid';

      const fields = [
        { key: 'name', label: 'Name:', placeholder: '(Inactive) Dienog tb 2 mg...' },
        {
          key: 'componentName',
          label: 'Component Name:',
          placeholder: 'inactive_dienog_tb_2_mg_mrp_kzeaeu_kz__c'
        },
        { key: 'componentType', label: 'Component Type :', placeholder: 'Report / Doctype / Docfield' },
        {
          key: 'modifiedDate',
          label: 'Modified Date :',
          placeholder: '2026-08-08 3:07 AM - 2026-01-20 3:08 PM'
        }
      ];

      fields.forEach((f) => {
        const lbl = document.createElement('label');
        lbl.textContent = f.label;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = comp[f.key] || '';
        inp.placeholder = f.placeholder;
        inp.addEventListener('input', () => {
          affectedComponents[idx][f.key] = inp.value;
          if (f.key === 'componentType') {
            badge.textContent = `#${idx + 1} ${inp.value || 'Component'}`;
          }
          saveComponents();
        });
        grid.append(lbl, inp);
      });

      bodyWrap.appendChild(grid);
      card.append(header, bodyWrap);
      componentsContainer.appendChild(card);
    });
  }

  function formatComponentsAsPlainText(comps) {
    if (!Array.isArray(comps) || comps.length === 0) return '';
    const blocks = comps.map((c) => {
      return [
        `Name: ${c.name || ''}`,
        `Component Name: ${c.componentName || ''}`,
        `Component Type : ${c.componentType || ''}`,
        ` Modified Date : ${c.modifiedDate || ''}`
      ].join('\n');
    });
    return `Components  :\n${blocks.join('\n\n')}`;
  }

  function formatVeevaDateNow() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    let hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${yyyy}-${mm}-${dd} ${hours}:${mins} ${ampm}`;
  }

  // VQL & Admin Tools
  function updateVqlBox() {
    const names = new Set();
    affectedComponents.forEach((c) => {
      if (c.componentName && c.componentName !== 'n/a') names.add(c.componentName.trim());
    });
    docSteps.forEach((s) => {
      if (s.type === 'text' && s.text) {
        const m = s.text.match(/\b([a-z][a-z0-9_]*__(?:c|v|sys|cda|rim))\b/gi);
        if (m) m.forEach((item) => names.add(item.toLowerCase()));
      }
    });

    const arr = Array.from(names);
    if (arr.length > 0) {
      const listStr = arr.map((n) => `'${n}'`).join(', ');
      textareaVqlOutput.value = `SELECT id, label__v, component_name__v, component_type__v, modified_date__v, created_date__v\nFROM vault_component__v\nWHERE component_name__v CONTAINS (${listStr})`;
    } else {
      textareaVqlOutput.value = `SELECT id, label__v, component_name__v, component_type__v, modified_date__v, created_date__v\nFROM vault_component__v\nORDER BY modified_date__v DESC MAXROWS 50`;
    }
  }

  btnGenerateVql.addEventListener('click', updateVqlBox);

  btnCopyVql.addEventListener('click', async () => {
    updateVqlBox();
    await navigator.clipboard.writeText(textareaVqlOutput.value);
    btnCopyVql.textContent = 'Copied';
    setTimeout(() => {
      btnCopyVql.textContent = 'Copy VQL';
    }, 1500);
  });

  btnCopyConfluence.addEventListener('click', async () => {
    let md = `## ${docMeta.title || 'Veeva Vault RIM Configuration Steps'}\n\n`;
    md += `| Field | Value |\n| :--- | :--- |\n`;
    md += `| **Cycle / Release** | ${docMeta.cycleName || '-'} |\n`;
    md += `| **Requester** | ${docMeta.requesterName || '-'} |\n`;
    md += `| **Developer** | ${docMeta.developerName || vaultSession.userName || '-'} |\n`;
    if (docMeta.ticketId) md += `| **Ticket** | ${docMeta.ticketId} |\n`;
    md += `| **Environment / Date** | ${docMeta.environment} (${new Date().toISOString().slice(0, 10)}) |\n\n`;

    if (docMeta.originalRequest && docMeta.originalRequest.trim()) {
      md += `### Original Request\n\n> ${docMeta.originalRequest.trim().replace(/\n/g, '\n> ')}\n\n`;
    }

    md += `### Configuration Steps\n\n`;

    docSteps.forEach((s, i) => {
      if (s.type === 'text') {
        md += `${i + 1}. \`${s.text.replace(/\n/g, '`\n   `')}\`\n\n`;
      } else {
        md += `   *(+ Screenshot #${i + 1})*\n\n`;
      }
    });

    if (affectedComponents.length > 0) {
      md += `### Affected Components\n\n| Name | Component Name | Component Type | Modified Date |\n| :--- | :--- | :--- | :--- |\n`;
      affectedComponents.forEach((c) => {
        md += `| ${c.name} | \`${c.componentName}\` | ${c.componentType} | ${c.modifiedDate} |\n`;
      });
    }

    await navigator.clipboard.writeText(md);
    btnCopyConfluence.textContent = 'Copied';
    setTimeout(() => {
      btnCopyConfluence.textContent = 'Copy Confluence / Jira Table';
    }, 1500);
  });

  btnExportJson.addEventListener('click', () => {
    const payload = {
      version: '1.2',
      exportedAt: new Date().toISOString(),
      docMeta,
      docSteps,
      affectedComponents
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Veeva_RIM_Project_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  });

  btnImportJson.addEventListener('click', () => fileInputJson.click());

  fileInputJson.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (Array.isArray(parsed.docSteps)) docSteps = parsed.docSteps;
        if (Array.isArray(parsed.affectedComponents))
          affectedComponents = parsed.affectedComponents;
        if (parsed.docMeta) docMeta = { ...docMeta, ...parsed.docMeta };
        saveSteps();
        saveComponents();
        chrome.storage.local.set({ docMeta });
        syncMetaUi();
        renderSteps();
        renderComponents();
        updateVqlBox();
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Screenshot Annotator Modal
  let editingStepIdx = null;
  let currentAnnTool = 'rect';
  let annHistory = [];
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let badgeCounter = 1;
  let baseImgObj = null;

  document.querySelectorAll('.ann-tool').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ann-tool').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentAnnTool = btn.getAttribute('data-tool');
    });
  });

  function openAnnotatorModal(stepIdx) {
    const step = docSteps[stepIdx];
    if (!step || step.type !== 'image') return;
    editingStepIdx = stepIdx;
    annHistory = [];
    badgeCounter = 1;

    baseImgObj = new Image();
    baseImgObj.onload = () => {
      annotatorCanvas.width = baseImgObj.width;
      annotatorCanvas.height = baseImgObj.height;
      redrawAnnotatorCanvas();
      annotatorModal.style.display = 'flex';
    };
    baseImgObj.src = step.imageDataUrl;
  }

  function redrawAnnotatorCanvas() {
    const ctx = annotatorCanvas.getContext('2d');
    ctx.clearRect(0, 0, annotatorCanvas.width, annotatorCanvas.height);
    if (baseImgObj) {
      ctx.drawImage(baseImgObj, 0, 0);
    }
    annHistory.forEach((shape) => drawShapeOnContext(ctx, shape));
  }

  function drawShapeOnContext(ctx, s) {
    ctx.save();
    if (s.type === 'rect') {
      ctx.strokeStyle = '#c62828';
      ctx.lineWidth = 3;
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.type === 'redact') {
      ctx.fillStyle = '#2b3643';
      ctx.fillRect(s.x, s.y, s.w, s.h);
    } else if (s.type === 'arrow') {
      ctx.strokeStyle = '#c62828';
      ctx.fillStyle = '#c62828';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();

      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const headLen = 14;
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(
        s.x2 - headLen * Math.cos(angle - Math.PI / 6),
        s.y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        s.x2 - headLen * Math.cos(angle + Math.PI / 6),
        s.y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    } else if (s.type === 'badge') {
      ctx.fillStyle = '#f7941d';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(s.num), s.x, s.y);
    }
    ctx.restore();
  }

  function getCanvasCoords(e) {
    const rect = annotatorCanvas.getBoundingClientRect();
    const scaleX = annotatorCanvas.width / rect.width;
    const scaleY = annotatorCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  annotatorCanvas.addEventListener('mousedown', (e) => {
    const pt = getCanvasCoords(e);
    if (currentAnnTool === 'badge') {
      annHistory.push({ type: 'badge', x: pt.x, y: pt.y, num: badgeCounter++ });
      redrawAnnotatorCanvas();
      return;
    }
    isDrawing = true;
    startX = pt.x;
    startY = pt.y;
  });

  annotatorCanvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const pt = getCanvasCoords(e);
    redrawAnnotatorCanvas();
    const ctx = annotatorCanvas.getContext('2d');
    if (currentAnnTool === 'rect' || currentAnnTool === 'redact') {
      drawShapeOnContext(ctx, {
        type: currentAnnTool,
        x: startX,
        y: startY,
        w: pt.x - startX,
        h: pt.y - startY
      });
    } else if (currentAnnTool === 'arrow') {
      drawShapeOnContext(ctx, {
        type: 'arrow',
        x1: startX,
        y1: startY,
        x2: pt.x,
        y2: pt.y
      });
    }
  });

  annotatorCanvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const pt = getCanvasCoords(e);
    if (currentAnnTool === 'rect' || currentAnnTool === 'redact') {
      annHistory.push({
        type: currentAnnTool,
        x: startX,
        y: startY,
        w: pt.x - startX,
        h: pt.y - startY
      });
    } else if (currentAnnTool === 'arrow') {
      annHistory.push({
        type: 'arrow',
        x1: startX,
        y1: startY,
        x2: pt.x,
        y2: pt.y
      });
    }
    redrawAnnotatorCanvas();
  });

  btnAnnotatorUndo.addEventListener('click', () => {
    const popped = annHistory.pop();
    if (popped && popped.type === 'badge' && badgeCounter > 1) badgeCounter--;
    redrawAnnotatorCanvas();
  });

  function closeAnnotator() {
    annotatorModal.style.display = 'none';
    editingStepIdx = null;
  }

  btnCloseAnnotator.addEventListener('click', closeAnnotator);
  btnCancelAnnotator.addEventListener('click', closeAnnotator);

  btnSaveAnnotator.addEventListener('click', () => {
    if (editingStepIdx !== null && docSteps[editingStepIdx]) {
      docSteps[editingStepIdx].imageDataUrl = annotatorCanvas.toDataURL('image/png');
      saveSteps();
      renderSteps();
    }
    closeAnnotator();
  });

  // Copy & Export
  function formatHeaderAsPlainText() {
    const headerLines = [];
    if (docMeta.cycleName) headerLines.push(`Cycle / Release: ${docMeta.cycleName}`);
    if (docMeta.requesterName) headerLines.push(`Requester: ${docMeta.requesterName}`);
    if (docMeta.developerName) headerLines.push(`Developer: ${docMeta.developerName}`);
    if (docMeta.ticketId) headerLines.push(`Ticket: ${docMeta.ticketId}`);
    if (docMeta.originalRequest && docMeta.originalRequest.trim()) {
      headerLines.push(`\nOriginal Request:\n${docMeta.originalRequest.trim()}`);
    }
    if (headerLines.length > 0) {
      headerLines.push('------------------------------------------------------------');
    }
    return headerLines.join('\n');
  }

  btnCopyText.addEventListener('click', async () => {
    const headerText = formatHeaderAsPlainText();
    if (!docSteps.length && !affectedComponents.length && !headerText) return;
    const lines = docSteps.map((s) => (s.type === 'image' ? '+screenshot' : s.text));
    let fullText = lines.join('\n\n');

    if (headerText) {
      fullText = fullText ? `${headerText}\n\n${fullText}` : headerText;
    }

    if (settings.appendComponentsToDoc !== false && affectedComponents.length > 0) {
      const compText = formatComponentsAsPlainText(affectedComponents);
      fullText = fullText ? `${fullText}\n\n${compText}` : compText;
    }

    try {
      await navigator.clipboard.writeText(fullText);
      const orig = btnCopyText.textContent;
      btnCopyText.textContent = 'Copied';
      setTimeout(() => {
        btnCopyText.textContent = orig;
      }, 1600);
    } catch (e) {
      alert('Copy error: ' + e.message);
    }
  });

  btnExportDocx.addEventListener('click', () => {
    const hasHeaderData =
      Boolean(docMeta.cycleName) ||
      Boolean(docMeta.requesterName) ||
      Boolean(docMeta.developerName) ||
      Boolean(docMeta.originalRequest);

    if (!docSteps.length && !affectedComponents.length && !hasHeaderData) {
      alert('No steps, components, or header data recorded yet.');
      return;
    }

    try {
      const metadata = {
        title: inputDocTitle.value.trim() || 'Veeva Vault RIM Configuration Steps',
        ticketId: inputTicketId.value.trim(),
        environment: selEnvironment.value,
        cycleName: inputCycleName ? inputCycleName.value.trim() : docMeta.cycleName || '',
        requesterName: inputRequesterName
          ? inputRequesterName.value.trim()
          : docMeta.requesterName || '',
        developerName: inputDeveloperName
          ? inputDeveloperName.value.trim()
          : docMeta.developerName || '',
        originalRequest: textareaOriginalRequest
          ? textareaOriginalRequest.value.trim()
          : docMeta.originalRequest || '',
        vaultDns: vaultSession.vaultDns || '',
        userName: vaultSession.userName || '',
        includeHeader: true,
        appendComponents: settings.appendComponentsToDoc !== false,
        componentsFormat: settings.componentsFormat || 'text'
      };

      const docxBlob = window.VeevaDocxGenerator.generateVeevaDocx(
        docSteps,
        metadata,
        affectedComponents
      );
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      const cycleSlug = metadata.cycleName
        ? `${metadata.cycleName.replace(/[^a-zA-Z0-9_-]/g, '_')}_`
        : '';
      const ticketPrefix = metadata.ticketId ? `${metadata.ticketId}_` : '';
      a.href = url;
      a.download = `${cycleSlug}${ticketPrefix}Veeva_Vault_RIM_Config_${dateStr}.docx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err) {
      console.error('DOCX Export error:', err);
      alert('Error generating Word (.docx) document: ' + err.message);
    }
  });

  function createSampleMockScreenshot(breadcrumb, items) {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f4f5f7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#2b3643';
    ctx.fillRect(0, 0, canvas.width, 42);

    ctx.fillStyle = '#f7941d';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('Vault RIM', 20, 26);

    ctx.fillStyle = '#ffffff';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText('Admin  |  Configuration', 120, 26);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 42, canvas.width, 40);
    ctx.strokeStyle = '#d8dde6';
    ctx.strokeRect(0, 42, canvas.width, 40);

    ctx.fillStyle = '#2b3643';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(breadcrumb, 20, 67);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(20, 100, canvas.width - 40, 250);
    ctx.strokeStyle = '#d8dde6';
    ctx.strokeRect(20, 100, canvas.width - 40, 250);

    ctx.font = '13px Consolas, monospace';
    items.forEach((item, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
      ctx.fillRect(32, 118 + i * 42, canvas.width - 64, 34);
      ctx.fillStyle = '#333333';
      ctx.fillText(item, 44, 140 + i * 42);
    });

    return canvas.toDataURL('image/png');
  }
});
