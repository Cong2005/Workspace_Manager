import type { GroupRule, GroupRuleCommand, GroupRuleResponse } from '../../types/groupRule';

export async function sendGroupRuleCommand(command: GroupRuleCommand): Promise<GroupRule[]> {
  const response: GroupRuleResponse | undefined = await chrome.runtime.sendMessage(command);
  if (!response) throw new Error('Grouping rule service is unavailable. Reload the extension.');
  if (!response.ok) throw new Error(response.error);
  return response.rules;
}
