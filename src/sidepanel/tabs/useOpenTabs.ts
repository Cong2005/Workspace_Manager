import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activateTab as activateChromeTab,
  closeTab as closeChromeTab,
  getCurrentWindowId,
  getWindowTabs,
  tabStillExists,
  type OpenTab,
} from './tabsService';

export function useOpenTabs() {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyTabId, setBusyTabId] = useState<number | null>(null);
  const busyTabIdRef = useRef<number | null>(null);
  const windowId = useRef<number | null>(null);
  const mounted = useRef(false);
  const requestId = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const id = windowId.current ?? await getCurrentWindowId();
      if (!mounted.current || request !== requestId.current) return;
      windowId.current = id;
      const result = await getWindowTabs(id);
      if (mounted.current && request === requestId.current) {
        setTabs(result);
        setLoadError(null);
        setLoading(false);
      }
    } catch {
      if (mounted.current && request === requestId.current) {
        setLoadError('Could not load open tabs. Please try again.');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      setLoading(false);
      return () => { mounted.current = false; };
    }

    const requestSequence = requestId;
    const timer = refreshTimer;
    const scheduleRefresh = () => {
      // Invalidate an in-flight query before waiting for the event burst to settle.
      requestSequence.current++;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void refresh();
      }, 40);
    };
    const belongsToWindow = (id: number) => id === windowId.current;
    const onCreated = (tab: chrome.tabs.Tab) => {
      if (belongsToWindow(tab.windowId)) scheduleRefresh();
    };
    const onRemoved = (_tabId: number, info: chrome.tabs.OnRemovedInfo) => {
      if (belongsToWindow(info.windowId)) scheduleRefresh();
    };
    const onUpdated = (_tabId: number, _change: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (belongsToWindow(tab.windowId)) scheduleRefresh();
    };
    const onActivated = (info: chrome.tabs.OnActivatedInfo) => {
      if (belongsToWindow(info.windowId)) scheduleRefresh();
    };
    const onMoved = (_tabId: number, info: chrome.tabs.OnMovedInfo) => {
      if (belongsToWindow(info.windowId)) scheduleRefresh();
    };
    const onAttached = (_tabId: number, info: chrome.tabs.OnAttachedInfo) => {
      if (belongsToWindow(info.newWindowId)) scheduleRefresh();
    };
    const onDetached = (_tabId: number, info: chrome.tabs.OnDetachedInfo) => {
      if (belongsToWindow(info.oldWindowId)) scheduleRefresh();
    };

    chrome.tabs.onCreated.addListener(onCreated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onMoved.addListener(onMoved);
    chrome.tabs.onAttached.addListener(onAttached);
    chrome.tabs.onDetached.addListener(onDetached);
    void refresh();

    return () => {
      mounted.current = false;
      requestSequence.current++;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      chrome.tabs.onCreated.removeListener(onCreated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onMoved.removeListener(onMoved);
      chrome.tabs.onAttached.removeListener(onAttached);
      chrome.tabs.onDetached.removeListener(onDetached);
    };
  }, [refresh]);

  const retry = useCallback(() => {
    setLoading(true);
    setActionError(null);
    void refresh();
  }, [refresh]);

  const activate = useCallback(async (tabId: number) => {
    const id = windowId.current;
    if (id === null || busyTabIdRef.current !== null) return;
    busyTabIdRef.current = tabId;
    setBusyTabId(tabId);
    setActionError(null);
    try {
      await activateChromeTab(tabId);
    } catch {
      const exists = await tabStillExists(tabId);
      if (mounted.current && exists) {
        setActionError('Could not switch to this tab. Please try again.');
      }
      if (mounted.current) await refresh();
    } finally {
      busyTabIdRef.current = null;
      if (mounted.current) setBusyTabId(null);
    }
  }, [refresh]);

  const close = useCallback(async (tabId: number) => {
    if (windowId.current === null || busyTabIdRef.current !== null) return;
    busyTabIdRef.current = tabId;
    setBusyTabId(tabId);
    setActionError(null);
    try {
      await closeChromeTab(tabId);
      if (mounted.current) await refresh();
    } catch {
      const exists = await tabStillExists(tabId);
      if (mounted.current && exists) {
        setActionError('Could not close this tab. Please try again.');
      }
      if (mounted.current) await refresh();
    } finally {
      busyTabIdRef.current = null;
      if (mounted.current) setBusyTabId(null);
    }
  }, [refresh]);

  return { tabs, loading, error: actionError ?? loadError, busyTabId, retry, activate, close };
}
