type TabRowCallbacks = {
  onActivate: (tabId: number) => void;
  onClose: (tabId: number) => void;
  onToggleSelect: (tabId: number) => void;
};

export function tabRowActions(tabId: number, callbacks: TabRowCallbacks) {
  return {
    activate: () => callbacks.onActivate(tabId),
    close: (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      callbacks.onClose(tabId);
    },
    selectClick: (event: { stopPropagation: () => void }) => event.stopPropagation(),
    selectChange: () => callbacks.onToggleSelect(tabId),
  };
}
