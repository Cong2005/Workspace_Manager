import { useState } from 'react';
import type { CleanupPreview } from './duplicateCleanup';

export function CleanupConfirmation({ preview, busy, onCancel, onConfirm }: {
  preview: CleanupPreview;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const protectedTargets = preview.groups.some((group) =>
    group.toClose.some((tab) => tab.pinned || tab.active || tab.audible));

  return <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
    <h3 className="font-semibold">Review before closing {preview.closeCount} tab(s)</h3>
    <p className="mt-1 text-xs text-amber-900">Closing a tab can lose unsaved work. Check every page below.</p>
    {preview.closeCount === 0 && <p className="mt-2 text-xs text-amber-900">
      No tabs are eligible to close. Pinned duplicates are protected by default.
    </p>}
    {preview.groups.map((group) => <div key={group.url} className="mt-3 min-w-0">
      <p className="truncate text-xs font-medium" title={group.url}>{group.url}</p>
      <p className="truncate text-xs text-green-800">Keep: {group.keeper.title}</p>
      <ul className="mt-1 space-y-1">{group.toClose.map((tab) => <li key={tab.id} className="text-xs text-red-800">
        <span className="block truncate">Close: {tab.title}</span>
        <span className="block truncate" title={tab.url}>{tab.url}</span>
        {(tab.pinned || tab.active || tab.audible) && <strong className="block">
          {tab.pinned ? 'Pinned · ' : ''}{tab.active ? 'Active · ' : ''}{tab.audible ? 'Playing audio' : ''}
        </strong>}
      </li>)}</ul>
    </div>)}
    {protectedTargets && <label className="mt-3 flex items-start gap-2 text-xs font-medium text-red-800">
      <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
      I understand that active, pinned, or audio tabs may be closed.
    </label>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={onCancel}
        className="rounded-lg border px-3 py-2 text-sm">Cancel</button>
      {preview.closeCount > 0 && <button type="button" disabled={busy || (protectedTargets && !acknowledged)}
        onClick={onConfirm} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">
        Confirm Cleanup
      </button>}
    </div>
  </div>;
}
