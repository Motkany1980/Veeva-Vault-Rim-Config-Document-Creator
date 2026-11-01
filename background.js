// background.js - Service Worker for Veeva Vault RIM Config Documenter
// NOTE: All Veeva Vault API interactions are strictly READ-ONLY (GET / VQL SELECT queries).

const DEFAULT_SETTINGS = {
  isRecording: true,
  autoGoToPrefix: true,
  passClickThrough: true,
  highlightOnScreenshot: false,
  includeApiNames: true,
  mode1Style: 'blank_line', // 'blank_line' (\n\n) or 'sub_item' (\n   > ) or 'new_block'
  showFloatingHud: true,
  appendComponentsToDoc: true,
  componentsFormat: 'text',
  enableObjectSchemaTools: false
};

/**
 * Draws a clean, flat enterprise Veeva Vault-style icon onto OffscreenCanvas
 * at 16x16, 32x32, 48x48, and 128x128 for the Chrome/Edge extension toolbar.
 */
function updateToolbarAppIcon(isRecording = true) {
  if (typeof OffscreenCanvas === 'undefined' || !chrome.action || !chrome.action.setIcon) return;

  try {
    const sizes = [16, 32, 48, 128];
    const imageDataMap = {};

    for (const size of sizes) {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      const s = size / 128;

      ctx.save();
      ctx.scale(s, s);

      // 1. Flat Enterprise Charcoal Base (#2B3643) with Veeva Orange Top Bar (#F7941D)
      drawRoundRect(ctx, 6, 6, 116, 116, 16);
      ctx.fillStyle = '#2B3643';
      ctx.fill();

      // Top Orange Bar
      ctx.fillStyle = '#F7941D';
      drawRoundRect(ctx, 6, 6, 116, 24, 16);
      ctx.fill();
      ctx.fillRect(6, 18, 116, 12);

      // 2. White Config Document Sheet
      ctx.fillStyle = '#FFFFFF';
      drawRoundRect(ctx, 26, 22, 72, 86, 4);
      ctx.fill();

      // 3. Veeva Orange "V" mark inside document
      ctx.beginPath();
      ctx.moveTo(38, 44);
      ctx.lineTo(48, 68);
      ctx.lineTo(58, 44);
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#F7941D';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 4. Clean Enterprise Config Lines
      ctx.fillStyle = '#2B3643';
      ctx.fillRect(66, 46, 22, 6);
      ctx.fillStyle = '#7A869A';
      ctx.fillRect(66, 58, 16, 6);

      ctx.fillStyle = '#2B3643';
      ctx.fillRect(38, 78, 50, 6);
      ctx.fillStyle = '#7A869A';
      ctx.fillRect(38, 90, 36, 6);

      // 5. Status Indicator Dot (Bottom-Right)
      ctx.beginPath();
      ctx.arc(102, 102, 14, 0, Math.PI * 2);
      ctx.fillStyle = isRecording ? '#2E7D32' : '#7A869A';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#2B3643';
      ctx.stroke();

      ctx.restore();
      imageDataMap[size] = ctx.getImageData(0, 0, size, size);
    }

    chrome.action.setIcon({ imageData: imageDataMap });
  } catch (e) {
    console.warn('Toolbar icon render notice:', e);
  }
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Injects content.css and content.js into already-open tabs so the user does not
 * need to manually reload their Veeva Vault tab after installing/reloading the extension.
 */
async function ensureContentScriptsInOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id, allFrames: true },
          files: ['content.css']
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content.js']
        });
      } catch (e) {
        // Ignore restricted tabs
      }
    }
  } catch (err) {
    console.warn('Auto-inject notice:', err);
  }
}

// Initialize extension state on install & startup
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(['settings']);
  const isRec = data.settings ? data.settings.isRecording !== false : true;
  updateToolbarAppIcon(isRec);
  await ensureContentScriptsInOpenTabs();
});

