import { useCallback, useEffect, useRef, useState } from 'react';
import { GROUP_RULE_KEY_PREFIX } from '../../services/groupRuleService';
import type { GroupRule, GroupRuleCommand } from '../../types/groupRule';
import { sendGroupRuleCommand } from './groupRuleClient';

export function useGroupRules() {
  const [rules, setRules] = useState<GroupRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const requestId = useRef(0);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const result = await sendGroupRuleCommand({ scope: 'groupRule', action: 'getAll' });
      if (mounted.current && request === requestId.current) {
        setRules(result);
        setError(null);
      }
    } catch (cause) {
      if (mounted.current && request === requestId.current) {
        setError(cause instanceof Error ? cause.message : 'Could not load grouping rules.');
      }
    } finally {
      if (mounted.current && request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (typeof chrome === 'undefined' || !chrome.storage) {
      setLoading(false);
      return () => { mounted.current = false; };
    }

    const sequence = requestId;
    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && Object.keys(changes).some((key) => key.startsWith(GROUP_RULE_KEY_PREFIX))) {
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

  const mutate = useCallback(async (command: GroupRuleCommand): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await sendGroupRuleCommand(command);
      if (mounted.current) {
        setRules(result);
        void load();
      }
      return true;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not save grouping rule.');
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [load]);

  const retry = useCallback(() => { setLoading(true); void load(); }, [load]);
  return { rules, loading, busy, error, mutate, retry };
}
