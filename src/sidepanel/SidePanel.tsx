
import {
  Folder,
  LayoutDashboard,
  Settings,
  Clock,
} from 'lucide-react';

function SidePanel() {
  return (
    <div className="min-h-screen p-5">
      <h1 className="mb-6 text-xl font-bold">
        Workspace Manager
      </h1>

      <nav className="space-y-2">
        <button className="flex w-full items-center gap-3 rounded-lg bg-blue-100 p-3 text-blue-700">
          <LayoutDashboard size={20} />
          Dashboard
        </button>

        <button className="flex w-full items-center gap-3 rounded-lg p-3 hover:bg-gray-200">
          <Folder size={20} />
          Workspaces
        </button>

        <button className="flex w-full items-center gap-3 rounded-lg p-3 hover:bg-gray-200">
          <Clock size={20} />
          Sessions
        </button>

        <button className="flex w-full items-center gap-3 rounded-lg p-3 hover:bg-gray-200">
          <Settings size={20} />
          Settings
        </button>
      </nav>

      <div className="mt-8 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">My Workspace</h2>
        <p className="mt-2 text-sm text-gray-500">
          No workspace created yet.
        </p>
      </div>
    </div>
  );
}

export default SidePanel;
