import { IContext } from '../types';
import { Command } from './command';
import { Logger } from '../lib/logger';
import { FatalError } from '../lib/error';

class JiraStatusesCommand extends Command {
    constructor() {
        super({
            pattern: '<statuses>',
            docs: `
              Retrieves a list of all statuses from Jira for a given project.`.trimStart()
        });

        this.argument('project|p', {
            type: 'string',
            description: 'The Jira project ID to get the statuses for. You can get this by running `kraken jira-projects`. If you will be using the same project id for multiple commands, you can set it as the jiraProjectId in ~/.kraken/config.json.',
        });
    }

    before = async (ctx: IContext): Promise<IContext> => {
        if (!ctx.config) {
            throw new FatalError('No config found. Please run "npm install" to generate a config file.');
        }
    
        if (!ctx.config.jiraApiToken) {
            throw new FatalError('No Jira API token found. Please update ~/.kraken/config.json with your Jira API token.');
        }
    
        if (!ctx.config.jiraBaseUrl) {
            throw new FatalError('No Jira base URL found. Please update ~/.kraken/config.json with your Jira base URL.');
        }
    
        if (!ctx.config.jiraEmail) {
            throw new FatalError('No Jira email found. Please update ~/.kraken/config.json with your Jira email.');
        }

        if (!ctx.arguments.arguments.project && !ctx.config!.jiraProjectId) {
            throw new FatalError('No Jira project ID found. You can run `kraken jira-projects` to get the id of the project you want to get the statuses for. You will then need to update ~/.kraken/config.json with the Jira project ID.');
        }

        return ctx;
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            const projectId = ctx.arguments.arguments.project || ctx.config!.jiraProjectId;

            const res = await fetch(`${ctx.config!.jiraBaseUrl}/rest/api/3/project/${projectId}/statuses`, {
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

            const story = data.find((item: any) => item.name === 'Story');

            if (!story) {
                throw new FatalError('Story status not found');
            }

            ctx.data.jira = {
                ...(ctx.data.jira || {}),
                statuses: story.statuses,
            }

            Logger.log('\nJIRA STATUSES');
            Logger.log(`${'id'.padEnd(5, ' ')} | ${'name'}`);
            Logger.log('--------------------------------');

            for (const { id, name } of ctx.data.jira.statuses) {
                Logger.log(`${id.padEnd(5, ' ')} | ${name}`);
            }

            Logger.log('--------------------------------');

            return ctx;
        } catch (err: unknown) {
            if (err instanceof FatalError) {
                throw err;
            } else {
                throw new FatalError(`Failed to get statuses from Jira: ${(err as Error).message}`);
            }
        }
    };
}

const jiraStatusesCommand = new JiraStatusesCommand();

export const exec = (ctx: IContext): Promise<IContext> => jiraStatusesCommand.execute(ctx);
export const help = () => jiraStatusesCommand.help();