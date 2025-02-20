import fs from 'fs';
import os from 'os';
import path from 'path';
import { IContext, IIssue } from '../types.js';
import { Command } from './command.js';
import { Logger } from '../lib/logger.js';
import { FatalError } from '../lib/error.js';
import dayjs from 'dayjs';

class IssuesCommand extends Command {
    private platforms = new Set(['jira']);

    constructor() {
        super({
            pattern: '<issues> <platform>',
            docs: `
              Retrieves a list of issues from a given platform.`.trimStart()
        });

        this.parameter('platform', {
            description: [
                'the name of the platform where the issues exist.',
                '',
                `supported values are: ${Array.from(this.platforms).join(', ')}.`,
            ].join('\n'),
        });

        this.argument('project|p', {
            type: 'string',
            description: [
                'The project ID to get the issues for.',
                '',
                'You can get this by running `kraken projects <platform>`.',
                '',
                'If you will be using the same project id for multiple commands, you can set it in ~/.kraken/config.json.',
            ].join('\n'),
        });

        this.argument('status|s', {
            type: 'string',
            description: 'the id of the status the issues must be set to in order to be retrieved. if this argument is not set, all issues will be retrieved.',
        });

        this.argument('write-to|t', {
            type: 'string',
            description: [
                'The filename to write the issues to.',
                '',
                'ℹ️ If this argument is not set, `filename` will default to the current timestamp (issues-<timestamp>.json).',
                '',
                '💾 Files are saved in the ~/.kraken/temp directory',
            ].join('\n'),
        });

        this.flag('write|w', {
            description: 'Write the issues to a file. If this flag is not set, the issues will only be printed to the console.',
        });
    }

    before = async (ctx: IContext): Promise<IContext> => {
        if (!ctx.config) {
            throw new FatalError('No config found. Please run "npm install" to generate a config file.');
        }

        if (!ctx.arguments.parameters.platform) {
            throw new FatalError('No platform found. You you must specify the platform you want to get the issues for.');
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
                throw new FatalError('No Jira project ID found. You can run `kraken projects <platform>` to get the id of the project you want to get the statuses for. You can then update ~/.kraken/config.json with the project ID.');
            }
        }

        return ctx;
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            switch (ctx.arguments.parameters.platform) {
                case 'jira': {
                    ctx.data.issues = await this.getJiraIssues(ctx);
                    break;
                }
                default: {
                    throw new FatalError(`Unsupported platform: ${ctx.arguments.parameters.platform}. Supported platforms are: ${Array.from(this.platforms).join(', ')}.`);
                }
            }

            if (ctx.data.issues.length) {
                Logger.log('\nISSUES');
                Logger.log(`${'key'.padEnd(10, ' ')} | Blocks | Blocked By | ${'summary'}`);
                Logger.log('-'.padEnd(10, '-') + ' | ' + '-'.padEnd(6, '-') + ' | ' + '-'.padEnd(10, '-') + ' | ' + '-'.padEnd(10, '-'));
    
                for (const issue of ctx.data.issues) {
                    // if (issue.key === 'DEV-3260') {
                    //     console.log(issue.issueLinks);
                    // }

                    const blocks = issue.issueLinks.filter((link: any) => {
                        if (link.type.inward === 'blocks' && link.inwardIssue) {
                            return link.inwardIssue;
                        }

                        if (link.type.outward === 'blocks' && link.outwardIssue) {
                            return link.outwardIssue;
                        }
                    });

                    const blockedBy = issue.issueLinks.filter((link: any) => {
                        if (link.type.inward === 'is blocked by' && link.inwardIssue) {
                            return link.inwardIssue;
                        }

                        if (link.type.outward === 'is blocked by' && link.outwardIssue) {
                            return link.outwardIssue;
                        }
                    });

                    Logger.log(`${issue.key.padEnd(10, ' ')} | ${blocks.length.toString().padEnd(6, ' ')} | ${blockedBy.length.toString().padEnd(10, ' ')} | ${issue.summary}`);
                }
    
                Logger.log('-'.padEnd(10, '-') + ' | ' + '-'.padEnd(6, '-') + ' | ' + '-'.padEnd(10, '-') + ' | ' + '-'.padEnd(10, '-'));
            } else {
                Logger.warning('No issues found');
            }

            if (ctx.data.issues.length && ctx.arguments.flags['write']) {
                try {
                    const timestamp = dayjs().format('MMM-DD-YYYY-HH:mm:ss');
                    const filename = ctx.arguments.arguments.filename || `issues-${timestamp}.json`;
                    const filePath = path.join(os.homedir(), '.kraken', 'temp', filename);

                    if (!fs.existsSync(filePath)) {
                        fs.mkdirSync(path.join(os.homedir(), '.kraken', 'temp'), { recursive: true });
                    }

                    fs.writeFileSync(filePath, JSON.stringify(ctx.data.issues, null, 2));
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
                throw new FatalError(`Failed to get statuses from ${ctx.arguments.parameters.platform}: ${(err as Error).message}`);
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

    private getJiraIssues = async (ctx: IContext): Promise<IIssue[]> => {
        try {
            const projectId = ctx.arguments.arguments.project || ctx.config!.jiraProjectId;

            let query = `project = ${projectId}`;

            if (ctx.arguments.arguments.status) {
                query += ` AND status = ${ctx.arguments.arguments.status}`;
            }

            const queryParams = new URLSearchParams({
                'jql': query,
            });

            const res = await fetch(`${ctx.config!.jiraBaseUrl}/rest/api/3/search?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${ctx.config!.jiraEmail}:${ctx.config!.jiraApiToken}`).toString('base64')}`,
                    'Accept': 'application/json'
                }
            });
        
            if (!res.ok) {
                throw new FatalError(`Failed to get issues from Jira: ${res.statusText}`);
            }

            // TODO: come back and update type form any to actual type as defined by the Jira API
            const data = await res.json() as { issues: any[] };

            return data.issues.map((issue: any) => ({
                id: issue.id,
                link: issue.self,   
                key: issue.key,
                keyOverride: '',
                summary: issue.fields.summary,
                expectToFindInGitLog: true,
                issueLinks: issue.fields.issuelinks,
            }));
        } catch (err) {
            if (err instanceof FatalError) {
                throw err;
            } else {
                throw new FatalError(`An error occurred while attempting to get issues from Jira: ${(err as Error).message}`);
            }
        }
    }
}

const issuesCommand = new IssuesCommand();

export const exec = (ctx: IContext): Promise<IContext> => issuesCommand.execute(ctx);
export const help = () => issuesCommand.help();