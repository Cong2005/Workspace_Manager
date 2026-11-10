import { useState } from 'react';
import { Globe2, X } from 'lucide-react';
import { getTabLocation, type OpenTab } from './tabsService';
import { tabRowActions } from './tabRowActions';

type Props = {
  tabs: OpenTab[];
  busyTabId: number | null;
  onActivate: (tabId: number) => void;
  onClose: (tabId: number) => void;
  selectedIds: Set<number>;
  onToggleSelect: (tabId: number) => void;
};

function TabIcon({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return <Globe2 size={18} className="shrink-0 text-gray-400" aria-hidden="true" />;
  }

  return (
    <img
      src={url}
      alt=""
      width={18}
      height={18}
      className="h-[18px] w-[18px] shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function TabList({ tabs, busyTabId, onActivate, onClose, selectedIds, onToggleSelect }: Props) {
  return (
    <ul className="space-y-2">
      {tabs.map((tab) => {
        const actions = tabRowActions(tab.id, { onActivate, onClose, onToggleSelect });
        return (
          <li
          key={tab.id}
          className={`flex min-w-0 items-center gap-1 rounded-lg border p-1 ${
            tab.active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
          }`}
        >
          <label className="shrink-0 p-2" title={tab.pinned ? 'Pinned tabs cannot be grouped' : 'Select for grouping'}>
            <span className="sr-only">Select {tab.title || 'untitled tab'} for grouping</span>
            <input type="checkbox" checked={selectedIds.has(tab.id)} disabled={Boolean(tab.pinned)}
              onClick={actions.selectClick} onChange={actions.selectChange} />
          </label>
          <button
            type="button"
            onClick={actions.activate}
            disabled={busyTabId !== null}
            aria-current={tab.active ? 'page' : undefined}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-left hover:bg-gray-100 disabled:cursor-wait"
            title={tab.title || tab.url || 'Untitled tab'}
          >
            <TabIcon key={tab.favIconUrl || ''} url={tab.favIconUrl} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-900">
                {tab.title || 'Untitled tab'}
              </span>
              <span className="block truncate text-xs text-gray-500">
                {getTabLocation(tab.url)}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={actions.close}
            disabled={busyTabId !== null}
            aria-label={`Close ${tab.title || 'untitled tab'}`}
            title="Close tab"
            className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-900 disabled:cursor-wait"
          >
            <X size={16} aria-hidden="true" />
          </button>
          </li>
        );
      })}
    </ul>
  );
}