chrome.runtime.onInstalled.addListener(async () => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (err) {
      console.warn('SidePanel behavior setup warning:', err);
    }
  }

  const data = await chrome.storage.local.get([
    'settings',
    'docSteps',
    'affectedComponents',
    'vaultSession',
    'docMeta'
  ]);
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  await chrome.storage.local.set({ settings });
  updateToolbarAppIcon(settings.isRecording);

  if (!data.docSteps) {
    await chrome.storage.local.set({ docSteps: [] });
  }
  if (!data.affectedComponents) {
    await chrome.storage.local.set({ affectedComponents: [] });
  }
  if (!data.docMeta) {
    await chrome.storage.local.set({
      docMeta: {
        title: 'Veeva Vault RIM Configuration Steps',
        ticketId: '',
        environment: 'Sandbox',
        sessionStartTime: new Date().toISOString()
      }
    });
  }
  if (!data.vaultSession) {
    await chrome.storage.local.set({
      vaultSession: {
        connected: false,
        vaultDns: '',
        ssid: '',
        userName: '',
        userId: '',
        vaultName: '',
        lastVerified: null
      }
    });
  }

  await ensureContentScriptsInOpenTabs();
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url && /^https?:\/\//i.test(tab.url)) {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });
    }
  } catch (e) {}
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings && changes.settings.newValue) {
    updateToolbarAppIcon(changes.settings.newValue.isRecording !== false);
  }
});

