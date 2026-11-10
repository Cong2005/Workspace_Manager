export interface SavedPage {
  id: string;
  title: string;
  url: string;
  faviconUrl?: string;
  addedAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  pages: SavedPage[];
  createdAt: number;
  updatedAt: number;
}

export interface PageInput {
  title?: string;
  url: string;
  faviconUrl?: string;
}

export type WorkspaceCommand =
  | { scope: 'workspace'; action: 'get' }
  | { scope: 'workspace'; action: 'create'; name: string }
  | { scope: 'workspace'; action: 'rename'; workspaceId: string; name: string }
  | { scope: 'workspace'; action: 'delete'; workspaceId: string }
  | { scope: 'workspace'; action: 'addPage'; workspaceId: string; page: PageInput }
  | { scope: 'workspace'; action: 'removePage'; workspaceId: string; pageId: string };

export type WorkspaceResponse =
  | { ok: true; workspaces: Workspace[] }
  | { ok: false; error: string };
