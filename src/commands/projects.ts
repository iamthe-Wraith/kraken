import { IContext, IProject } from '../types.js';
import { Command } from './command.js';
import { Logger } from '../lib/logger.js';
import { FatalError } from '../lib/error.js';

class ProjectsCommand extends Command {
    private platforms = new Set(['jira']);

    constructor() {
        super({
            pattern: '<projects> <platform>',
            docs: `
              Retrieves a list of all your projects from a given platform. This is helpful for finding the project ID for project to use in other commands.`.trimStart()
        });

        this.parameter('platform', {
            description: [
                'the name of the platform where the projects exist.',
                '',
                `supported values are: ${Array.from(this.platforms).join(', ')}.`,
            ].join('\n'),
        });
    }

    before = async (ctx: IContext): Promise<IContext> => {
        if (!ctx.config) {
            throw new FatalError('No config found. Please run "npm install" to generate a config file.');
        }
    
        if (!ctx.arguments.parameters.platform) {
            throw new FatalError('No platform found. You you must specify the platform you want to get the projects for.');
        }

        if (!this.platforms.has(ctx.arguments.parameters.platform)) {
            throw new FatalError(`Unsupported platform: ${ctx.arguments.parameters.platform}. Supported platforms are: ${Array.from(this.platforms).join(', ')}.`);
        }

        if (ctx.arguments.parameters.platform === 'jira') {
            if (!ctx.config.jiraApiToken) {
                throw new FatalError('No Jira API token found');
            }
        
            if (!ctx.config.jiraBaseUrl) {
                throw new FatalError('No Jira base URL found');
            }
        
            if (!ctx.config.jiraEmail) {
              throw new FatalError('No Jira email found');
            }
        }

        return ctx;
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            switch (ctx.arguments.parameters.platform) {
                case 'jira': {
                    ctx.data.projects = await this.getJiraProjects(ctx);
                    break;
                }
                default:
                    throw new FatalError(`Unsupported platform: ${ctx.arguments.parameters.platform}. Supported platforms are: ${Array.from(this.platforms).join(', ')}.`);
                    break;
            }

            Logger.log('\nPROJECTS');
            Logger.log(`${'id'.padEnd(5, ' ')} | ${'key'.padEnd(8, ' ')} | name`);
            Logger.log('--------------------------------');

            for (const project of ctx.data.projects) {
                const key = project.key.padEnd(8, ' ');

                Logger.log(`${project.id} | ${key} | ${project.name}`);
            }

            Logger.log('--------------------------------');

            return ctx;
        } catch (err: unknown) {
            if (err instanceof FatalError) {
                throw err;
            }

            throw new FatalError(`An error occurred while trying to get projects from Jira: ${(err as Error).message}`);
        }
    };

    private getJiraProjects = async (ctx: IContext): Promise<IProject[]> => {
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
                throw new FatalError(`Failed to get projects from Jira: ${res.statusText}`);
            }
        
            // TODO: come back and update type form any to actual type as defined by the Jira API
            const data = await res.json() as { values: any[] };
    
            return data.values.map((project: any) => {
                return {
                    id: project.id,
                    key: project.key,
                    name: project.name,
                };
            });
        } catch (err: unknown) {
            if (err instanceof FatalError) {
                throw err;
            }

            throw new FatalError(`An error occurred while trying to get projects from Jira: ${(err as Error).message}`);
        }
    }
}

const projectsCommand = new ProjectsCommand();

export const exec = (ctx: IContext): Promise<IContext> => projectsCommand.execute(ctx);
export const help = () => projectsCommand.help();