/**
 * Ask Elara - Popup Launcher Script
 * Opens sidepanel and handles quick actions
 */

// Open sidepanel button
document.getElementById('openSidepanel')?.addEventListener('click', async () => {
  try {
    // Get the current window to open sidepanel in
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  } catch (error) {
    console.error('Failed to open sidepanel:', error);
    // Fallback: try opening without windowId
    try {
      await (chrome.sidePanel as any).open({});
      window.close();
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
  }
});

// Scan page button - opens sidepanel with scan action
document.getElementById('scanPage')?.addEventListener('click', async () => {
  try {
    // Store pending action for sidepanel to pick up
    await chrome.storage.local.set({ pendingQuickAction: 'scan' });

    // Open sidepanel
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  } catch (error) {
    console.error('Failed to open sidepanel with scan:', error);
  }
});

// Help button - opens sidepanel with help action
document.getElementById('quickHelp')?.addEventListener('click', async () => {
  try {
    // Store pending action for sidepanel to pick up
    await chrome.storage.local.set({ pendingQuickAction: 'help' });

    // Open sidepanel
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  } catch (error) {
    console.error('Failed to open sidepanel with help:', error);
  }
});
