import { useRef, useState, type FormEvent } from 'react';
import { GROUP_COLORS, type GroupColor, type GroupRuleInput } from '../../types/groupRule';
import { buildGroupingPreview, applyGroupingPreview, groupSelectedTabs, type GroupingPreview } from '../../services/tabGroupingService';
import { getCurrentWindowId, getWindowTabs, type OpenTab } from '../tabs/tabsService';
import { sendGroupRuleCommand } from './groupRuleClient';
import { useGroupRules } from './useGroupRules';

const emptyRule: GroupRuleInput = { name: '', groupTitle: '', domain: '', color: 'blue' };

export function GroupingPanel({ tabs, selectedIds, clearSelection }: {
  tabs: OpenTab[];
  selectedIds: Set<number>;
  clearSelection: () => void;
}) {
  const { rules, loading, busy: rulesBusy, error: rulesError, mutate, retry } = useGroupRules();
  const [manualTitle, setManualTitle] = useState('');
  const [manualColor, setManualColor] = useState<GroupColor>('blue');
  const [form, setForm] = useState<GroupRuleInput>(emptyRule);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ windowId: number; plan: GroupingPreview } | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workingRef = useRef(false);
  const selectedInWindow = tabs.filter((tab) => selectedIds.has(tab.id) && !tab.pinned).map((tab) => tab.id);

  const run = async (operation: () => Promise<void>) => {
    if (workingRef.current) return;
    workingRef.current = true;
    setWorking(true);
    setError(null);
    setMessage(null);
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chrome grouping failed.'); }
    finally { workingRef.current = false; setWorking(false); }
  };

  const groupManual = () => { void run(async () => {
    const windowId = await getCurrentWindowId();
    const outcome = await groupSelectedTabs(windowId, selectedInWindow, manualTitle, manualColor);
    clearSelection();
    setMessage(outcome.groupedTabs === 0
      ? 'Selected tabs are already in this group.'
      : `Grouped ${outcome.groupedTabs} tab(s) into ${manualTitle.trim()}.`);
  }); };

  const saveRule = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await mutate(editingId
      ? { scope: 'groupRule', action: 'update', id: editingId, input: form }
      : { scope: 'groupRule', action: 'create', input: form });
    if (ok) { setForm(emptyRule); setEditingId(null); setPreview(null); }
  };

  const deleteRule = async (id: string) => {
    if (await mutate({ scope: 'groupRule', action: 'delete', id })) {
      setConfirmDeleteId(null);
      setPreview(null);
      if (editingId === id) { setEditingId(null); setForm(emptyRule); }
    }
  };

  const previewRules = () => { void run(async () => {
    const windowId = await getCurrentWindowId();
    const [freshTabs, freshRules, existingGroups] = await Promise.all([
      getWindowTabs(windowId), sendGroupRuleCommand({ scope: 'groupRule', action: 'getAll' }),
      chrome.tabGroups.query({ windowId }),
    ]);
    const plan = buildGroupingPreview(freshTabs, freshRules, existingGroups);
    setPreview({ windowId, plan });
    if (plan.matchingTabs === 0) setMessage('No open tabs match the saved rules.');
  }); };

  const applyRules = () => { if (!preview) return; void run(async () => {
    const freshRules = await sendGroupRuleCommand({ scope: 'groupRule', action: 'getAll' });
    const result = await applyGroupingPreview(preview.windowId, preview.plan, freshRules);
    setPreview(null);
    setMessage(`Grouped ${result.groupedTabs} tab(s); created ${result.createdGroups}, reused ${result.reusedGroups} group(s).`);
    if (result.failedGroups.length) {
      setError(result.failedGroups.map((item) => `${item.title}: ${item.message}`).join(' '));
    }
  }); };

  return <section className="mt-6 min-w-0 space-y-5" aria-labelledby="grouping-heading">
    <h2 id="grouping-heading" className="font-semibold">Tab Groups</h2>
    {(error || rulesError) && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
      <p>{error || rulesError}</p>
      {rulesError && <button type="button" onClick={retry} className="mt-1 underline">Try again</button>}
    </div>}
    {message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}

    <div className="rounded-xl border bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold">Group selected tabs ({selectedInWindow.length})</h3>
      <div className="space-y-2">
        <label className="block text-xs">Group name
          <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} maxLength={60}
            className="mt-1 w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs">Color
          <select value={manualColor} onChange={(event) => setManualColor(event.target.value as GroupColor)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            {GROUP_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
          </select>
        </label>
        <button type="button" onClick={groupManual} disabled={working || !selectedInWindow.length || !manualTitle.trim()}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          Group Selected
        </button>
      </div>
    </div>

    <div className="rounded-xl border bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold">Domain rules</h3>
      <p className="mb-3 text-xs text-gray-500">Oldest matching rule wins. Rules sharing a group name use the oldest applicable rule's color.</p>
      <form onSubmit={(event) => { void saveRule(event); }} className="space-y-2">
        <label className="block text-xs">Rule name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={60} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs">Domain (for example, github.com)
          <input value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs">Destination group
          <input value={form.groupTitle} onChange={(event) => setForm({ ...form, groupTitle: event.target.value })}
            maxLength={60} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs">Color
          <select value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value as GroupColor })}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            {GROUP_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={rulesBusy || !form.name.trim() || !form.domain.trim() || !form.groupTitle.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {editingId ? 'Save rule' : 'Add rule'}
          </button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyRule); }}
            className="rounded-lg border px-3 py-2 text-sm">Cancel</button>}
        </div>
      </form>
      {loading ? <p className="mt-3 text-sm text-gray-500">Loading rules...</p> : rules.length === 0 ?
        <p className="mt-3 text-sm text-gray-500">No rules saved yet.</p> :
        <ul className="mt-4 space-y-2">{rules.map((rule, index) => <li key={rule.id} className="rounded-lg border p-3 text-sm">
          <p className="truncate font-medium">{index + 1}. {rule.name}</p>
          <p className="truncate text-xs text-gray-500">{rule.domain} → {rule.groupTitle} · {rule.color}</p>
          {confirmDeleteId === rule.id ? <div className="mt-2 flex gap-3 text-xs text-red-700">
            <button type="button" disabled={rulesBusy} onClick={() => { void deleteRule(rule.id); }} className="underline">Confirm delete</button>
            <button type="button" onClick={() => setConfirmDeleteId(null)} className="underline">Cancel</button>
          </div> : <div className="mt-2 flex gap-3 text-xs text-blue-700">
            <button type="button" onClick={() => { setEditingId(rule.id); setForm({ name: rule.name, domain: rule.domain, groupTitle: rule.groupTitle, color: rule.color }); }} className="underline">Edit</button>
            <button type="button" onClick={() => setConfirmDeleteId(rule.id)} className="text-red-700 underline">Delete</button>
          </div>}
        </li>)}</ul>}
    </div>

    <div className="rounded-xl border bg-white p-4">
      <button type="button" disabled={working || rulesBusy || loading || rules.length === 0} onClick={previewRules}
        className="rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-700 disabled:opacity-50">
        Preview Grouping
      </button>
      {preview && <div className="mt-3 text-sm">
        <p className="font-semibold">{preview.plan.matchingTabs} match(es); {preview.plan.affectedTabs} tab(s) need moving</p>
        {preview.plan.groups.map((group) => <div key={group.title} className="mt-2 rounded-lg bg-gray-50 p-2">
          <p className="font-medium">{group.title} · {group.color} ({group.matches.length})</p>
          <ul className="mt-1 list-inside list-disc text-xs text-gray-600">{group.matches.map((match) =>
            <li key={match.tabId} className="truncate" title={match.url}>{match.tabTitle} — {match.ruleName}{match.willMove ? '' : ' (already grouped)'}</li>)}</ul>
        </div>)}
        {preview.plan.matchingTabs > 0 && <button type="button" disabled={working || rulesBusy}
          onClick={applyRules} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          Confirm and apply
        </button>}
      </div>}
    </div>
  </section>;
}
