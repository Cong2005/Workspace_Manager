import type { WorkspaceCommand, Workspace } from '../../types/workspace';
import type { WorkspaceResponse } from '../../types/workspace';

export async function sendWorkspaceCommand(command: WorkspaceCommand): Promise<Workspace[]> {
  const response: WorkspaceResponse | undefined = await chrome.runtime.sendMessage(command);
  if (!response) throw new Error('Workspace service is unavailable. Reload the extension.');
  if (!response.ok) throw new Error(response.error);
  return response.workspaces;
}
