import { IContext } from '../types';
import { Command } from './command';
import { Logger } from '../lib/logger';
import { FatalError } from '../lib/error';

class JiraProjectsCommand extends Command {
    constructor() {
        super({
            pattern: '<jira-projects>',
            docs: `
              Retrieves a list of all projects from Jira. This is helpful for finding the project ID for a given project.`
        });
    }

    before = async (ctx: IContext): Promise<IContext> => {
        if (!ctx.config) {
            throw new FatalError('No config found. Please run "npm install" to generate a config file.');
        }
    
        if (!ctx.config.jiraApiToken) {
            throw new FatalError('No Jira API token found');
        }
    
        if (!ctx.config.jiraBaseUrl) {
            throw new FatalError('No Jira base URL found');
        }
    
        if (!ctx.config.jiraEmail) {
          throw new FatalError('No Jira email found');
        }

        return ctx;
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            const queryParams = new URLSearchParams({
                maxResults: '500',
            });

            const res = await fetch(`${ctx.config!.jiraBaseUrl}/rest/api/3/project/search?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${ctx.config!.jiraEmail}:${ctx.config!.jiraApiToken}`).toString('base64')}`,
                    'Accept': 'application/json'
                }
            });
        
            if (!res.ok) {
                throw new FatalError(`Failed to get statuses from Jira: ${res.statusText}`);
            }
        
            const data = await res.json();

            ctx.data.jira = {
                ...(ctx.data.jira || {}),
                projects: data.values,
            }

            const projects = ctx.data.jira.projects.map((project: any) => {
                return {
                    id: project.id,
                    key: project.key,
                    name: project.name,
                };
            });

            Logger.log('\nJIRA PROJECTS');
            Logger.log(`${'id'.padEnd(5, ' ')} | ${'key'.padEnd(8, ' ')} | name`);
            Logger.log('--------------------------------');

            for (const project of projects) {
                const key = project.key.padEnd(8, ' ');

                Logger.log(`${project.id} | ${key} | ${project.name}`);
            }

            Logger.log('--------------------------------');

            return ctx;
        } catch (err: unknown) {
            throw new FatalError(`Failed to get statuses from Jira: ${(err as Error).message}`);
        }
    };
}

const jiraProjectsCommand = new JiraProjectsCommand();

export const exec = (ctx: IContext): Promise<IContext> => jiraProjectsCommand.execute(ctx);
export const help = () => jiraProjectsCommand.help();