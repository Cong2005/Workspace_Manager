
chrome.runtime.onInstalled.addListener(() => {
  console.log('Workspace Manager installed!');

  chrome.storage.local.set({
    appInitialized: true,
  });
});
