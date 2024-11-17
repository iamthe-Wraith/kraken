export interface IArguments {
  arguments: Record<string, any>;
  flags: Record<string, boolean>;
  parameters: Record<string, any>;
}

export interface IConfig {
  jiraApiToken: string;
  jiraUrl: string;
  githubToken: string;
  githubUsername: string;
}

export interface IContext {
  args: string[];
  arguments: IArguments;
  command: string | null;
  config?: IConfig;
  namespace: string;
}