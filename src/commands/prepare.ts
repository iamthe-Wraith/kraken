import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import dayjs from 'dayjs';
import { IContext, IIssue, IQuery, IReport } from '../types.js';
import { Command } from './command.js';
import { Logger } from '../lib/logger.js';
import { FatalError } from '../lib/error.js';

class PrepareCommand extends Command {
    private platforms = new Set(['github']);

    constructor() {
        super({
            pattern: '<prepare> <?platform> <?target-branch>',
            docs: `
              Looks through your git log and prepares a list of commit hashes for commits that contained at least 1 of the provided queries.`.trimStart()
        });

        this.flag('attempt-cherry-pick|a', {
            description: [
                'creates a new branch from the target branch, then attempt to cherry pick the prepared commits into that branch. if any commits fail to be cherry picked, the branch will be deleted.',
                '',
                '❗ if this flag is set, you must also specify the target branch and platform',
                '',
                '❗ if this flag is set, the `write` flag will be enabled as well',
                '',
                '🚨 this command will not work if you have unstaged changes in your working directory',
            ].join('\n'),
        });

        this.flag('ignore-case|i', {
            description: [
                'ignore case when searching for commits',
            ].join('\n'),
        });

        this.flag('write|w', {
            description: [
                'Write the hashes to a file. If this flag is not set, the prepared data will only be printed to the console.',
                '',
                '💾 Files are saved in the ~/.kraken/temp directory',
                '👀 see the `filename` argument for more information',
            ].join('\n'),
        });

        this.parameter('platform', {
            description: [
                'the name of the platform to release to.',
                '',
                `supported values are: ${Array.from(this.platforms).join(', ')}.`,
            ].join('\n'),
        });

        this.parameter('target-branch', {
            description: 'the name of the target branch this data will be released to.',
        });

        this.argument('filename|f', {
            type: 'string',
            description: [
                'The name of the file to use as input for this command. This file must be a valid JSON file located in the ~/.kraken/temp directory.',
                '💭 (use `kraken files -i` to list the files that are available)',
                '',
                'ℹ️ If this argument is not provided, you will be prompted to enter enter the search queries manually.'
            ].join('\n'),
        });

        this.argument('new-branch|n', {
            description: [
                'the name of the new branch to create.',
                '',
                'ℹ️ if this argument is not set, the new branch will be named `release-<timestamp>`.',
            ].join('\n'),
        });

        this.argument('write-to|t', {
            type: 'string',
            description: [
                'The filename to write the hashes to. If this argument is not set, filename will default to the current timestamp (hashes-<timestamp>.json).',
                '',
                '💾 Files are saved in the ~/.kraken/temp directory',
            ].join('\n'),
        });
    }

