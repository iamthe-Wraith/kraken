import { IContext, IStatus } from '../types.js';
import { Command } from './command.js';
import { Logger } from '../lib/logger.js';
import { FatalError } from '../lib/error.js';

class StatusesCommand extends Command {
    private platforms = new Set(['jira']);

    constructor() {
        super({
            pattern: '<statuses> <platform>',
            docs: `
              Retrieves a list of all statuses from Jira for a given project.`.trimStart()
        });

        this.parameter('platform', {
            description: [
                'the name of the platform where the statuses exist.',
                '',
                `supported values are: ${Array.from(this.platforms).join(', ')}.`,
            ].join('\n'),
        });

        this.argument('project|p', {
            type: 'string',
            description: [
                'The Jira project ID to get the statuses for.',
                '',
                '💭 You can get this by running `kraken jira-projects`.',
                '',
                '✨ If you will be using the same project id for multiple commands, you can set it as the jiraProjectId in ~/.kraken/config.json.',
            ].join('\n'),
        });
    }

    before = async (ctx: IContext): Promise<IContext> => {
        if (!ctx.config) {
            throw new FatalError('No config found. Please run "npm install" to generate a config file.');
        }
    
        if (!ctx.arguments.parameters.platform) {
            throw new FatalError('No platform found. You you must specify the platform you want to get the statuses for.');
        }

        if (!this.platforms.has(ctx.arguments.parameters.platform)) {
            throw new FatalError(`Unsupported platform: ${ctx.arguments.parameters.platform}. Supported platforms are: ${Array.from(this.platforms).join(', ')}.`);
        }

        if (ctx.arguments.parameters.platform === 'jira') {
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
        }

        return ctx;
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            switch (ctx.arguments.parameters.platform) {
                case 'jira': {
                    ctx.data.statuses = await this.getJiraStatuses(ctx);
                    break;
                }
                default: {
                    throw new FatalError(`Unsupported platform: ${ctx.arguments.parameters.platform}. Supported platforms are: ${Array.from(this.platforms).join(', ')}.`);
                }
            }

            Logger.log('\nJIRA STATUSES');
            Logger.log(`${'id'.padEnd(5, ' ')} | ${'name'}`);
            Logger.log('--------------------------------');

            for (const { id, name } of ctx.data.statuses) {
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

    private getJiraStatuses = async (ctx: IContext): Promise<IStatus[]> => {
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

            // TODO: come back and update type form any to actual type as defined by the Jira API
            const data = await res.json() as any[];

            const story = data.find((item: any) => item.name === 'Story');

            if (!story) {
                throw new FatalError('Story status not found');
            }

            return story.statuses;
        } catch (err: unknown) {
            if (err instanceof FatalError) {
                throw err;
            } else {
                throw new FatalError(`An error occurred while attempting to get statuses from Jira: ${(err as Error).message}`);
            }
        }
    }
}

const statusesCommand = new StatusesCommand();

export const exec = (ctx: IContext): Promise<IContext> => statusesCommand.execute(ctx);
export const help = () => statusesCommand.help();