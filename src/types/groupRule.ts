export const GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'] as const;
export type GroupColor = typeof GROUP_COLORS[number];

export interface GroupRule {
  id: string;
  name: string;
  groupTitle: string;
  domain: string;
  color: GroupColor;
  createdAt: number;
  updatedAt: number;
}

export interface GroupRuleInput {
  name: string;
  groupTitle: string;
  domain: string;
  color: GroupColor;
}

export type GroupRuleCommand =
  | { scope: 'groupRule'; action: 'getAll' }
  | { scope: 'groupRule'; action: 'create'; input: GroupRuleInput }
  | { scope: 'groupRule'; action: 'update'; id: string; input: GroupRuleInput }
  | { scope: 'groupRule'; action: 'delete'; id: string };

export type GroupRuleResponse =
  | { ok: true; rules: GroupRule[] }
  | { ok: false; error: string };
