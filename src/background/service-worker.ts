/**
 * Elara AI Agent - Service Worker
 *
 * Main background script that handles:
 * - Message routing
 * - Agent orchestration
 * - Context menu integration
 * - Periodic TI sync
 */

import { orchestrator } from './agents/orchestrator';
import { enhancedOrchestrator } from './agents/enhanced-orchestrator';
import { scannerClient } from '@/api/scanner-client';
import { authClient } from '@/api/auth-client';
import { secureStorage } from './crypto/encryption';

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Elara AI Agent] Extension installed:', details.reason);

  // Initialize auth client and scanner client
  await authClient.initialize();
  await scannerClient.initialize();

  // Initialize enhanced orchestrator (with WebLLM)
  try {
    await enhancedOrchestrator.initialize();
  } catch (error) {
    console.warn('[Elara AI Agent] Enhanced orchestrator initialization failed:', error);
    console.log('[Elara AI Agent] Falling back to basic orchestrator');
  }

  // Enable side panel
  if (chrome.sidePanel) {
    await chrome.sidePanel.setOptions({
      enabled: true,
      path: 'sidepanel/index.html',
    });
  }

  // Create context menus
  createContextMenus();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Elara AI Agent] Extension started');
  await authClient.initialize();
  await scannerClient.initialize();
});

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Async response
});

async function handleMessage(
  message: { type: string; payload?: unknown },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
) {
  try {
    switch (message.type) {
      case 'CHAT_MESSAGE':
        await handleChatMessage(message.payload as { content: string }, sendResponse);
        break;

      case 'SCAN_URL':
        await handleScanUrl(message.payload as { url: string; depth?: string }, sendResponse);
        break;

      case 'GET_CURRENT_TAB':
        await handleGetCurrentTab(sendResponse);
        break;

      case 'SET_AUTH_TOKEN':
        await handleSetAuthToken(message.payload as { token: string }, sendResponse);
        break;

      case 'AUTO_SCAN':
        await handleAutoScan(message.payload as { url: string }, sendResponse);
        break;

      case 'STORE_SECURE':
        await handleSecureStore(message.payload as { key: string; value: unknown }, sendResponse);
        break;

      case 'GET_SECURE':
        await handleSecureGet(message.payload as { key: string }, sendResponse);
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[Elara AI Agent] Message handler error:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

// ============================================================================
// HANDLER IMPLEMENTATIONS
// ============================================================================

async function handleChatMessage(
  payload: { content: string },
  sendResponse: (response: unknown) => void
) {
  const { content } = payload;

  // Broadcast state updates to sidepanel
  const stateInterval = setInterval(() => {
    const state = orchestrator.getState();
    chrome.runtime.sendMessage({ type: 'ORCHESTRATOR_STATE', payload: state }).catch(() => {});
  }, 200);

  try {
    const response = await orchestrator.processMessage(content);

    sendResponse({
      success: true,
      message: {
        id: response.id,
        content: response.content,
        metadata: response.metadata,
      },
    });
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  } finally {
    clearInterval(stateInterval);
  }
}

async function handleScanUrl(
  payload: { url: string; depth?: string },
  sendResponse: (response: unknown) => void
) {
  const { url, depth } = payload;

  try {
    const result = depth === 'deep'
      ? await scannerClient.deepScan(url)
      : await scannerClient.hybridScan(url);

    sendResponse({ success: true, data: result });
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleGetCurrentTab(sendResponse: (response: unknown) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      sendResponse({
        success: true,
        data: { id: tab.id, url: tab.url, title: tab.title },
      });
    } else {
      sendResponse({ success: false, error: 'No active tab found' });
    }
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleSetAuthToken(
  payload: { token: string },
  sendResponse: (response: unknown) => void
) {
  try {
    // Store auth token in secure storage
    await secureStorage.setItem('authToken', payload.token);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleAutoScan(
  payload: { url: string },
  sendResponse: (response: unknown) => void
) {
  const message = `Is this URL safe? ${payload.url}`;
  await handleChatMessage({ content: message }, sendResponse);
}

async function handleSecureStore(
  payload: { key: string; value: unknown },
  sendResponse: (response: unknown) => void
) {
  try {
    await secureStorage.setItem(payload.key, payload.value);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleSecureGet(
  payload: { key: string },
  sendResponse: (response: unknown) => void
) {
  try {
    const value = await secureStorage.getItem(payload.key);
    sendResponse({ success: true, data: value });
  } catch (error) {
    sendResponse({ success: false, error: String(error) });
  }
}

// ============================================================================
// CONTEXT MENUS
// ============================================================================

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'scan-link',
      title: 'Scan link with Elara',
      contexts: ['link'],
    });

    chrome.contextMenus.create({
      id: 'scan-page',
      title: 'Scan this page with Elara',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'scan-selection',
      title: 'Analyze selected text with Elara',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: 'check-image',
      title: 'Check image for deepfake',
      contexts: ['image'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  // Open sidepanel first
  await chrome.sidePanel.open({ tabId: tab.id });

  // Wait for sidepanel to load
  await new Promise(resolve => setTimeout(resolve, 500));

  switch (info.menuItemId) {
    case 'scan-link':
      if (info.linkUrl) {
        chrome.runtime.sendMessage({
          type: 'AUTO_SCAN',
          payload: { url: info.linkUrl },
        });
      }
      break;

    case 'scan-page':
      if (tab.url) {
        chrome.runtime.sendMessage({
          type: 'AUTO_SCAN',
          payload: { url: tab.url },
        });
      }
      break;

    case 'scan-selection':
      if (info.selectionText) {
        const urlMatch = info.selectionText.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          chrome.runtime.sendMessage({
            type: 'AUTO_SCAN',
            payload: { url: urlMatch[0] },
          });
        } else {
          chrome.runtime.sendMessage({
            type: 'CHAT_MESSAGE',
            payload: { content: `Fact check: ${info.selectionText}` },
          });
        }
      }
      break;

    case 'check-image':
      if (info.srcUrl) {
        chrome.runtime.sendMessage({
          type: 'CHAT_MESSAGE',
          payload: { content: `Check this image for deepfake: ${info.srcUrl}` },
        });
      }
      break;
  }
});

// ============================================================================
// TOOLBAR ACTION
// ============================================================================

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ============================================================================
// PERIODIC TASKS
// ============================================================================

// TI cache sync every 30 minutes
chrome.alarms.create('ti-cache-sync', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'ti-cache-sync') {
    try {
      const lastSync = await secureStorage.getItem<number>('lastTiSync');
      const syncData = await scannerClient.getFederatedSync(lastSync || undefined);

      await secureStorage.setItem('lastTiSync', syncData.timestamp);
      console.log(`[Elara AI Agent] TI cache synced: ${syncData.updates.length} updates`);
    } catch (error) {
      console.error('[Elara AI Agent] TI cache sync failed:', error);
    }
  }
});

// ============================================================================
// READY
// ============================================================================

console.log('[Elara AI Agent] Service worker initialized');
