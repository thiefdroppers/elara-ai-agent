/**
 * Chrome Offscreen API Type Declarations
 *
 * Extends @types/chrome with Offscreen Documents API (Chrome 109+)
 */

declare namespace chrome.offscreen {
  type Reason =
    | 'TESTING'
    | 'AUDIO_PLAYBACK'
    | 'IFRAME_SCRIPTING'
    | 'DOM_SCRAPING'
    | 'BLOBS'
    | 'DOM_PARSER'
    | 'USER_MEDIA'
    | 'DISPLAY_MEDIA'
    | 'WEB_RTC'
    | 'CLIPBOARD'
    | 'LOCAL_STORAGE'
    | 'WORKERS'
    | 'BATTERY_STATUS'
    | 'MATCH_MEDIA'
    | 'GEOLOCATION';

  const Reason: {
    TESTING: 'TESTING';
    AUDIO_PLAYBACK: 'AUDIO_PLAYBACK';
    IFRAME_SCRIPTING: 'IFRAME_SCRIPTING';
    DOM_SCRAPING: 'DOM_SCRAPING';
    BLOBS: 'BLOBS';
    DOM_PARSER: 'DOM_PARSER';
    USER_MEDIA: 'USER_MEDIA';
    DISPLAY_MEDIA: 'DISPLAY_MEDIA';
    WEB_RTC: 'WEB_RTC';
    CLIPBOARD: 'CLIPBOARD';
    LOCAL_STORAGE: 'LOCAL_STORAGE';
    WORKERS: 'WORKERS';
    BATTERY_STATUS: 'BATTERY_STATUS';
    MATCH_MEDIA: 'MATCH_MEDIA';
    GEOLOCATION: 'GEOLOCATION';
  };

  interface CreateParameters {
    url: string;
    reasons: Reason[];
    justification: string;
  }

  function createDocument(parameters: CreateParameters): Promise<void>;
  function closeDocument(): Promise<void>;
  function hasDocument(): Promise<boolean>;
}

declare namespace chrome.runtime {
  type ContextType =
    | 'TAB'
    | 'POPUP'
    | 'BACKGROUND'
    | 'OFFSCREEN_DOCUMENT'
    | 'SIDE_PANEL';

  const ContextType: {
    TAB: 'TAB';
    POPUP: 'POPUP';
    BACKGROUND: 'BACKGROUND';
    OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT';
    SIDE_PANEL: 'SIDE_PANEL';
  };

  interface ContextFilter {
    contextTypes?: ContextType[];
    documentUrls?: string[];
    documentIds?: string[];
    windowIds?: number[];
    tabIds?: number[];
    incognito?: boolean;
  }

  interface ExtensionContext {
    contextType: ContextType;
    contextId: string;
    documentUrl?: string;
    documentId?: string;
    windowId?: number;
    tabId?: number;
    frameId?: number;
    incognito: boolean;
    documentLifecycle?: 'prerender' | 'active' | 'cached' | 'pending_deletion';
    documentOrigin?: string;
  }

  function getContexts(filter: ContextFilter): Promise<ExtensionContext[]>;
}
