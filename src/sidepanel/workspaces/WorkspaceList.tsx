import { useState, type FormEvent } from 'react';
import { Folder, Plus } from 'lucide-react';
import type { Workspace } from '../../types/workspace';
import { MAX_WORKSPACE_NAME_LENGTH } from '../../services/workspaceService';

type Props = {
  workspaces: Workspace[];
  selectedId: string | null;
  saving: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<boolean>;
};

export function WorkspaceList({ workspaces, selectedId, saving, onSelect, onCreate }: Props) {
  const [name, setName] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onCreate(name)) setName('');
  };

  return (
    <section className="min-w-0" aria-labelledby="workspace-list-heading">
      <h2 id="workspace-list-heading" className="mb-3 font-semibold">Workspaces</h2>
      <form onSubmit={(event) => { void submit(event); }} className="flex min-w-0 gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">New workspace name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_WORKSPACE_NAME_LENGTH}
            placeholder="New workspace name"
            className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button type="submit" disabled={saving || !name.trim()} aria-label="Create workspace"
          className="rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-50">
          <Plus size={18} aria-hidden="true" />
        </button>
      </form>

      {workspaces.length === 0 ? (
        <p className="mt-4 rounded-lg border bg-white p-4 text-sm text-gray-500">
          No workspaces yet. Create one to save pages for later.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <button type="button" onClick={() => onSelect(workspace.id)}
                aria-current={workspace.id === selectedId ? 'true' : undefined}
                className={`flex w-full min-w-0 items-center gap-3 rounded-lg border p-3 text-left hover:bg-blue-50 ${
                  workspace.id === selectedId ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
                }`}>
                <Folder size={18} className="shrink-0 text-blue-600" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{workspace.name}</span>
                <span className="shrink-0 text-xs text-gray-500">{workspace.pages.length} pages</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
