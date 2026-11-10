export type OpenTab = chrome.tabs.Tab & { id: number };

export async function getCurrentWindowId(): Promise<number> {
  const window = await chrome.windows.getCurrent();
  if (window.id === undefined) {
    throw new Error('Cannot identify the current Chrome window.');
  }
  return window.id;
}

export async function getWindowTabs(windowId: number): Promise<OpenTab[]> {
  const tabs = await chrome.tabs.query({ windowId });
  return tabs
    .filter((tab): tab is OpenTab => tab.id !== undefined)
    .sort((a, b) => a.index - b.index);
}

export async function activateTab(tabId: number): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
}

export async function closeTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId);
}

export async function tabStillExists(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

export function getTabLocation(url?: string): string {
  if (!url) return 'URL unavailable';

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.hostname || url
      : url;
  } catch {
    return url;
  }
}

export function filterTabs(tabs: OpenTab[], query: string): OpenTab[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return tabs;

  return tabs.filter((tab) =>
    [tab.title, tab.url, getTabLocation(tab.url)].some((value) =>
      value?.toLocaleLowerCase().includes(term),
    ),
  );
}
