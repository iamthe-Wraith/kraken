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