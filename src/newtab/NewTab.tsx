
import { Search, Folder } from 'lucide-react';

function NewTab() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <Folder size={48} className="mb-4 text-blue-600" />

      <h1 className="text-3xl font-bold">
        Workspace Manager
      </h1>

      <p className="mt-2 text-gray-500">
        Organize your browsing experience.
      </p>

      <div className="mt-8 flex w-full max-w-xl items-center gap-3 rounded-xl border bg-white px-5 py-4 shadow-sm">
        <Search size={20} className="text-gray-400" />

        <input
          type="text"
          placeholder="Search your workspace..."
          className="w-full outline-none"
        />
      </div>
    </main>
  );
}

export default NewTab;
