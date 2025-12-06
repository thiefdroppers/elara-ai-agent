/**
 * Elara AI Agent - Service Worker
 *
 * Main background script that handles:
 * - Message routing
 * - Agent orchestration (with Gemini backend)
 * - Context menu integration
 * - Periodic TI sync
 *
 * @version 2.0.0 - Uses Gemini-backed orchestrator (WebLLM optional)
 */

import { orchestrator } from './agents/orchestrator';
import { enhancedOrchestrator } from './agents/enhanced-orchestrator';
import { webLLMEngine } from '@/lib/webllm/webllm-engine';
import { scannerClient } from '@/api/scanner-client';
import { authClient } from '@/api/auth-client';
import { secureStorage } from './crypto/encryption';

// Flag to track if WebLLM is available (optional enhancement)
let webLLMReady = false;
let modelLoadingProgress = 0;

// ALWAYS use the enhanced orchestrator (Gemini backend) - WebLLM is optional
// The orchestrator uses cloud AI when WebLLM is not available

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
  // This loads the LLM model - can take time on first run
  initializeWebLLM();

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

  // Try to reinitialize WebLLM
  initializeWebLLM();
});

/**
 * Initialize WebLLM in the background
 * This downloads and loads the LLM model for conversational AI
 */
async function initializeWebLLM() {
  try {
    console.log('[Elara AI Agent] Initializing WebLLM...');

    // Initialize the engine (detects device capabilities)
    await webLLMEngine.initialize();

    // Load the recommended model with progress tracking
    await webLLMEngine.loadRecommendedModel((progress) => {
      modelLoadingProgress = progress;
      console.log(`[Elara AI Agent] Model loading: ${progress}%`);

      // Broadcast progress to sidepanel
      chrome.runtime.sendMessage({
        type: 'MODEL_LOADING_PROGRESS',
        payload: { progress }
      }).catch(() => {});
    });

    // Initialize WebLLM-enhanced orchestrator after model is loaded
    await enhancedOrchestrator.initialize();
    webLLMReady = true;

    console.log('[Elara AI Agent] ========================================');
    console.log('[Elara AI Agent] WebLLM READY - LOCAL LLM AVAILABLE');
    console.log('[Elara AI Agent] Model:', webLLMEngine.getCurrentModel()?.displayName);
    console.log('[Elara AI Agent] webLLMReady =', webLLMReady);
    console.log('[Elara AI Agent] ========================================');

    // Notify sidepanel that WebLLM is ready
    chrome.runtime.sendMessage({
      type: 'WEBLLM_READY',
      payload: {
        model: webLLMEngine.getCurrentModel()?.displayName,
        capabilities: webLLMEngine.getDeviceCapabilities()
      }
    }).catch(() => {});

  } catch (error) {
    console.warn('[Elara AI Agent] WebLLM initialization failed:', error);
    console.log('[Elara AI Agent] WebLLM not available - using Gemini backend for AI');
    webLLMReady = false;
    // Note: The orchestrator will still work using Gemini cloud AI
  }
}

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

      case 'GET_WEBLLM_STATUS':
        handleGetWebLLMStatus(sendResponse);
        break;

      case 'LOAD_MODEL':
        await handleLoadModel(message.payload as { modelId: string }, sendResponse);
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
  payload: { content: string; stream?: boolean },
  sendResponse: (response: unknown) => void
) {
  const { content, stream } = payload;

  // ALWAYS use the enhanced orchestrator (with Gemini backend)
  // It will use zero-LLM path for 80% of requests, and Gemini for the rest
  console.log('[Elara AI Agent] Processing chat message');
  console.log('[Elara AI Agent] webLLMReady =', webLLMReady);
  console.log('[Elara AI Agent] Using: ENHANCED orchestrator (Gemini backend)');

  // Broadcast state updates to sidepanel
  const stateInterval = setInterval(() => {
    const state = orchestrator.getState();
    chrome.runtime.sendMessage({ type: 'ORCHESTRATOR_STATE', payload: state }).catch(() => {});
  }, 200);

  try {
    // Use the enhanced orchestrator which has:
    // - Zero-LLM intent classification for 80% of requests
    // - TOON-encoded prompts for 40% token reduction
    // - Gemini cloud AI fallback for complex requests
    const response = await orchestrator.processMessage(content);

    sendResponse({
      success: true,
      message: {
        id: response.id,
        content: response.content,
        metadata: {
          ...response.metadata,
          usedWebLLM: webLLMReady,
          modelName: webLLMReady ? webLLMEngine.getCurrentModel()?.displayName : 'Gemini (Cloud)',
        },
      },
    });
  } catch (error) {
    console.error('[Elara AI Agent] Chat message error:', error);
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

function handleGetWebLLMStatus(sendResponse: (response: unknown) => void) {
  sendResponse({
    success: true,
    data: {
      ready: true, // Orchestrator is always ready (uses Gemini if WebLLM not available)
      webLLMReady,
      engineState: webLLMEngine.getState(),
      loadingProgress: modelLoadingProgress,
      currentModel: webLLMReady ? webLLMEngine.getCurrentModel() : { displayName: 'Gemini (Cloud)' },
      deviceCapabilities: webLLMEngine.getDeviceCapabilities(),
      compatibleModels: webLLMEngine.getCompatibleModels(),
      backendMode: webLLMReady ? 'local' : 'cloud',
    }
  });
}

async function handleLoadModel(
  payload: { modelId: string },
  sendResponse: (response: unknown) => void
) {
  try {
    await webLLMEngine.loadModel(payload.modelId, (progress) => {
      modelLoadingProgress = progress;
      chrome.runtime.sendMessage({
        type: 'MODEL_LOADING_PROGRESS',
        payload: { progress }
      }).catch(() => {});
    });

    webLLMReady = true;
    sendResponse({
      success: true,
      data: {
        model: webLLMEngine.getCurrentModel()?.displayName,
      }
    });
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
