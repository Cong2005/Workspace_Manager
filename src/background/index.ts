import {
  addPageToWorkspace,
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  removePageFromWorkspace,
  renameWorkspace,
} from '../services/workspaceService';
import type { Workspace, WorkspaceCommand, WorkspaceResponse } from '../types/workspace';
import { createSession, deleteSession, getSessionById, getSessions } from '../services/sessionService';
import type { SessionCommand, SessionResponse } from '../types/session';
import { createGroupRule, deleteGroupRule, getGroupRules, updateGroupRule } from '../services/groupRuleService';
import type { GroupRuleCommand, GroupRuleResponse } from '../types/groupRule';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Workspace Manager installed!');

  chrome.storage.local.set({
    appInitialized: true,
  });
});

async function handleWorkspaceCommand(message: WorkspaceCommand): Promise<WorkspaceResponse> {
  try {
    let workspaces: Workspace[];
    switch (message.action) {
      case 'get': workspaces = await getWorkspaces(); break;
      case 'create': workspaces = await createWorkspace(message.name); break;
      case 'rename': workspaces = await renameWorkspace(message.workspaceId, message.name); break;
      case 'delete': workspaces = await deleteWorkspace(message.workspaceId); break;
      case 'addPage': workspaces = await addPageToWorkspace(message.workspaceId, message.page); break;
      case 'removePage': workspaces = await removePageFromWorkspace(message.workspaceId, message.pageId); break;
      default: throw new Error('Unknown workspace operation.');
    }
    return { ok: true, workspaces };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Workspace operation failed.' };
  }
}

async function handleSessionCommand(message: SessionCommand): Promise<SessionResponse> {
  try {
    switch (message.action) {
      case 'getAll': return { ok: true, action: 'getAll', sessions: await getSessions() };
      case 'getById': return { ok: true, action: 'getById', session: await getSessionById(message.id) };
      case 'create': return { ok: true, action: 'create',
        capture: await createSession(message.name, message.windowId, message.workspaceId) };
      case 'delete': await deleteSession(message.id); return { ok: true, action: 'delete' };
      default: throw new Error('Unknown session operation.');
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Session operation failed.' };
  }
}

async function handleGroupRuleCommand(message: GroupRuleCommand): Promise<GroupRuleResponse> {
  try {
    switch (message.action) {
      case 'getAll': return { ok: true, rules: await getGroupRules() };
      case 'create': return { ok: true, rules: await createGroupRule(message.input) };
      case 'update': return { ok: true, rules: await updateGroupRule(message.id, message.input) };
      case 'delete': return { ok: true, rules: await deleteGroupRule(message.id) };
      default: throw new Error('Unknown grouping rule operation.');
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Grouping rule operation failed.' };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || typeof message !== 'object' || message === null ||
    !('scope' in message)) return;

  if (message.scope === 'workspace') {
    void handleWorkspaceCommand(message as WorkspaceCommand).then(sendResponse);
    return true;
  }
  if (message.scope === 'session') {
    void handleSessionCommand(message as SessionCommand).then(sendResponse);
    return true;
  }
  if (message.scope === 'groupRule') {
    void handleGroupRuleCommand(message as GroupRuleCommand).then(sendResponse);
    return true;
  }
});
