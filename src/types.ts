export interface IArguments {
  arguments: Record<string, any>;
  flags: Record<string, boolean>;
  parameters: Record<string, any>;
}

export interface IConfig {
  jiraApiToken: string;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraProjectId: string;
  githubToken: string;
  githubUsername: string;
  daysToKeepTempFiles: number;
}

export interface IContext {
  args: string[];
  arguments: IArguments;
  command: string | null;
  config?: IConfig;
  namespace: string;
  data: Record<string, any>;
}

export interface IHash {
  hash: string;
  message: string;
  matches: string[];
}

export interface IProject {
  id: string;
  key: string;
  name: string;
}

export interface IQuery {
  key: string;
  keyOverride: string;
  expectToFindInGitLog: boolean;
}

export interface IHash {
  hash: string;
  message: string;
}

export interface IPreparedData {
  source: string;
  queries: string[];
  hashes: IHash[];
}

export interface IIssue extends IQuery {
  id: string;
  link: string;
  summary: string;
}

export interface IReport {
  found: string[];
  notFound: string[];
  hashes: IHash[];
}

export interface IStatus {
  id: string;
  name: string;
}