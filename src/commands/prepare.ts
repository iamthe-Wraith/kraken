import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import { IContext, IIssue, IQuery, IReport } from '../types';
import { Command } from './command';
import { Logger } from '../lib/logger';
import { FatalError } from '../lib/error';
import dayjs from 'dayjs';

class PrepareCommand extends Command {
    constructor() {
        super({
            pattern: '<prepare>',
            docs: `
              Looks through your git log and prepares a list of commit hashes for commits that contained at least 1 of the provided queries.`.trimStart()
        });

        this.flag('write|w', {
            description: [
                'Write the hashes to a file. If this flag is not set, the hashes will only be printed to the console.',
                '',
                '💾 Files are saved in the ~/.kraken/temp directory',
                '👀 see the `filename` argument for more information',
            ].join('\n'),
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

        return ctx;
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            let data: IQuery[] = [];

            if ((ctx.data.issues || []).length) {
                data = ctx.data.issues;
            } else {
                data = await this.promptForQuery();

                // TODO: add support to past multiple queries
            }

            if (!data.length) {
                Logger.log('\nNo queries provided. The Kraken will not be released... 🐙');
                return ctx;
            }

            ctx.data.report = this.getGitLogSearchReport(data);

            if (ctx.data.report.notFound.length) {
                this.printFoundReport(ctx.data.report);
            } else {
                this.printHashesReport(ctx.data.report);

                if (ctx.arguments.flags.write) {
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
                                .map(query => query.key),
                            hashes: ctx.data.report.hashes,
                        }

                        fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
                        Logger.success(`hashes written to: ${filePath}`);
                    } catch (err) {
                        Logger.error(`Failed to write hashes to file: ${(err as Error).message}`);
                    }
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

    private getGitLogSearchReport = (issues: IQuery[]) => {
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
                const commits = this.searchGitLog(key);

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
        
        const query = issues
            .filter(issue => issue.expectToFindInGitLog)
            .map(issue => issue.keyOverride || issue.key)
            .join('|');

        const commits = this.searchGitLog(query);

        for (const commit of commits) {
            const [hash, ...msg] = commit.split(' ');

            report.hashes.push({
                hash,
                message: msg.join(' '),
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

    private promptForQuery = (inputs: IQuery[] = []) => new Promise<IQuery[]>((resolve, reject) => {
        try {
            const rd = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
    
            rd.question('\nEnter the text to query for: ', (q: string) => {
                let tryAgain = false;
                const query = q.trim();
                if (query) {
                    const commits = this.searchGitLog(query);

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
                        this.promptForQuery().then(resolve);
                    }
                });
            });
        } catch (err) {
            reject(err);
        }
    });

    private searchGitLog = (query: string) => {
        try {
            const command = `git log --oneline | grep -E "${query}"`;
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