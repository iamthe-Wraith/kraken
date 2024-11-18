import fs from 'fs';
import os from 'os';
import path from 'path';
import { IContext } from '../types';
import { Command } from './command';
import { Logger } from '../lib/logger';
import { FatalError } from '../lib/error';
import dayjs from 'dayjs';

class JiraGetIssuesCommand extends Command {
    constructor() {
        super({
            pattern: '<get-issues> <status>',
            docs: `
              Retrieves a list of issues from Jira for a given project and status.`.trimStart()
        });

        this.flag('write|w', {
            description: 'Write the issues to a file. If this flag is not set, the issues will only be printed to the console.',
        });

        this.argument('filename|f', {
            type: 'string',
            description: 'The filename to write the issues to. This is argument is not set, filename will default to the current timestamp (issues-<timestamp>.json). Files are saved in the ~/.kraken/temp directory.',
        });

        this.argument('project|p', {
            type: 'string',
            description: 'The Jira project ID to get the issues for. You can get this by running `kraken jira-projects`. If you will be using the same project id for multiple commands, you can set it as the jiraProjectId in ~/.kraken/config.json.',
        });

        this.parameter('status', {
            description: 'the id of the status the issues must be set to in order to be retrieved.',
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

        if (!ctx.arguments.parameters.status) {
            throw new FatalError('No status id found. You can run `kraken jira-statuses` to get the id of the status you want to get the issues for.');
        }

        return ctx;
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            const projectId = ctx.arguments.arguments.project || ctx.config!.jiraProjectId;

            const queryParams = new URLSearchParams({
                'jql': `project = ${projectId} AND status = ${ctx.arguments.parameters.status}`
            });

            const res = await fetch(`${ctx.config!.jiraBaseUrl}/rest/api/3/search?${queryParams.toString()}`, {
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
                issues: data.issues.map((issue: any) => ({
                    id: issue.id,
                    link: issue.self,   
                    key: issue.key,
                    summary: issue.fields.summary,
                })),
            }

            if (ctx.data.jira.issues.length) {
                Logger.log('\nJIRA ISSUES');
                Logger.log(`${'key'.padEnd(10, ' ')} | ${'summary'}`);
                Logger.log('--------------------------------');
    
                for (const issue of ctx.data.jira.issues) {
                    Logger.log(`${issue.key.padEnd(10, ' ')} | ${issue.summary}`);
                }
    
                Logger.log('--------------------------------');
            } else {
                Logger.warning('No issues found');
            }

            if (ctx.data.jira.issues.length && ctx.arguments.flags['write']) {
                try {
                    const timestamp = dayjs().format('MMM-DD-YYYY-HH:mm:ss');
                    const filename = ctx.arguments.arguments.filename || `issues-${timestamp}.json`;
                    const filePath = path.join(os.homedir(), '.kraken', 'temp', filename);

                    if (!fs.existsSync(filePath)) {
                        fs.mkdirSync(path.join(os.homedir(), '.kraken', 'temp'), { recursive: true });
                    }

                    fs.writeFileSync(filePath, JSON.stringify(ctx.data.jira.issues, null, 2));
                    Logger.success(`issues written to: ${filePath}`);
                } catch (err) {
                    Logger.error(`Failed to write issues to file: ${(err as Error).message}`);
                }
            }

            return ctx;
        } catch (err: unknown) {
            if (err instanceof FatalError) {
                throw err;
            } else {
                throw new FatalError(`Failed to get statuses from Jira: ${(err as Error).message}`);
            }
        }
    };

    after = async (ctx: IContext): Promise<IContext> => {
        try {
            const tempDir = path.join(os.homedir(), '.kraken', 'temp');
            
            if (fs.existsSync(tempDir)) {
                let daysToKeepTempFiles = parseInt(`${(ctx.config || {}).daysToKeepTempFiles || 30}`);

                if (isNaN(daysToKeepTempFiles) || daysToKeepTempFiles < 0) {
                    if ((ctx.config || {}).daysToKeepTempFiles) {
                        Logger.warning('daysToKeepTempFiles is not a number in ~/.kraken/config.json. Defaulting to 30 days.');
                    } else {
                        Logger.warning('daysToKeepTempFiles is not set in ~/.kraken/config.json. Defaulting to 30 days.');
                    }
                    
                    daysToKeepTempFiles = 30;
                }

                const files = fs.readdirSync(tempDir);
                const now = Date.now();
                const thirtyDaysInMs = daysToKeepTempFiles * 24 * 60 * 60 * 1000;

                let count = 0;

                // TODO: prompt user to confirm if they want to delete the files

                for (const file of files) {
                    const filePath = path.join(tempDir, file);
                    const stats = fs.statSync(filePath);
                    const age = now - stats.mtime.getTime();

                    if (age > thirtyDaysInMs) {
                        fs.unlinkSync(filePath);
                        count++;
                    }
                }

                if (count) {
                    Logger.success(`deleted ${count} old temp files.`);
                }
            } else {
                Logger.warning('no temp directory found. skipping cleanup.');
            }
        } catch (err) {
            Logger.error(`failed to clean temp directory: ${(err as Error).message}`);
        }

        return ctx;
    }
}

const jiraGetIssuesCommand = new JiraGetIssuesCommand();

export const exec = (ctx: IContext): Promise<IContext> => jiraGetIssuesCommand.execute(ctx);
export const help = () => jiraGetIssuesCommand.help();