import { useCallback, useEffect, useRef, useState } from 'react';
import { WORKSPACES_KEY } from '../../services/workspaceService';
import type { Workspace, WorkspaceCommand } from '../../types/workspace';
import { sendWorkspaceCommand } from './workspaceClient';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const mounted = useRef(false);
  const requestId = useRef(0);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const result = await sendWorkspaceCommand({ scope: 'workspace', action: 'get' });
      if (mounted.current && request === requestId.current) {
        setWorkspaces(result);
        setLoadError(null);
      }
    } catch (cause) {
      if (mounted.current && request === requestId.current) {
        setLoadError(cause instanceof Error ? cause.message : 'Could not load workspaces.');
      }
    } finally {
      if (mounted.current && request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const sequence = requestId;
    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && WORKSPACES_KEY in changes) void load();
    };
    chrome.storage.onChanged.addListener(onChanged);
    queueMicrotask(() => { if (mounted.current) void load(); });
    return () => {
      mounted.current = false;
      sequence.current++;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [load]);

  const mutate = useCallback(async (command: WorkspaceCommand): Promise<Workspace[] | null> => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    setActionError(null);
    try {
      const result = await sendWorkspaceCommand(command);
      if (mounted.current) {
        setWorkspaces(result);
        void load();
      }
      return result;
    } catch (cause) {
      if (mounted.current) {
        setActionError(cause instanceof Error ? cause.message : 'Could not save workspace.');
        void load();
      }
      return null;
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    setActionError(null);
    void load();
  }, [load]);

  return { workspaces, loading, saving, error: actionError ?? loadError, retry, mutate };
}
