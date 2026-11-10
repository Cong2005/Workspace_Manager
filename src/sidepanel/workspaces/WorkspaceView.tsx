import { useState } from 'react';
import type { PageInput } from '../../types/workspace';
import type { OpenTab } from '../tabs/tabsService';
import { WorkspaceDetail } from './WorkspaceDetail';
import { WorkspaceList } from './WorkspaceList';
import { useWorkspaces } from './useWorkspaces';

export function WorkspaceView({ tabs }: { tabs: OpenTab[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { workspaces, loading, saving, error, retry, mutate } = useWorkspaces();
  const selected = workspaces.find((workspace) => workspace.id === selectedId);

  const create = async (name: string) => {
    const result = await mutate({ scope: 'workspace', action: 'create', name });
    if (!result) return false;
    setSelectedId(result.at(-1)?.id ?? null);
    return true;
  };

  const rename = async (name: string) => Boolean(await mutate({
    scope: 'workspace', action: 'rename', workspaceId: selectedId!, name,
  }));

  const remove = async () => {
    const result = await mutate({ scope: 'workspace', action: 'delete', workspaceId: selectedId! });
    if (!result) return false;
    setSelectedId(null);
    return true;
  };

  const addPage = async (page: PageInput) => Boolean(await mutate({
    scope: 'workspace', action: 'addPage', workspaceId: selectedId!, page,
  }));

  const removePage = async (pageId: string) => Boolean(await mutate({
    scope: 'workspace', action: 'removePage', workspaceId: selectedId!, pageId,
  }));

  return (
    <div className="mt-8 min-w-0">
      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={retry} className="mt-2 font-semibold underline">Try again</button>
        </div>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Loading workspaces...</p>
      ) : (
        <>
          <WorkspaceList workspaces={workspaces} selectedId={selectedId} saving={saving}
            onSelect={setSelectedId} onCreate={create} />
          {selected && <WorkspaceDetail key={`${selected.id}:${selected.name}`} workspace={selected}
            tabs={tabs} saving={saving} onRename={rename} onDelete={remove}
            onAddPage={addPage} onRemovePage={removePage} />}
        </>
      )}
    </div>
  );
}