    before = async (ctx: IContext): Promise<IContext> => {
        if (!ctx.config) {
            throw new FatalError('No config found. Please run "npm install" to generate a config file.');
        }

        if (ctx.arguments.arguments.filename) {
            ctx.data.filename = ctx.arguments.arguments.filename.includes('.json')
                ? ctx.arguments.arguments.filename
                : `${ctx.arguments.arguments.filename}.json`;

            ctx.data.filePath = path.join(os.homedir(), '.kraken', 'temp', ctx.data.filename);

            if (!fs.existsSync(ctx.data.filePath)) {
                throw new FatalError(`file not found: ${ctx.data.filePath}`);
            }

            try {
                const data = fs.readFileSync(ctx.data.filePath, 'utf8');
                const issues: IIssue[] = JSON.parse(data);

                // validate the file data structure
                if (!Array.isArray(issues)) {
                    throw new FatalError('Invalid file format. Expected an array of issues.');
                }

                // validate each issue
                for (const issue of issues) {
                    if (typeof issue !== 'object' || issue === null) {
                        throw new FatalError('Invalid issue format. Expected an object.');
                    }

                    if (typeof issue.key !== 'string') {
                        throw new FatalError('Invalid issue format. Expected a string for the issue key.');
                    }

                    if (typeof issue.keyOverride !== 'string') {
                        throw new FatalError('Invalid issue format. Expected a string for the issue key override.');
                    }

                    if (!issue.key && !issue.keyOverride) {
                        throw new FatalError('Invalid issue format. Expected a non-empty string for the issue key or key override.');
                    }
                }

                ctx.data.issues = issues;
            } catch (err: unknown) {
                if (err instanceof FatalError) {
                    throw err;
                } else {
                    throw new FatalError(`failed to parse file: ${(err as Error).message}`);
                }
            }
        }

        if (ctx.arguments.flags['attempt-cherry-pick']) {
            if (!ctx.arguments.parameters.platform) {
                throw new FatalError('No platform found. You you must specify the platform you want to create the pull|merge request for.');
            }
    
            if (!this.platforms.has(ctx.arguments.parameters.platform)) {
                throw new FatalError(`Unsupported platform: ${ctx.arguments.parameters.platform}. Supported platforms are: ${Array.from(this.platforms).join(', ')}.`);
            }
    
            if (ctx.arguments.parameters.platform === 'github') {
                if (!ctx.config.githubToken) {
                    throw new FatalError('No GitHub API token found. Please update ~/.kraken/config.json with your GitHub API token.');
                }
            }

            if (!ctx.arguments.parameters['target-branch']) {
                throw new FatalError('No target branch found. Please specify the target branch you want to cherry pick the commits to.');
            }

            // verify target branch exists on remote
            const output = execSync(`git ls-remote --heads origin ${ctx.arguments.parameters['target-branch']}`, { encoding: 'utf-8' });
            
            if (!output) {
                throw new FatalError(`Target branch '${ctx.arguments.parameters['target-branch']}' does not exist on remote`);
            }
        }

        return ctx;
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            let data: IQuery[] = [];

            if ((ctx.data.issues || []).length) {
                data = ctx.data.issues;
            } else {
                data = await this.promptForQuery(ctx);

                // TODO: add support to paste multiple queries
            }

            if (!data.length) {
                Logger.log('\nNo queries provided. The Kraken will not be released... 🐙');
                return ctx;
            }

            ctx.data.report = this.getGitLogSearchReport(data, ctx);

            if (ctx.data.report.notFound.length) {
                this.printFoundReport(ctx.data.report);
            } else {
                this.printHashesReport(ctx.data.report);

                if (ctx.arguments.flags.write || ctx.arguments.flags['attempt-cherry-pick']) {
                    try {
                        const timestamp = dayjs().format('MMM-DD-YYYY-HH:mm:ss');
                        const filename = ctx.arguments.arguments.output || `prepared-${timestamp}.json`;
                        const tempPath = path.join(os.homedir(), '.kraken', 'temp');
                        const filePath = path.join(os.homedir(), '.kraken', 'temp', filename);
    
                        if (!fs.existsSync(tempPath)) {
                            fs.mkdirSync(path.join(os.homedir(), '.kraken', 'temp'), { recursive: true });
                        }
    
                        const output = {
                            source: ctx.arguments.arguments.filename || 'manual', 
                            queries: data
                                .filter(query => query.expectToFindInGitLog)
                                .map(query => query.keyOverride || query.key),
                            hashes: ctx.data.report.hashes,
                        }

                        fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
                        Logger.success(`hashes written to: ${filePath}`);
                    } catch (err) {
                        Logger.error(`Failed to write hashes to file: ${(err as Error).message}`);
                    }
                }

                if (ctx.arguments.flags['attempt-cherry-pick']) {
                    this.attemptCherryPick(ctx);
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

    private attemptCherryPick = (ctx: IContext) => {
        Logger.log('\nAttempting to cherry pick commits...');

        const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
        const newBranch = ctx.arguments.arguments['new-branch'] || `release-${dayjs().format('MMM-DD-YYYY-HH:mm:ss')}`;
        const targetBranch = ctx.arguments.parameters['target-branch'];
        
        let newBranchCreated = false;

        try {
            execSync(`git checkout ${targetBranch}`, { encoding: 'utf-8' });
            execSync(`git pull origin ${targetBranch}`, { encoding: 'utf-8' });
            execSync(`git checkout -b ${newBranch}`, { encoding: 'utf-8' });
            execSync(`git push -u origin ${newBranch}`, { encoding: 'utf-8' });

            newBranchCreated = true;
        } catch (err) {
            execSync(`git checkout ${currentBranch}`, { encoding: 'utf-8' });

            throw new FatalError(`Failed to create new branch '${newBranch}': ${(err as Error).message}`);
        }

        if (newBranchCreated) {
            try {
                for (const hash of ctx.data.report.hashes) {
                    execSync(`git cherry-pick ${hash.hash}`, { encoding: 'utf-8' });
                }

                execSync(`git push origin ${newBranch}`, { encoding: 'utf-8' });

                Logger.success(`Successfully cherry picked commits into new branch '${newBranch}'.\n\nThe Kraken is ready to be released! 🐙`);
            } catch (err) {
                execSync('git cherry-pick --abort', { encoding: 'utf-8' });
                execSync(`git checkout ${currentBranch}`, { encoding: 'utf-8' });
                execSync(`git branch -D ${newBranch}`, { encoding: 'utf-8' });

                Logger.error('Failed to cherry pick commits. You will need to handle this manually. 😢');
            }
        }
    }

    private getGitLogSearchReport = (issues: IQuery[], ctx: IContext) => {
        const report: IReport = {
            found: [],
            notFound: [],
            hashes: [],
        }

        // search for each issue in the git log to confirm they are all found
        for (const issue of issues) {
            if (!issue.expectToFindInGitLog) {
                continue;
            }

            const key = issue.keyOverride || issue.key;

            try {
                const commits = this.searchGitLog(key, ctx);

                if (commits.length) {
                    report.found.push(key);
                } else {
                    report.notFound.push(key);
                }
            } catch (err) {
                report.notFound.push(key);
            }
        }

        if (report.notFound.length) {
            return report;
        }

        const keys = issues
            .filter(issue => issue.expectToFindInGitLog)
            .map(issue => issue.keyOverride || issue.key);
        
        const query = keys.join('|');

        const commits = this.searchGitLog(query, ctx);

        for (const commit of commits) {
            const [hash, ...msg] = commit.split(' ');

            const message = msg.join(' ');

            let matches: string[] = [];

            for (const key of keys) {
                if (message.includes(key)) {
                    matches.push(key);
                }
            }

            report.hashes.push({
                hash,
                message,
                matches,
            });
        }

        return report;
    }

    private printFoundReport = (report: IReport) => {
        if (report.found.length) {
            Logger.log('\nKEYS FOUND');
            Logger.log('--------------------------------');

            for (const key of report.found) {
                Logger.log(key);
            }

            Logger.log('--------------------------------');
        } else {
            Logger.error('NO KEYS FOUND');
        }

        if (report.notFound.length) {
            Logger.log('\nKEYS NOT FOUND');
            Logger.log('--------------------------------');

            for (const key of report.notFound) {
                Logger.log(key);
            }

            Logger.log('--------------------------------');
        }
    }

    private printHashesReport = (report: IReport) => {
        Logger.log('\nHASHES');
        Logger.log('----------------newest----------------\n');

        for (const hash of report.hashes) {
            Logger.log(`${hash.hash.padEnd(8, ' ')} | ${hash.message}`);
        }

        Logger.log('\n----------------oldest----------------');
    }

    private promptForQuery = (ctx: IContext, existingInputs: IQuery[] = []) => new Promise<IQuery[]>((resolve, reject) => {
        try {
            const inputs = [...existingInputs];

            const rd = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
    
            rd.question('\nEnter the text to query for: ', (q: string) => {
                let tryAgain = false;
                const query = q.trim();
                if (query) {
                    const commits = this.searchGitLog(query, ctx);

                    if (commits.length) {
                        inputs.push({
                            key: query,
                            keyOverride: '',
                            expectToFindInGitLog: true
                        });
                    } else {
                        tryAgain = true;
                        Logger.error(`"${query}" was not found in git log`);
                    }
                }
                
                const question = tryAgain
                    ? 'Do you want to try again? (Y/n): '
                    : 'Do you have more queries to enter? (Y/n): ';

                rd.question(question, (answer: string) => {
                    const normalized = answer.trim().toLowerCase();
                    rd.close();

                    if (normalized === 'n') {
                        resolve(inputs);
                    } else {
                        this.promptForQuery(ctx, inputs).then(resolve);
                    }
                });
            });
        } catch (err) {
            reject(err);
        }
    });

    private searchGitLog = (query: string, ctx: IContext) => {
        try {
            const ignoreCase = ctx.arguments.flags['ignore-case'];
            const command = `git log --oneline | grep -${ignoreCase ? 'i' : ''}E "${query}"`;
            const results = execSync(command, { encoding: 'utf-8' });
            return results.split('\n').filter(Boolean);
        } catch (err) {
            return [];
        }
    }
}

const prepareCommand = new PrepareCommand();

export const exec = (ctx: IContext): Promise<IContext> => prepareCommand.execute(ctx);
export const help = () => prepareCommand.help();