// Listen for messages from content scripts and sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RECORD_ACTION') {
    handleRecordAction(message.payload, sender.tab)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'RECORD_COMPONENT_FROM_DOM') {
    handleRecordComponentFromDom(message.component)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CAPTURE_SCREENSHOT_NOW') {
    captureTabScreenshot(sender.tab?.windowId)
      .then((dataUrl) => sendResponse({ success: true, dataUrl }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'AUTO_DETECT_SSID') {
    autoDetectVaultSession(message.targetUrl)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'VERIFY_SSID') {
    verifyVaultSsid(message.vaultDns, message.ssid)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'LOGIN_VAULT_CREDENTIALS') {
    loginWithCredentials(message.vaultDns, message.username, message.password)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'MANUAL_CAPTURE_SCREENSHOT') {
    handleManualScreenshot()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'QUERY_VAULT_COMPONENTS') {
    queryVaultComponentsReadOnly(message.options || {})
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'SCAN_DOM_COMPONENTS') {
    scanActiveTabForComponents()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'UNDO_LAST_SEGMENT') {
    handleUndoLastSegment()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'INSERT_SCREENSHOT_AT') {
    handleInsertScreenshotAt(message.index)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'ENSURE_CONTENT_SCRIPTS') {
    ensureContentScriptsInOpenTabs()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'SYNC_KEY_MODE') {
    chrome.storage.local.set({
      remoteKeyState: {
        mode: message.mode,
        sticky: Boolean(message.sticky),
        timestamp: Date.now()
      }
    });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'FETCH_OBJECT_FIELDS') {
    fetchVaultObjectFieldsReadOnly(message.objectName, message.pageUrl, sender.tab)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

const objectFieldsCache = new Map();

async function fetchVaultObjectFieldsReadOnly(objectName, pageUrl, senderTab) {
  const cleanObjName = (objectName || '').trim().toLowerCase();
  if (!cleanObjName) {
    return { success: false, error: 'Missing Object Name.' };
  }

  const store = await chrome.storage.local.get(['vaultSession']);
  let session = store.vaultSession || {};
  let vaultDns = session.vaultDns || '';
  let ssid = session.ssid || '';

  const targetUrl = pageUrl || senderTab?.url || '';
  if (targetUrl && targetUrl.startsWith('http')) {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.hostname.includes('veevavault.com')) {
        vaultDns = parsed.hostname;
      }
    } catch (e) {}
  }

  // If no SSID is connected yet, try auto-detecting from the active Veeva Vault tab
  if (!ssid || !vaultDns) {
    try {
      const detected = await autoDetectVaultSession(targetUrl);
      if (detected && detected.ssid) {
        ssid = detected.ssid;
      }
      if (detected && detected.vaultDns) {
        vaultDns = detected.vaultDns;
      }
    } catch (e) {}
  }

  const cacheKey = `${vaultDns || 'local'}:${cleanObjName}`;
  if (objectFieldsCache.has(cacheKey)) {
    return {
      ok: true,
      success: true,
      cached: true,
      objectName: cleanObjName,
      ...objectFieldsCache.get(cacheKey)
    };
  }

  if (!vaultDns || !ssid) {
    return {
      ok: false,
      success: false,
      needsAuth: true,
      error:
        'Connect SSID (click Auto-SSID in the extension) to load live Object fields from Veeva Vault.'
    };
  }

  const apiVersions = ['v24.1', 'v23.3', 'v22.3'];
  let lastError = 'Failed to fetch object metadata.';
  let retriedFreshSession = false;

  for (let i = 0; i < apiVersions.length; i++) {
    const ver = apiVersions[i];
    try {
      const endpoint = `https://${vaultDns}/api/${ver}/metadata/vobjects/${encodeURIComponent(
        cleanObjName
      )}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: ssid,
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        lastError = `HTTP ${response.status} from Vault API`;
        continue;
      }

      const data = await response.json();
      if (data.responseStatus === 'SUCCESS' && data.object) {
        const rawFields = Array.isArray(data.object.fields) ? data.object.fields : [];
        const fields = rawFields.map((f) => {
          const fName = f.name || '';
          const fSource =
            f.source ||
            (/__c$/i.test(fName)
              ? 'Custom'
              : /__rim$/i.test(fName)
              ? 'Application'
              : /__sys$/i.test(fName)
              ? 'System'
              : 'Standard');
          return {
            name: fName,
            label: f.label || fName,
            type: f.type || 'Field',
            required: Boolean(f.required),
            editable: f.editable !== undefined ? Boolean(f.editable) : true,
            maxLength: f.max_length || f.length || null,
            source: fSource,
            lookupObject:
              f.object ||
              f.lookup_object_name ||
              (typeof f.object === 'object' && f.object && f.object.name) ||
              '',
            picklist: f.picklist || '',
            helpContent: f.help_content || f.description || '',
            status: Array.isArray(f.status) ? f.status[0] : f.status || 'Active'
          };
        });

        fields.sort((a, b) => a.label.localeCompare(b.label));

        const payload = {
          objectLabel: data.object.label || cleanObjName,
          fields
        };
        objectFieldsCache.set(cacheKey, payload);
        return {
          ok: true,
          success: true,
          objectName: cleanObjName,
          ...payload
        };
      } else if (data.errors && data.errors[0]) {
        const errType = data.errors[0].type || '';
        lastError = data.errors[0].message || lastError;
        // If stored SSID expired, re-detect fresh session cookie from browser and retry v24.1 once
        if (!retriedFreshSession && /SESSION/i.test(errType + ' ' + lastError)) {
          retriedFreshSession = true;
          try {
            const fresh = await autoDetectVaultSession(targetUrl);
            if (fresh && fresh.ssid && fresh.ssid !== ssid) {
              ssid = fresh.ssid;
              i = -1; // restart loop with fresh SSID
              continue;
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      lastError = err.message || lastError;
    }
  }

  return {
    ok: false,
    success: false,
    error: lastError
  };
}

async function handleUndoLastSegment() {
  const store = await chrome.storage.local.get(['docSteps']);
  const docSteps = Array.isArray(store.docSteps) ? store.docSteps : [];
  if (docSteps.length === 0) {
    return { success: false, error: 'No steps to undo.' };
  }

  const last = docSteps[docSteps.length - 1];
  if (last.type === 'image') {
    docSteps.pop();
  } else if (last.type === 'text') {
    const txt = last.text || '';
    if (txt.includes('\n   > ')) {
      last.text = txt.slice(0, txt.lastIndexOf('\n   > '));
    } else if (txt.includes('\n\n')) {
      last.text = txt.slice(0, txt.lastIndexOf('\n\n'));
    } else if (txt.includes(' > ')) {
      last.text = txt.slice(0, txt.lastIndexOf(' > '));
    } else {
      docSteps.pop();
    }
  }

  await chrome.storage.local.set({ docSteps });
  broadcastUpdate(docSteps);
  return { success: true, docSteps };
}

/**
 * Finds the active target browser tab even when the extension is opened in a separate pop-out window.
 */
async function getTargetBrowserTab() {
  const allActiveTabs = await chrome.tabs.query({ active: true });
  // Filter out the extension's own sidepanel.html pop-out window
  const candidates = allActiveTabs.filter(
    (t) => t.url && !t.url.includes('sidepanel.html') && !t.url.startsWith('devtools://')
  );
  // Prefer an active *.veevavault.com tab or test-veeva-mock.html if present
  const veevaCandidate = candidates.find(
    (t) => t.url.includes('veevavault.com') || t.url.includes('test-veeva-mock.html')
  );
  if (veevaCandidate) return veevaCandidate;
  if (candidates.length > 0) return candidates[0];
  return allActiveTabs[0] || null;
}

async function handleInsertScreenshotAt(insertAfterIdx) {
  const activeTab = await getTargetBrowserTab();
  const screenshotUrl = await captureTabScreenshot(activeTab ? activeTab.windowId : null);
  const store = await chrome.storage.local.get(['docSteps']);
  const docSteps = Array.isArray(store.docSteps) ? store.docSteps : [];

  const newStep = {
    id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    type: 'image',
    imageDataUrl: screenshotUrl,
    caption: '',
    timestamp: new Date().toISOString(),
    pageUrl: activeTab?.url || ''
  };

  if (typeof insertAfterIdx === 'number' && insertAfterIdx >= 0 && insertAfterIdx < docSteps.length) {
    docSteps.splice(insertAfterIdx + 1, 0, newStep);
  } else {
    docSteps.push(newStep);
  }

  await chrome.storage.local.set({ docSteps });
  broadcastUpdate(docSteps);
  return { success: true, step: newStep };
}

/**
 * Formats the first clicked label of a new navigation line.
 * Never hardcodes "Admin": if autoGoToPrefix is enabled and the clicked item
 * is a menu/navigation target (e.g. "Admin", "Library", "Objects", "Configuration"),
 * it prefixes "Go to " before that clicked label. If it already starts with an action verb
 * (like "Click ", "Remove ", "Add ", "Select ", "On "), it leaves it as-is.
 */
function formatLineStartLabel(cleanLabel, settings) {
  if (!settings.autoGoToPrefix) {
    return cleanLabel;
  }
  const startsWithVerb = /^(go to|click|remove|add|select|on |set|change|delete|create|edit|open)\b/i.test(
    cleanLabel
  );
  if (startsWithVerb) {
    return cleanLabel;
  }
  return 'Go to ' + cleanLabel;
}

/**
 * Handles 0+Click, 1+Click, 2+Click, 3+Click, and 4+Click actions from content.js
 */
async function handleRecordAction(payload, tab) {
  const { mode, label, pageUrl, dataUrl, componentData } = payload;
  const store = await chrome.storage.local.get(['docSteps', 'settings', 'affectedComponents']);
  const docSteps = Array.isArray(store.docSteps) ? store.docSteps : [];
  const affectedComponents = Array.isArray(store.affectedComponents) ? store.affectedComponents : [];
  const settings = { ...DEFAULT_SETTINGS, ...(store.settings || {}) };

  if (!settings.isRecording) {
    return { success: false, ignored: true, reason: 'Recording is paused' };
  }

  const timestamp = new Date().toISOString();

  // Mode 4: 4 + Left Click -> Directly capture component info into Affected Components list
  if (mode === '4' && componentData) {
    const added = upsertComponent(affectedComponents, componentData);
    await chrome.storage.local.set({ affectedComponents });
    broadcastComponentsUpdate(affectedComponents);
    return { success: true, component: added, action: 'component_recorded' };
  }

  // Also auto-track any component technical name (__c / __v) spotted during 0/1/3 clicks
  if (componentData && componentData.componentName) {
    upsertComponent(affectedComponents, componentData);
    await chrome.storage.local.set({ affectedComponents });
    broadcastComponentsUpdate(affectedComponents);
  }

  if (mode === '2') {
    let screenshotUrl = dataUrl;
    if (!screenshotUrl) {
      screenshotUrl = await captureTabScreenshot(tab ? tab.windowId : null);
    }
    const newStep = {
      id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type: 'image',
      imageDataUrl: screenshotUrl,
      caption: label ? `Screenshot: ${label}` : '',
      timestamp,
      pageUrl: pageUrl || tab?.url || ''
    };
    docSteps.push(newStep);
    await chrome.storage.local.set({ docSteps });
    broadcastUpdate(docSteps);
    return { success: true, step: newStep, action: 'screenshot_added' };
  }

  const cleanLabel = (label || '').trim();
  if (!cleanLabel) {
    return { success: false, error: 'Empty label clicked' };
  }

  const lastStep = docSteps.length > 0 ? docSteps[docSteps.length - 1] : null;

  if (mode === '0') {
    if (lastStep && lastStep.type === 'text') {
      if (lastStep.text.endsWith('\n') || lastStep.text.endsWith('\n   > ')) {
        lastStep.text += cleanLabel;
      } else if (!lastStep.text.trim()) {
        lastStep.text = formatLineStartLabel(cleanLabel, settings);
      } else {
        lastStep.text += ' > ' + cleanLabel;
      }
      lastStep.updatedAt = timestamp;
    } else {
      const initialText = formatLineStartLabel(cleanLabel, settings);
      docSteps.push({
        id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: 'text',
        text: initialText,
        timestamp,
        pageUrl: pageUrl || tab?.url || ''
      });
    }
  } else if (mode === '1') {
    if (settings.mode1Style === 'sub_item') {
      if (lastStep && lastStep.type === 'text') {
        lastStep.text += '\n   > ' + cleanLabel;
        lastStep.updatedAt = timestamp;
      } else {
        docSteps.push({
          id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          type: 'text',
          text: '   > ' + cleanLabel,
          timestamp,
          pageUrl: pageUrl || tab?.url || ''
        });
      }
    } else if (settings.mode1Style === 'new_block') {
      const initialText = formatLineStartLabel(cleanLabel, settings);
      docSteps.push({
        id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: 'text',
        text: initialText,
        timestamp,
        pageUrl: pageUrl || tab?.url || ''
      });
    } else {
      // Default 'blank_line': Inserts in a new line with 1 empty line skipped (\n\n)
      const lineStart = formatLineStartLabel(cleanLabel, settings);
      if (lastStep && lastStep.type === 'text') {
        lastStep.text += '\n\n' + lineStart;
        lastStep.updatedAt = timestamp;
      } else {
        docSteps.push({
          id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          type: 'text',
          text: lineStart,
          timestamp,
          pageUrl: pageUrl || tab?.url || ''
        });
      }
    }
  } else if (mode === '3') {
    if (lastStep && lastStep.type === 'text') {
      lastStep.text += '\n   > ' + cleanLabel;
      lastStep.updatedAt = timestamp;
    } else {
      docSteps.push({
        id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: 'text',
        text: '   > ' + cleanLabel,
        timestamp,
        pageUrl: pageUrl || tab?.url || ''
      });
    }
  }

  await chrome.storage.local.set({ docSteps });
  broadcastUpdate(docSteps);
  return {
    success: true,
    step: docSteps[docSteps.length - 1],
    action: 'text_recorded'
  };
}

function upsertComponent(list, comp) {
  const normName = (comp.componentName || '').trim();
  const normLabel = (comp.name || '').trim();
  const existingIdx = list.findIndex(
    (c) =>
      (normName && c.componentName === normName) ||
      (!normName && normLabel && c.name === normLabel && c.componentType === comp.componentType)
  );

  const entry = {
    id: comp.id || 'comp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: normLabel || normName || 'Unnamed Component',
    componentName: normName || 'n/a',
    componentType: (comp.componentType || 'Component').trim(),
    modifiedDate:
      comp.modifiedDate ||
      formatVeevaDateRange(new Date().toISOString(), new Date().toISOString())
  };

  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...entry };
    return list[existingIdx];
  } else {
    list.push(entry);
    return entry;
  }
}

async function handleRecordComponentFromDom(comp) {
  const store = await chrome.storage.local.get(['affectedComponents']);
  const affectedComponents = Array.isArray(store.affectedComponents)
    ? store.affectedComponents
    : [];
  const added = upsertComponent(affectedComponents, comp);
  await chrome.storage.local.set({ affectedComponents });
  broadcastComponentsUpdate(affectedComponents);
  return { success: true, component: added };
}

/**
 * Strictly READ-ONLY VQL Query against Veeva Vault to fetch modified/affected components
 */
async function queryVaultComponentsReadOnly(options) {
  const store = await chrome.storage.local.get([
    'vaultSession',
    'docSteps',
    'affectedComponents',
    'docMeta'
  ]);
  const session = store.vaultSession || {};
  const docSteps = store.docSteps || [];
  const affectedComponents = Array.isArray(store.affectedComponents)
    ? store.affectedComponents
    : [];

  const mentionedApiNames = extractMentionedApiNamesFromSteps(docSteps);

  if (!session.connected || !session.vaultDns || !session.ssid) {
    const domResult = await scanActiveTabForComponents(mentionedApiNames);
    if (domResult.components && domResult.components.length > 0) {
      return {
        success: true,
        source: 'DOM_SCAN',
        addedCount: domResult.addedCount,
        components: domResult.components,
        message: `${domResult.addedCount} component(s) scanned from the active page (Read-Only)!`
      };
    }
    throw new Error(
      'No active SSID connection to Veeva Vault API. Please connect via SSID (Auto-SSID) or use 4+Click / Page Scan!'
    );
  }

  const vaultDns = session.vaultDns;
  const ssid = session.ssid;
  const filterMode = options.filterMode || 'recent_today';
  const searchKeyword = (options.searchKeyword || '').trim();

  let whereClauses = [];

  if (filterMode === 'recent_1h') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    whereClauses.push(`modified_date__v >= '${oneHourAgo}'`);
  } else if (filterMode === 'recent_today') {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    whereClauses.push(`modified_date__v >= '${startOfDay.toISOString()}'`);
  } else if (filterMode === 'from_steps' && mentionedApiNames.length > 0) {
    const quoted = mentionedApiNames
      .slice(0, 25)
      .map((n) => `'${n.replace(/'/g, '')}'`)
      .join(', ');
    whereClauses.push(`component_name__v CONTAINS (${quoted})`);
  }

  if (searchKeyword) {
    const safeKw = searchKeyword.replace(/'/g, '');
    whereClauses.push(
      `(component_name__v CONTAINS '${safeKw}' OR label__v CONTAINS '${safeKw}' OR component_type__v CONTAINS '${safeKw}')`
    );
  }

  const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

  const vqlCandidates = [
    `SELECT id, label__v, name__v, component_name__v, component_type__v, modified_date__v, created_date__v, status__v FROM vault_component__v${whereSql} ORDER BY modified_date__v DESC MAXROWS 50`,
    `SELECT id, name__v, component_name__v, component_type__v, modified_date__v FROM vault_component__v${whereSql} MAXROWS 50`,
    `SELECT component_name__v, component_type__v FROM vault_component__v${whereSql} MAXROWS 50`
  ];

  let records = [];
  let lastApiError = '';

  for (const vql of vqlCandidates) {
    try {
      const url = `https://${vaultDns}/api/v24.1/query?q=${encodeURIComponent(vql)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: ssid,
          Accept: 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.responseStatus === 'SUCCESS' && Array.isArray(data.data)) {
          records = data.data;
          break;
        } else if (data.errors && data.errors[0]) {
          lastApiError = data.errors[0].message;
        }
      }
    } catch (err) {
      lastApiError = err.message;
    }
  }

  let addedCount = 0;
  for (const row of records) {
    const label = row.label__v || row.name__v || row.component_name__v || 'Component';
    const statusPrefix =
      Array.isArray(row.status__v) && row.status__v[0] && /inactive/i.test(row.status__v[0])
        ? '(Inactive) '
        : typeof row.status__v === 'string' && /inactive/i.test(row.status__v)
        ? '(Inactive) '
        : '';

    const fullLabel =
      statusPrefix && !label.startsWith('(Inactive)') ? `${statusPrefix}${label}` : label;

    const compEntry = {
      name: fullLabel,
      componentName: row.component_name__v || row.name__v || '',
      componentType: row.component_type__v || 'Component',
      modifiedDate: formatVeevaDateRange(row.modified_date__v, row.created_date__v)
    };
    upsertComponent(affectedComponents, compEntry);
    addedCount++;
  }

  if (addedCount === 0) {
    const domFallback = await scanActiveTabForComponents(mentionedApiNames);
    if (domFallback && domFallback.addedCount > 0) {
      return {
        success: true,
        source: 'DOM_FALLBACK',
        addedCount: domFallback.addedCount,
        components: domFallback.components,
        message: `VQL returned 0 matches, scanned ${domFallback.addedCount} component(s) from the active page!`
      };
    }
  }

  await chrome.storage.local.set({ affectedComponents });
  broadcastComponentsUpdate(affectedComponents);

  return {
    success: true,
    source: 'VQL_API',
    addedCount,
    components: affectedComponents,
    message:
      addedCount > 0
        ? `${addedCount} affected component(s) queried from Veeva Vault (Read-Only VQL)!`
        : `Query completed, no new components found with the current filter. ${lastApiError ? '(' + lastApiError + ')' : ''}`
  };
}

function extractMentionedApiNamesFromSteps(docSteps) {
  const found = new Set();
  for (const step of docSteps) {
    if (step.type === 'text' && step.text) {
      const matches = step.text.match(/\b([a-z][a-z0-9_]*__(?:c|v|sys|cda|rim))\b/gi);
      if (matches) {
        matches.forEach((m) => found.add(m.toLowerCase()));
      }
    }
  }
  return Array.from(found);
}

function formatVeevaDateRange(modIso, createIso) {
  const d1 = formatSingleVeevaDate(modIso || new Date().toISOString());
  const d2 = formatSingleVeevaDate(createIso || modIso || new Date().toISOString());
  return `${d1} - ${d2}`;
}

function formatSingleVeevaDate(isoStr) {
  if (!isoStr) return '';
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s*(AM|PM)/i.test(String(isoStr).trim())) {
    return String(isoStr).trim();
  }
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${yyyy}-${mm}-${dd} ${hours}:${minutes} ${ampm}`;
}

async function scanActiveTabForComponents() {
  const activeTab = await getTargetBrowserTab();
  if (!activeTab || !activeTab.id) {
    return { success: false, addedCount: 0, components: [] };
  }

  const store = await chrome.storage.local.get(['affectedComponents']);
  const affectedComponents = Array.isArray(store.affectedComponents)
    ? store.affectedComponents
    : [];

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        const extracted = [];
        document
          .querySelectorAll('[data-component-name], [data-api-name], tr, .vv-component-row')
          .forEach((row) => {
            const compName =
              row.getAttribute('data-component-name') || row.getAttribute('data-api-name') || '';
            const compLabel = row.getAttribute('data-component-label') || '';
            const compType = row.getAttribute('data-component-type') || '';
            const compMod = row.getAttribute('data-modified-date') || '';

            if (compName && compLabel) {
              extracted.push({
                name: compLabel,
                componentName: compName,
                componentType: compType || 'Component',
                modifiedDate: compMod || ''
              });
              return;
            }

            if (row.tagName === 'TR') {
              const cells = Array.from(row.querySelectorAll('td')).map((td) =>
                (td.textContent || '').trim()
              );
              if (cells.length >= 2) {
                const apiCellIdx = cells.findIndex((c) =>
                  /^[a-z0-9_.]+__(?:c|v|sys|cda|rim)$/i.test(c)
                );
                if (apiCellIdx >= 0) {
                  const apiVal = cells[apiCellIdx];
                  const labelVal = apiCellIdx > 0 ? cells[0] : cells[1] || apiVal;
                  const typeVal = cells[apiCellIdx + 1] || 'Component';
                  const dateVal = cells[apiCellIdx + 2] || '';
                  extracted.push({
                    name: labelVal,
                    componentName: apiVal,
                    componentType: typeVal,
                    modifiedDate: dateVal
                  });
                }
              }
            }
          });
        return extracted;
      }
    });

    const foundList = (results && results[0] && results[0].result) || [];
    let addedCount = 0;
    for (const item of foundList) {
      upsertComponent(affectedComponents, item);
      addedCount++;
    }

    if (addedCount > 0) {
      await chrome.storage.local.set({ affectedComponents });
      broadcastComponentsUpdate(affectedComponents);
    }

    return {
      success: true,
      addedCount,
      components: affectedComponents
    };
  } catch (err) {
    return { success: false, addedCount: 0, components: affectedComponents, error: err.message };
  }
}

