import { useState, type FormEvent } from 'react';
import { ExternalLink, Globe2, Trash2, X } from 'lucide-react';
import { MAX_WORKSPACE_NAME_LENGTH, normalizePageUrl } from '../../services/workspaceService';
import type { Workspace, PageInput, SavedPage } from '../../types/workspace';
import type { OpenTab } from '../tabs/tabsService';

type Props = {
  workspace: Workspace;
  tabs: OpenTab[];
  saving: boolean;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onAddPage: (page: PageInput) => Promise<boolean>;
  onRemovePage: (pageId: string) => Promise<boolean>;
};

function canSave(url?: string): boolean {
  if (!url) return false;
  try { normalizePageUrl(url); return true; } catch { return false; }
}

function SavedPageIcon({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Globe2 size={17} className="shrink-0 text-gray-400" aria-hidden="true" />;
  return <img src={url} alt="" width={17} height={17}
    className="h-[17px] w-[17px] shrink-0 object-contain" onError={() => setFailed(true)} />;
}

export function WorkspaceDetail({ workspace, tabs, saving, onRename, onDelete, onAddPage, onRemovePage }: Props) {
  const [name, setName] = useState(workspace.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedTabId, setSelectedTabId] = useState('');
  const [openError, setOpenError] = useState<string | null>(null);
  const savableTabs = tabs.filter((tab) => canSave(tab.url));
  const selectedTab = savableTabs.find((tab) => String(tab.id) === selectedTabId);

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    if (await onRename(name)) setName(name.trim().replace(/\s+/g, ' '));
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTab?.url) return;
    if (await onAddPage({ title: selectedTab.title, url: selectedTab.url, faviconUrl: selectedTab.favIconUrl })) {
      setSelectedTabId('');
    }
  };

  const openPage = async (page: SavedPage) => {
    setOpenError(null);
    try {
      const window = await chrome.windows.getCurrent();
      if (window.id === undefined) throw new Error('Window unavailable');
      await chrome.tabs.create({ windowId: window.id, url: page.url });
    } catch {
      setOpenError('Could not open the saved page. Please try again.');
    }
  };

  return (
    <section className="mt-6 min-w-0 rounded-xl border bg-white p-4" aria-labelledby="workspace-detail-heading">
      <h2 id="workspace-detail-heading" className="mb-3 truncate font-semibold" title={workspace.name}>
        {workspace.name}
      </h2>
      <form onSubmit={(event) => { void rename(event); }} className="flex min-w-0 gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Rename workspace</span>
          <input value={name} onChange={(event) => setName(event.target.value)}
            maxLength={MAX_WORKSPACE_NAME_LENGTH}
            className="w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <button type="submit" disabled={saving || !name.trim() || name.trim() === workspace.name}
          className="rounded-lg bg-blue-600 px-3 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          Save
        </button>
      </form>

      <div className="mt-3">
        {confirmDelete ? (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>Delete this workspace and its saved pages? Open tabs will stay open.</p>
            <div className="mt-2 flex gap-3">
              <button type="button" disabled={saving} onClick={() => { void onDelete(); }}
                className="font-semibold underline">Confirm delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="underline">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 text-sm text-red-600 hover:underline">
            <Trash2 size={16} aria-hidden="true" /> Delete workspace
          </button>
        )}
      </div>

      <form onSubmit={(event) => { void add(event); }} className="mt-5 space-y-2">
        <label htmlFor="workspace-tab-select" className="block text-sm font-medium">Save an open tab</label>
        <select id="workspace-tab-select" value={selectedTabId}
          onChange={(event) => setSelectedTabId(event.target.value)} disabled={saving || savableTabs.length === 0}
          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
          <option value="">Choose a tab...</option>
          {savableTabs.map((tab) => (
            <option key={tab.id} value={tab.id}>{tab.title || tab.url}</option>
          ))}
        </select>
        {savableTabs.length === 0 && <p className="text-xs text-gray-500">No HTTP or HTTPS tabs are open.</p>}
        <button type="submit" disabled={saving || !selectedTab}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          Save page
        </button>
      </form>

      <h3 className="mt-5 mb-2 text-sm font-semibold">Saved pages ({workspace.pages.length})</h3>
      {openError && <p role="alert" className="mb-2 text-sm text-red-700">{openError}</p>}
      {workspace.pages.length === 0 ? (
        <p className="text-sm text-gray-500">No pages saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {workspace.pages.map((page) => (
            <li key={page.id} className="flex min-w-0 items-center gap-1 rounded-lg border border-gray-200 p-1">
              <button type="button" onClick={() => { void openPage(page); }}
                title={page.url} className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 text-left hover:bg-gray-100">
                <SavedPageIcon key={page.faviconUrl || ''} url={page.faviconUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{page.title}</span>
                  <span className="block truncate text-xs text-gray-500">{page.url}</span>
                </span>
                <ExternalLink size={14} className="shrink-0 text-gray-400" aria-hidden="true" />
              </button>
              <button type="button" disabled={saving} onClick={() => { void onRemovePage(page.id); }}
                aria-label={`Remove ${page.title} from workspace`} title="Remove saved page"
                className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-200 disabled:opacity-50">
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
