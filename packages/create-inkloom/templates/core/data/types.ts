import type {
  Asset,
  Branch,
  Deployment,
  Folder,
  Page,
  Project,
  User,
} from "@/db/schema";

export type Id<_TableName extends string> = string;

type Documents = {
  assets: Asset;
  branches: Branch;
  deployments: Deployment;
  folders: Folder;
  pages: Page;
  projects: Project & Record<string, unknown>;
  users: User;
};

export type Doc<TableName extends keyof Documents> = Documents[TableName];
