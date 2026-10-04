// FlowTask Content Script
// Bridges capture events from the Chrome Extension popup to the active FlowTask web application window.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'FLOWTASK_EXTERNAL_CAPTURE') {
    window.postMessage(message, '*');
    sendResponse({ status: 'received', timestamp: Date.now() });
  }
  return true;
});
