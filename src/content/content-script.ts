/**
 * Elara AI Agent - Content Script
 *
 * Injected into web pages to:
 * - Intercept link clicks for pre-scan
 * - Extract DOM features
 * - Provide visual overlays for threat warnings
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('[Elara AI Agent] Content script loaded');

// ============================================================================
// LINK CLICK INTERCEPTOR
// ============================================================================

document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const link = target.closest('a');

  if (!link?.href) return;

  // Skip internal navigation
  if (link.href.startsWith('#') || link.href.startsWith('javascript:')) return;

  // Skip same-origin links (optional - can be enabled for stricter checking)
  // if (new URL(link.href).origin === window.location.origin) return;

  // Check if we should pre-scan (based on user settings)
  const settings = await getSettings();
  if (!settings.autoScan) return;

  // Don't block - just notify the extension
  chrome.runtime.sendMessage({
    type: 'LINK_CLICKED',
    payload: {
      url: link.href,
      pageUrl: window.location.href,
      pageTitle: document.title,
    },
  });
}, true);

// ============================================================================
// DOM FEATURE EXTRACTION
// ============================================================================

function extractDOMFeatures() {
  const forms = document.querySelectorAll('form');
  const scripts = document.querySelectorAll('script');
  const iframes = document.querySelectorAll('iframe');
  const inputs = document.querySelectorAll('input');

  const currentHost = window.location.hostname;

  // Check for external form targets
  let formTargetExternal = false;
  forms.forEach(form => {
    const action = form.getAttribute('action');
    if (action) {
      try {
        const actionUrl = new URL(action, window.location.href);
        if (actionUrl.hostname !== currentHost) {
          formTargetExternal = true;
        }
      } catch {
        // Invalid URL
      }
    }
  });

  // Count password inputs
  let inputPasswordCount = 0;
  inputs.forEach(input => {
    if (input.getAttribute('type') === 'password') {
      inputPasswordCount++;
    }
  });

  // Check for external scripts
  let externalScriptCount = 0;
  scripts.forEach(script => {
    const src = script.getAttribute('src');
    if (src) {
      try {
        const scriptUrl = new URL(src, window.location.href);
        if (scriptUrl.hostname !== currentHost) {
          externalScriptCount++;
        }
      } catch {
        // Invalid URL
      }
    }
  });

  // Detect obfuscated scripts
  let obfuscatedScripts = false;
  scripts.forEach(script => {
    const content = script.textContent || '';
    if (
      content.includes('eval(') ||
      content.includes('\\x') ||
      content.includes('fromCharCode') ||
      /[a-zA-Z]+\s*=\s*['"][^'"]{100,}['"]/.test(content)
    ) {
      obfuscatedScripts = true;
    }
  });

  // Count hidden iframes
  let hiddenIframeCount = 0;
  iframes.forEach(iframe => {
    const style = window.getComputedStyle(iframe);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseInt(style.width) < 10 ||
      parseInt(style.height) < 10
    ) {
      hiddenIframeCount++;
    }
  });

  // Collect external domains
  const externalDomains: Set<string> = new Set();
  document.querySelectorAll('[src], [href]').forEach(el => {
    const url = el.getAttribute('src') || el.getAttribute('href');
    if (url) {
      try {
        const parsedUrl = new URL(url, window.location.href);
        if (parsedUrl.hostname !== currentHost) {
          externalDomains.add(parsedUrl.hostname);
        }
      } catch {
        // Invalid URL
      }
    }
  });

  // Detect login forms
  const hasLoginForm = !!document.querySelector(
    'form[action*="login"], form[action*="signin"], input[name*="username"], input[name*="email"][type="email"]'
  );

  // Detect meta refresh
  const metaRefresh = !!document.querySelector('meta[http-equiv="refresh"]');

  return {
    formCount: forms.length,
    formTargetExternal,
    inputPasswordCount,
    scriptCount: scripts.length,
    externalScriptCount,
    obfuscatedScripts,
    iframeCount: iframes.length,
    hiddenIframeCount,
    externalDomains: Array.from(externalDomains).slice(0, 20),
    hasLoginForm,
    metaRefresh,
  };
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'EXTRACT_DOM_FEATURES':
      sendResponse({ success: true, data: extractDOMFeatures() });
      break;

    case 'GET_PAGE_INFO':
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: document.title,
          hostname: window.location.hostname,
        },
      });
      break;

    case 'SHOW_THREAT_WARNING':
      showThreatWarning(message.payload);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

// ============================================================================
// THREAT WARNING OVERLAY
// ============================================================================

function showThreatWarning(data: { verdict: string; riskScore: number; threatType?: string }) {
  // Remove existing warning if any
  const existing = document.getElementById('elara-threat-warning');
  if (existing) existing.remove();

  const warning = document.createElement('div');
  warning.id = 'elara-threat-warning';
  warning.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2147483647;
      background: linear-gradient(135deg, #e74c3c, #c0392b);
      color: white;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18A2 2 0 003.64 21H20.36A2 2 0 0022.18 18L13.71 3.86A2 2 0 0010.29 3.86Z" />
        </svg>
        <div>
          <strong style="font-size: 14px;">Elara Security Warning</strong>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">
            ${data.verdict}: ${data.threatType || 'Potential threat detected'} (Risk: ${Math.round(data.riskScore * 100)}%)
          </p>
        </div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      ">Dismiss</button>
    </div>
  `;

  document.body.appendChild(warning);

  // Auto-dismiss after 10 seconds
  setTimeout(() => warning.remove(), 10000);
}

// ============================================================================
// SETTINGS
// ============================================================================

async function getSettings(): Promise<{ autoScan: boolean }> {
  try {
    const result = await chrome.storage.local.get(['elara_settings']);
    return result.elara_settings || { autoScan: false };
  } catch {
    return { autoScan: false };
  }
}

// ============================================================================
// READY
// ============================================================================

// Notify that content script is ready
chrome.runtime.sendMessage({
  type: 'CONTENT_SCRIPT_READY',
  payload: {
    url: window.location.href,
    title: document.title,
  },
});
