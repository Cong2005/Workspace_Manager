
import {
  Folder,
  LayoutDashboard,
  Settings,
  Clock,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { TabList } from './tabs/TabList';
import { TabSearch } from './tabs/TabSearch';
import { filterTabs } from './tabs/tabsService';
import { useOpenTabs } from './tabs/useOpenTabs';
import { WorkspaceView } from './workspaces/WorkspaceView';
import { SessionView } from './sessions/SessionView';
import { GroupingPanel } from './grouping/GroupingPanel';
import { DuplicatePanel } from './duplicates/DuplicatePanel';

function SidePanel() {
  const [view, setView] = useState<'tabs' | 'workspaces' | 'sessions'>('tabs');
  const [query, setQuery] = useState('');
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
  const { tabs, loading, error, busyTabId, retry, activate, close } = useOpenTabs();
  const visibleTabs = useMemo(() => filterTabs(tabs, query), [tabs, query]);
  const validSelectedIds = useMemo(() => new Set([...selectedTabIds].filter((id) =>
    tabs.some((tab) => tab.id === id && !tab.pinned))), [selectedTabIds, tabs]);
  const toggleTabSelection = (id: number) => setSelectedTabIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="min-h-screen p-5">
      <h1 className="mb-6 text-xl font-bold">
        Workspace Manager
      </h1>

      <nav className="space-y-2">
        <button type="button" onClick={() => setView('tabs')}
          aria-current={view === 'tabs' ? 'page' : undefined}
          className={`flex w-full items-center gap-3 rounded-lg p-3 ${view === 'tabs' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>
          <LayoutDashboard size={20} />
          Dashboard
        </button>

        <button type="button" onClick={() => setView('workspaces')}
          aria-current={view === 'workspaces' ? 'page' : undefined}
          className={`flex w-full items-center gap-3 rounded-lg p-3 ${view === 'workspaces' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>
          <Folder size={20} />
          Workspaces
        </button>

        <button type="button" onClick={() => setView('sessions')}
          aria-current={view === 'sessions' ? 'page' : undefined}
          className={`flex w-full items-center gap-3 rounded-lg p-3 ${view === 'sessions' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>
          <Clock size={20} />
          Sessions
        </button>

        <button type="button" disabled className="flex w-full items-center gap-3 rounded-lg p-3 opacity-50">
          <Settings size={20} />
          Settings
        </button>
      </nav>

      {view === 'tabs' ? <section className="mt-8 min-w-0" aria-labelledby="open-tabs-heading">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="open-tabs-heading" className="font-semibold">Open Tabs</h2>
          <span className="text-xs text-gray-500">{tabs.length}</span>
        </div>
        <TabSearch value={query} onChange={setQuery} />

        {error && (
          <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            <button type="button" onClick={retry} className="mt-2 font-semibold underline">
              Try again
            </button>
          </div>
        )}

        <div className="mt-3" aria-live="polite">
          {loading ? (
            <p className="text-sm text-gray-500">Loading tabs...</p>
          ) : visibleTabs.length > 0 ? (
            <TabList
              tabs={visibleTabs}
              busyTabId={busyTabId}
              onActivate={activate}
              onClose={close}
              selectedIds={validSelectedIds}
              onToggleSelect={toggleTabSelection}
            />
          ) : (
            <p className="rounded-lg border bg-white p-4 text-sm text-gray-500">
              {query.trim() ? 'No tabs match your search.' : 'No open tabs in this window.'}
            </p>
          )}
        </div>
        <DuplicatePanel tabs={tabs} loading={loading} onRefresh={retry} />
        <GroupingPanel tabs={tabs} selectedIds={validSelectedIds}
          clearSelection={() => setSelectedTabIds(new Set())} />
      </section> : view === 'workspaces' ? <WorkspaceView tabs={tabs} /> :
        <SessionView tabs={tabs} tabsLoading={loading} />}
    </div>
  );
}

export default SidePanel;
