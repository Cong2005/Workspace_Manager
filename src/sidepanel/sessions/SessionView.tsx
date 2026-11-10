import { useMemo, useState, type FormEvent } from 'react';
import { Clock, ExternalLink, Trash2 } from 'lucide-react';
import { assessTabs, MAX_SESSION_NAME_LENGTH } from '../../services/sessionService';
import { getCurrentWindowId } from '../tabs/tabsService';
import type { OpenTab } from '../tabs/tabsService';
import type { CaptureResult, RestoreResult } from '../../types/session';
import { useWorkspaces } from '../workspaces/useWorkspaces';
import { useSessions } from './useSessions';

export function SessionView({ tabs, tabsLoading }: { tabs: OpenTab[]; tabsLoading: boolean }) {
  const { sessions, loading, busy, error, create, remove, restore, retry } = useSessions();
  const { workspaces, error: workspaceError } = useWorkspaces();
  const [name, setName] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newWindow, setNewWindow] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const preview = useMemo(() => assessTabs(tabs), [tabs]);
  const selected = sessions.find((session) => session.id === selectedId);
  const linkedWorkspaceId = workspaces.some((workspace) => workspace.id === workspaceId) ? workspaceId : '';

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    setCaptureResult(null);
    try {
      const windowId = await getCurrentWindowId();
      const result = await create(name, windowId, linkedWorkspaceId || undefined);
      if (result) {
        setCaptureResult(result);
        setSelectedId(result.session.id);
        setName('');
      }
    } catch {
      setLocalError('Could not identify this Chrome window. Please try again.');
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    if (await remove(selected.id)) {
      setSelectedId(null);
      setConfirmDelete(false);
      setRestoreResult(null);
    }
  };

  const restoreSelected = async () => {
    if (!selected) return;
    setRestoreResult(null);
    const result = await restore(selected, { target: newWindow ? 'new' : 'current', skipDuplicates });
    if (result) setRestoreResult(result);
  };

  return (
    <div className="mt-8 min-w-0">
      <h2 className="mb-3 font-semibold">Sessions</h2>
      {(error || localError) && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <p>{localError || error}</p>
          <button type="button" onClick={retry} className="mt-2 font-semibold underline">Try again</button>
        </div>
      )}
      {workspaceError && <p role="status" className="mb-3 text-xs text-amber-700">
        Workspace links are unavailable: {workspaceError}
      </p>}

      <form onSubmit={(event) => { void save(event); }} className="space-y-3 rounded-xl border bg-white p-4">
        <h3 className="text-sm font-semibold">Save current window</h3>
        <label className="block text-sm">
          <span className="mb-1 block">Session name</span>
          <input value={name} onChange={(event) => setName(event.target.value)}
            maxLength={MAX_SESSION_NAME_LENGTH} placeholder="e.g. Research today"
            className="w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Related workspace (optional)</span>
          <select value={linkedWorkspaceId} onChange={(event) => setWorkspaceId(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <option value="">No workspace</option>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </label>
        <p className="text-xs text-gray-600">
          {tabsLoading ? 'Checking open tabs...' : `${preview.eligible} pages ready to save; ${
            preview.skipped['Missing URL'] + preview.skipped['Unsupported or private URL']
          } will be skipped.`}
        </p>
        {!tabsLoading && (preview.skipped['Missing URL'] > 0 || preview.skipped['Unsupported or private URL'] > 0) && (
          <p className="text-xs text-amber-700">
            Missing URL: {preview.skipped['Missing URL']}; unsupported or private URL: {preview.skipped['Unsupported or private URL']}.
          </p>
        )}
        <button type="submit" disabled={busy || tabsLoading || !name.trim() || preview.eligible === 0}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Working...' : 'Save session'}
        </button>
      </form>

      {captureResult && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
        Saved {captureResult.session.pages.length} of {captureResult.totalTabs} tabs. Skipped: {captureResult.skipped['Missing URL']} missing URL, {captureResult.skipped['Unsupported or private URL']} unsupported or private URL.
      </p>}

      <h3 className="mt-6 mb-2 text-sm font-semibold">Saved sessions ({sessions.length})</h3>
      {loading ? <p className="text-sm text-gray-500">Loading sessions...</p> : sessions.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-gray-500">No sessions saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const workspace = workspaces.find((item) => item.id === session.workspaceId);
            return <li key={session.id}>
              <button type="button" onClick={() => { setSelectedId(session.id); setConfirmDelete(false); setRestoreResult(null); }}
                aria-current={session.id === selectedId ? 'true' : undefined}
                aria-label={`View details for ${session.name}`}
                className={`flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left hover:bg-blue-50 ${
                  session.id === selectedId ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
                }`}>
                <Clock size={18} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{session.name}</span>
                  <span className="block text-xs text-gray-500">{new Date(session.createdAt).toLocaleString('vi-VN')} · {session.pages.length} pages</span>
                  {session.workspaceId && <span className="block truncate text-xs text-gray-500">
                    {workspace ? `Workspace: ${workspace.name}` : 'Linked workspace deleted or unavailable'}
                  </span>}
                  <span className="mt-1 block text-xs font-medium text-blue-700">View details</span>
                </span>
              </button>
            </li>;
          })}
        </ul>
      )}

      {selected && <section className="mt-5 min-w-0 rounded-xl border bg-white p-4" aria-label={`Session details: ${selected.name}`}>
        <h3 className="mb-3 truncate font-semibold" title={selected.name}>{selected.name}</h3>
        <ol className="space-y-2">
          {selected.pages.map((page) => <li key={page.id} className="min-w-0 rounded-lg border border-gray-200 p-2">
            <span className="block truncate text-sm font-medium">{page.title}</span>
            <span className="block truncate text-xs text-gray-500" title={page.url}>{page.url}</span>
          </li>)}
        </ol>
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={newWindow} onChange={(event) => setNewWindow(event.target.checked)} />
            Open in a new window
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={skipDuplicates} onChange={(event) => setSkipDuplicates(event.target.checked)} />
            Skip URLs already open in Chrome
          </label>
        </div>
        <button type="button" disabled={busy} onClick={() => { void restoreSelected(); }}
          className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          <ExternalLink size={16} aria-hidden="true" /> {busy ? 'Working...' : 'Restore session'}
        </button>
        {restoreResult && <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          Opened: {restoreResult.opened}; failed: {restoreResult.failed}; skipped duplicates: {restoreResult.skippedDuplicate}; skipped invalid URLs: {restoreResult.skippedInvalid}.
        </p>}
        {confirmDelete ? <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <p>Delete this saved session? Open tabs and workspaces will stay unchanged.</p>
          <div className="mt-2 flex gap-3">
            <button type="button" disabled={busy} onClick={() => { void removeSelected(); }} className="font-semibold underline">Confirm delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="underline">Cancel</button>
          </div>
        </div> : <button type="button" onClick={() => setConfirmDelete(true)}
          className="mt-4 flex items-center gap-2 text-sm text-red-600 hover:underline">
          <Trash2 size={16} aria-hidden="true" /> Delete session
        </button>}
      </section>}
    </div>
  );
}
