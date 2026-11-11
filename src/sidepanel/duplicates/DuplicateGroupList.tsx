import type { DuplicateGroup } from './duplicateDetection';

export function DuplicateGroupList({ groups, keepers, onKeeperChange }: {
  groups: DuplicateGroup[];
  keepers: Record<string, number>;
  onKeeperChange: (url: string, id: number) => void;
}) {
  return <div className="mt-3 space-y-3">{groups.map((group) => {
    const selectedId = group.tabs.some((tab) => tab.id === keepers[group.url])
      ? keepers[group.url] : group.defaultKeeperId;
    return <div key={group.url} className="min-w-0 rounded-lg border border-gray-200 p-3">
      <p className="truncate text-xs font-semibold text-blue-700" title={group.url}>{group.url}</p>
      <ul className="mt-2 space-y-2">{group.tabs.map((tab) => <li key={tab.id}>
        <label className="flex min-w-0 items-start gap-2 text-sm">
          <input type="radio" name={`keeper-${group.url}`} checked={selectedId === tab.id}
            onChange={() => onKeeperChange(group.url, tab.id)} className="mt-1 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{tab.title || 'Untitled tab'}</span>
            <span className="block truncate text-xs text-gray-500" title={tab.url}>{tab.url}</span>
            <span className="block text-xs text-gray-600">
              {tab.pinned ? 'Pinned · ' : ''}{tab.active ? 'Active · ' : ''}{tab.audible ? 'Playing audio · ' : ''}
              {selectedId === tab.id ? 'Keep' : 'Duplicate'}
            </span>
          </span>
        </label>
      </li>)}</ul>
    </div>;
  })}</div>;
}
