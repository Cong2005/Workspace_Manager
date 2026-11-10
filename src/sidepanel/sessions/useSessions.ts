import { useCallback, useEffect, useRef, useState } from 'react';
import { SESSION_KEY_PREFIX } from '../../services/sessionService';
import { restoreSession, type RestoreOptions } from '../../services/sessionRestore';
import type { CaptureResult, RestoreResult, SavedSession } from '../../types/session';
import { sendSessionCommand } from './sessionClient';

export function useSessions() {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const requestId = useRef(0);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const response = await sendSessionCommand({ scope: 'session', action: 'getAll' });
      if (response.action !== 'getAll') throw new Error('Unexpected session response.');
      if (mounted.current && request === requestId.current) {
        setSessions(response.sessions);
        setError(null);
      }
    } catch (cause) {
      if (mounted.current && request === requestId.current) {
        setError(cause instanceof Error ? cause.message : 'Could not load sessions.');
      }
    } finally {
      if (mounted.current && request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const sequence = requestId;
    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && Object.keys(changes).some((key) => key.startsWith(SESSION_KEY_PREFIX))) {
        void load();
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    queueMicrotask(() => { if (mounted.current) void load(); });
    return () => {
      mounted.current = false;
      sequence.current++;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [load]);

  const create = useCallback(async (name: string, windowId: number, workspaceId?: string): Promise<CaptureResult | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await sendSessionCommand({ scope: 'session', action: 'create', name, windowId, workspaceId });
      if (response.action !== 'create') throw new Error('Unexpected session response.');
      if (mounted.current) void load();
      return response.capture;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not save session.');
      return null;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [load]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await sendSessionCommand({ scope: 'session', action: 'delete', id });
      if (response.action !== 'delete') throw new Error('Unexpected session response.');
      if (mounted.current) void load();
      return true;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not delete session.');
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [load]);

  const restore = useCallback(async (session: SavedSession, options: RestoreOptions): Promise<RestoreResult | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      return await restoreSession(session, options);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not restore session.');
      return null;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { sessions, loading, busy, error, create, remove, restore, retry };
}
