
import { Folder, PanelRight } from 'lucide-react';

function Popup() {
  const openSidePanel = async () => {
    try {
      await chrome.sidePanel.open({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
      });
    } catch (error) {
      console.error('Cannot open Side Panel:', error);
    }
  };

  return (
    <div className="w-[350px] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-blue-600 p-3 text-white">
          <Folder size={24} />
        </div>

        <div>
          <h1 className="text-lg font-bold">
            Workspace Manager
          </h1>
          <p className="text-xs text-gray-500">
            Manage your browser workspace
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Welcome!</h2>
        <p className="mt-2 text-sm text-gray-500">
          Your workspace management starts here.
        </p>
      </div>

      <button
        onClick={openSidePanel}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
      >
        <PanelRight size={18} />
        Open Side Panel
      </button>
    </div>
  );
}

export default Popup;
