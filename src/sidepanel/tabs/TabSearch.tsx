import { Search } from 'lucide-react';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function TabSearch({ value, onChange }: Props) {
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
      <Search size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
      <span className="sr-only">Search open tabs</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search tabs..."
        className="min-w-0 w-full bg-transparent text-sm outline-none"
      />
    </label>
  );
}