async function handleManualScreenshot() {
  const activeTab = await getTargetBrowserTab();
  const screenshotUrl = await captureTabScreenshot(activeTab ? activeTab.windowId : null);
  const store = await chrome.storage.local.get(['docSteps']);
  const docSteps = Array.isArray(store.docSteps) ? store.docSteps : [];

  const newStep = {
    id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    type: 'image',
    imageDataUrl: screenshotUrl,
    caption: '',
    timestamp: new Date().toISOString(),
    pageUrl: activeTab?.url || ''
  };
  docSteps.push(newStep);
  await chrome.storage.local.set({ docSteps });
  broadcastUpdate(docSteps);
  return { success: true, step: newStep };
}

function captureTabScreenshot(windowId) {
  return new Promise((resolve, reject) => {
    const targetWindowId = windowId || chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs.captureVisibleTab(targetWindowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

function broadcastUpdate(docSteps) {
  chrome.runtime.sendMessage({ type: 'STEPS_UPDATED', docSteps }).catch(() => {});
}

function broadcastComponentsUpdate(affectedComponents) {
  chrome.runtime
    .sendMessage({ type: 'COMPONENTS_UPDATED', affectedComponents })
    .catch(() => {});
}

async function autoDetectVaultSession(targetUrl) {
  let vaultTab = await getTargetBrowserTab();

  if (!vaultTab?.url || !vaultTab.url.includes('veevavault.com')) {
    const allVaultTabs = await chrome.tabs.query({ url: '*://*.veevavault.com/*' });
    if (allVaultTabs.length > 0) {
      vaultTab = allVaultTabs[0];
    }
  }

  let urlToInspect = targetUrl || vaultTab?.url || '';
  let vaultDns = '';
  try {
    if (urlToInspect && urlToInspect.startsWith('http')) {
      const parsed = new URL(urlToInspect);
      vaultDns = parsed.hostname;
    }
  } catch (e) {}

  let detectedSsid = '';

  if (urlToInspect && urlToInspect.startsWith('http')) {
    try {
      const parsed = new URL(urlToInspect);
      const byOrigin = await chrome.cookies.getAll({ url: parsed.origin });
      const byDomain = vaultDns ? await chrome.cookies.getAll({ domain: vaultDns }) : [];
      const cookieMap = new Map();
      [...byOrigin, ...byDomain].forEach((c) => {
        if (c && c.name && c.value) {
          cookieMap.set(`${c.name}:${c.path || ''}`, c);
        }
      });
      const cookies = Array.from(cookieMap.values());
      const sessionCookieNames = ['TK', 'vaultSessionId', 'SESSION_ID', 'veeva_session_id', 'sid'];
      for (const name of sessionCookieNames) {
        const match = cookies.find(
          (c) => c.name.toLowerCase() === name.toLowerCase() && c.value && c.value.length > 15
        );
        if (match) {
          detectedSsid = match.value;
          break;
        }
      }
      if (!detectedSsid && vaultDns.includes('veevavault.com')) {
        const tokenCandidate = cookies.find(
          (c) => /^[A-Za-z0-9_.-]{24,512}$/.test(c.value) && !c.name.startsWith('_ga')
        );
        if (tokenCandidate) {
          detectedSsid = tokenCandidate.value;
        }
      }
    } catch (err) {
      console.warn('Cookie inspection warning:', err);
    }
  }

  if (!detectedSsid && vaultTab?.id && vaultTab.url && !vaultTab.url.startsWith('chrome://')) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: vaultTab.id },
        world: 'MAIN',
        func: () => {
          try {
            if (window.Vault && window.Vault.sessionId) return window.Vault.sessionId;
            if (window.veeva && window.veeva.sessionId) return window.veeva.sessionId;
            for (let i = 0; i < sessionStorage.length; i++) {
              const k = sessionStorage.key(i);
              const v = sessionStorage.getItem(k);
              if (k && /session|ssid|tk/i.test(k) && v && v.length > 20 && v.length < 300) {
                return v.replace(/^"|"$/g, '');
              }
            }
            const m = document.cookie.match(/(?:^|;\s*)TK=([^;]+)/);
            if (m) return decodeURIComponent(m[1]);
          } catch (e) {}
          return '';
        }
      });
      if (results && results[0] && results[0].result) {
        detectedSsid = results[0].result;
      }
    } catch (err) {}
  }

  if (detectedSsid && vaultDns) {
    const verifyRes = await verifyVaultSsid(vaultDns, detectedSsid);
    return {
      ...verifyRes,
      vaultDns,
      ssid: detectedSsid,
      autoDetected: true
    };
  }

  return {
    success: Boolean(vaultDns || detectedSsid),
    vaultDns,
    ssid: detectedSsid,
    message: detectedSsid
      ? 'SSID auto-detected successfully!'
      : vaultDns
      ? `Domain detected (${vaultDns}), please enter SSID or sign in.`
      : 'No active *.veevavault.com tab found. Please enter Vault DNS and SSID manually!'
  };
}

