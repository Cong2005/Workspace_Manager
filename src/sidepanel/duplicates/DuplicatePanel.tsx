import { useMemo, useRef, useState } from 'react';
import type { OpenTab } from '../tabs/tabsService';
import { getCurrentWindowId } from '../tabs/tabsService';
import { cleanupDuplicates, currentDuplicateSummary, makeCleanupPreview,
  type CleanupPreview, type CleanupResult } from './duplicateCleanup';
import { DuplicateGroupList } from './DuplicateGroupList';
import { CleanupConfirmation } from './CleanupConfirmation';

export function DuplicatePanel({ tabs, loading, onRefresh }: {
  tabs: OpenTab[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const summary = useMemo(() => currentDuplicateSummary(tabs), [tabs]);
  const [keepers, setKeepers] = useState<Record<string, number>>({});
  const [allowPinnedClose, setAllowPinnedClose] = useState(false);
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const startPreview = async () => {
    setError(null);
    setResult(null);
    try {
      const windowId = await getCurrentWindowId();
      setPreview(makeCleanupPreview(windowId, summary.groups, keepers, allowPinnedClose));
    } catch {
      setError('Could not identify this Chrome window. Please try again.');
    }
  };

  const confirm = async () => {
    if (!preview || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const outcome = await cleanupDuplicates(preview);
      setResult(outcome);
      setPreview(null);
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not clean up duplicate tabs.');
      setPreview(null);
      onRefresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <section className="mt-6 min-w-0 rounded-xl border bg-white p-4" aria-labelledby="duplicates-heading">
    <h2 id="duplicates-heading" className="font-semibold">Duplicate Tabs</h2>
    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-lg bg-gray-50 p-2"><strong className="block text-base">{summary.totalTabs}</strong>Open tabs</div>
      <div className="rounded-lg bg-gray-50 p-2"><strong className="block text-base">{summary.groups.length}</strong>Duplicate groups</div>
      <div className="rounded-lg bg-gray-50 p-2"><strong className="block text-base">{summary.redundantTabs}</strong>Extra tabs</div>
    </div>
    {loading ? <p className="mt-3 text-sm text-gray-500">Checking tabs...</p> : summary.groups.length === 0 ?
      <p className="mt-3 text-sm text-gray-500">No duplicate HTTP or HTTPS URLs in this window.</p> : <>
        <p className="mt-3 text-xs text-gray-600">Choose one tab to keep per URL. Pinned tabs stay open unless explicitly allowed below.</p>
        <DuplicateGroupList groups={summary.groups} keepers={keepers}
          onKeeperChange={(url, id) => {
            setKeepers((current) => ({ ...current, [url]: id }));
            setPreview(null);
          }} />
        <label className="mt-3 flex items-start gap-2 text-xs text-red-700">
          <input type="checkbox" checked={allowPinnedClose}
            onChange={(event) => { setAllowPinnedClose(event.target.checked); setPreview(null); }} />
          Allow closing pinned duplicates after confirmation
        </label>
        {!preview && <button type="button" disabled={busy} onClick={() => { void startPreview(); }}
          className="mt-3 rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-700 disabled:opacity-50">
          Preview Cleanup
        </button>}
      </>}

    {preview && <CleanupConfirmation preview={preview} busy={busy}
      onCancel={() => setPreview(null)} onConfirm={() => { void confirm(); }} />}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {result && <div role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
      Closed: {result.closed}; failed: {result.failed}; skipped: {result.skipped}.
      {result.needsRepreview && <span className="block">Tabs changed. Preview again before further cleanup.</span>}
      {result.errors.length > 0 && <span className="block">{result.errors.join(' ')}</span>}
    </div>}
  </section>;
}
