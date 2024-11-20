import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { IContext, IPreparedData } from '../types';
import { Command } from './command';
import { Logger } from '../lib/logger';
import { FatalError } from '../lib/error';
import dayjs from 'dayjs';

class ReleaseCommand extends Command {
    private platforms = new Set(['github']);

    constructor() {
        super({
            pattern: '<release> <platform> <target-branch>',
            docs: `
              Pushes the current branch to the remote repository, then creates a pull|merge request on the specified platform.`.trimStart()
        });

        this.parameter('platform', {
            description: [
                'the name of the platform to release to.',
                '',
                `supported values are: ${Array.from(this.platforms).join(', ')}.`,
            ].join('\n'),
        });

        this.parameter('target-branch', {
            description: 'the name of the target branch to release to.',
        });

        this.argument('new-branch|n', {
            description: [
                'the name of the new branch to create.',
                '',
                'ℹ️ if this argument is not set, the new branch will be named `release-<timestamp>`.',
            ].join('\n'),
        })

        this.argument('prepared|p', {
            description: [
                'the name of the file that contains the prepared data.',
                '',
                'ℹ️ if this argument is not set, the prepared data will be retrieved from the most recent prepared file in `.kraken/temp`.',
                'ℹ️ if no prepared file is found, this release command will exit.',
            ].join('\n'),
        });

        this.argument('title|t', {
            description: 'the title of the pull request.',
        });

        this.flag('attempt-cherry-pick|a', {
            description: 'attempt to cherry pick the commits into the target branch.',
        })
    }

    before = async (ctx: IContext): Promise<IContext> => {
        if (!ctx.config) {
            throw new FatalError('No config found. Please run "npm install" to generate a config file.');
        }
    
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
            throw new FatalError('No target branch found. You must specify the target branch you want to release to.');
        }

        // verify target branch exists on remote
        const output = execSync(`git ls-remote --heads origin ${ctx.arguments.parameters['target-branch']}`, { encoding: 'utf-8' });
        
        if (!output) {
            throw new FatalError(`Target branch '${ctx.arguments.parameters['target-branch']}' does not exist on remote`);
        }

        if (ctx.arguments.arguments.prepared) {
            const filePath = path.join(os.homedir(), '.kraken', 'temp', ctx.arguments.arguments['prepared']);

            if (!fs.existsSync(filePath)) {
                throw new FatalError(`Prepared file not found: ${filePath}`);
            }
        } else {
            const tempDir = path.join(os.homedir(), '.kraken', 'temp');
            const preparedFiles = fs.readdirSync(tempDir).filter(file => file.startsWith('prepared') && file.endsWith('.json'));

            if (preparedFiles.length === 0) {
                throw new FatalError('No prepared files found in `.kraken/temp`');
            }

            const mostRecentFile = preparedFiles
                .map(file => ({
                    name: file,
                    time: fs.statSync(path.join(tempDir, file)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time)[0].name;

            ctx.data.prepared = mostRecentFile;
        }

        return ctx;
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            Logger.log('\n🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊');
            Logger.log('    Release the Kraken! 🐙');
            Logger.log('🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊\n');

            switch (ctx.arguments.parameters.platform) {
                case 'github': {
                    this.createGitHubPullRequest(ctx);
                    break;
                }
                default: {
                    throw new FatalError(`Unsupported platform: ${ctx.arguments.parameters.platform}`);
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

    private createGitHubPullRequest = async (ctx: IContext): Promise<void> => {
        try {
            const data = this.loadPreparedData(ctx);
            let currentBranch = this.getCurrentBranch();
            this.pullChangesFromRemote(currentBranch);
            const repo = this.getRepoInfo();
            const prBody = this.getPullRequestBody(data);

            if (ctx.arguments.flags['attempt-cherry-pick']) {
                currentBranch = this.createNewBranch(ctx);

                Logger.log('attempting cherry picks...');
            }

            Logger.log('creating pull request...');
            Logger.log('data', data);
            Logger.log('repo', repo);
            Logger.log('prBody', prBody);
            Logger.log('currentBranch', currentBranch);

            // const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/pulls`, {
            //     method: 'POST',
            //     headers: {
            //         'Authorization': `token ${ctx.config!.githubToken}`,
            //         'Accept': 'application/vnd.github.v3+json'
            //     },
            //     body: JSON.stringify({
            //         title: `Pull request from ${currentBranch.trim()}`,
            //         head: currentBranch.trim(),
            //         body: prBody,
            //         base: ctx.arguments.parameters['target-branch'],
            //         draft: true,
            //     })
            // });
    
            // if (!res.ok) {
            //     const error = await res.text();
            //     throw new FatalError(`Failed to create pull request: ${error}`);
            // }
    
            // const pr = await res.json();
            // Logger.success(`Successfully created pull request: ${pr.html_url}`);
        } catch (err) {
            if (err instanceof FatalError) {
                throw err;
            } else {
                throw new FatalError(`Failed to create GitHub pull request: ${(err as Error).message}`);
            }
        }
    }

    private createNewBranch = (ctx: IContext): string => {
        Logger.log('creating release branch...');
        const timestamp = dayjs().format('MM-DD-YYYY-HH:mm:ss');
        const newBranch = ctx.arguments.arguments['new-branch'] || `release-${timestamp}`;

        execSync(`git checkout -b ${newBranch}`, { encoding: 'utf-8' });
        execSync(`git push -u origin ${newBranch}`, { encoding: 'utf-8' });
        Logger.success(`release branch created: ${newBranch}`);
        return newBranch;
    }

    private getCurrentBranch = (): string => {
        Logger.log('getting current branch...');
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' });
                    
        if (!currentBranch) {
            throw new FatalError('Failed to get current branch name');
        }

        Logger.success(`current branch found: ${currentBranch.trim()}`);

        return currentBranch.trim();
    }

    private getPullRequestBody = (data: IPreparedData): string => {
        console.log('data', data);

        return '';
    }

    private getRepoInfo = () => {
        Logger.log('getting repo info...');
        const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' });
        const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);

        if (!match) {
            throw new FatalError('Could not parse GitHub repository from remote URL');
        }

        const [, owner, repo] = match;
        Logger.success('repo info retrieved');
        return {
            url: repo.trim(),
            owner,
            repo
        };
    }

    private loadPreparedData = (ctx: IContext): IPreparedData => {
        let filename: string;

        if (ctx.arguments.arguments.prepared) {
            Logger.log(`loading prepared data from ${ctx.arguments.arguments.prepared}`);
            filename = ctx.arguments.arguments.prepared;
        } else {
            Logger.log(`loading prepared data from latest prepared file (${ctx.data.prepared})`);
            filename = ctx.data.prepared;
        }

        const filePath = path.join(os.homedir(), '.kraken', 'temp', filename);
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);

        Logger.success('prepared data loaded');

        return parsed;
    }

    private pullChangesFromRemote = (branch: string): void => {
        Logger.log(`pulling changes from remote...`);
        execSync(`git pull origin ${branch}`, { encoding: 'utf-8' });
        Logger.success('successfully pulled changes from remote');
    }
}

const releaseCommand = new ReleaseCommand();

export const exec = (ctx: IContext): Promise<IContext> => releaseCommand.execute(ctx);
export const help = () => releaseCommand.help();