async function verifyVaultSsid(rawDns, rawSsid) {
  const vaultDns = (rawDns || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  const ssid = (rawSsid || '').trim();

  if (!vaultDns || !ssid) {
    throw new Error('Please provide both Vault DNS (e.g. myvault.veevavault.com) and SSID!');
  }

  let userName = 'Authenticated User';
  let userId = '';
  let vaultName = vaultDns;
  let apiVerified = false;

  try {
    const response = await fetch(`https://${vaultDns}/api/v24.1/objects/users/me`, {
      method: 'GET',
      headers: {
        Authorization: ssid,
        Accept: 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.responseStatus === 'SUCCESS') {
        apiVerified = true;
        const u = data.users && data.users[0] && data.users[0].user;
        if (u) {
          userId = String(u.id || '');
          userName = `${u.user_first_name__v || ''} ${u.user_last_name__v || ''} (${u.user_name__v || ''})`.trim();
        }
      }
    }
  } catch (err) {
    console.warn('Vault API direct verification notice:', err.message);
  }

  const vaultSession = {
    connected: true,
    apiVerified,
    vaultDns,
    ssid,
    userName,
    userId,
    vaultName,
    lastVerified: new Date().toISOString()
  };

  await chrome.storage.local.set({ vaultSession });
  return {
    success: true,
    vaultSession,
    message: apiVerified
      ? `Connected to Veeva Vault API (Read-Only): ${userName}`
      : `SSID saved for ${vaultDns} (Read-Only mode)`
  };
}

async function loginWithCredentials(rawDns, username, password) {
  const vaultDns = (rawDns || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');

  if (!vaultDns || !username || !password) {
    throw new Error('Vault DNS, username, and password are required!');
  }

  const body = new URLSearchParams();
  body.append('username', username.trim());
  body.append('password', password);

  const response = await fetch(`https://${vaultDns}/api/v24.1/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: body.toString()
  });

  const data = await response.json();
  if (data.responseStatus !== 'SUCCESS' || !data.sessionId) {
    const errMsg =
      data.errors && data.errors[0]
        ? data.errors[0].message
        : 'Authentication failed (please verify your credentials).';
    throw new Error(errMsg);
  }

  return await verifyVaultSsid(vaultDns, data.sessionId);
}
