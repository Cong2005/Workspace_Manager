import type { SessionCommand, SessionResponse } from '../../types/session';

export async function sendSessionCommand(command: SessionCommand): Promise<SessionResponse & { ok: true }> {
  const response: SessionResponse | undefined = await chrome.runtime.sendMessage(command);
  if (!response) throw new Error('Session service is unavailable. Reload the extension.');
  if (!response.ok) throw new Error(response.error);
  return response;
}
