import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { IContext, IPreparedData } from '../types.js';
import { Command } from './command.js';
import { Logger } from '../lib/logger.js';
import { FatalError } from '../lib/error.js';
import dayjs from 'dayjs';

class ReleaseCommand extends Command {
    private platforms = new Set(['github']);

    constructor() {
        super({
            pattern: '<release> <platform> <target-branch>',
            docs: [
                'Pushes the current branch to the remote repository, then creates a pull|merge request on the specified platform.',
                '',
                'This command requires the PR template file found at ~/.kraken/pr-template.md. If not found, the command will exit and no PR will be created.',
            ].join('\n')
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

            const prTitle = `${ctx.arguments.parameters['target-branch']} release ${dayjs().format('MMM-DD-YYYY')}`

            this.writeRelease({
                currentBranch,
                targetBranch: ctx.arguments.parameters['target-branch'],
                prTitle,
                data,
                repo,
                prBody
            });

            const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/pulls`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${ctx.config!.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    title: prTitle,
                    head: currentBranch.trim(),
                    body: prBody,
                    base: ctx.arguments.parameters['target-branch'],
                    draft: true,
                })
            });
    
            if (!res.ok) {
                const error = await res.text();
                throw new FatalError(`Failed to create pull request: ${error}`);
            }
    
            const pr = await res.json() as { html_url: string };
            Logger.success(`Successfully created pull request: ${pr.html_url}`);
        } catch (err) {
            if (err instanceof FatalError) {
                throw err;
            } else {
                throw new FatalError(`Failed to create GitHub pull request: ${(err as Error).message}`);
            }
        }
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
        const prTemplateFilePath = path.join(os.homedir(), '.kraken', 'pr-template.md');

        if (!fs.existsSync(prTemplateFilePath)) {
            throw new FatalError('failed to create GitHub pull request. PR template file not found.');
        }

        const prTemplate = fs.readFileSync(prTemplateFilePath, 'utf8');
        
        if (!prTemplate) {
            throw new FatalError('failed to create GitHub pull request. PR template file is empty.');
        }

        let prBody = prTemplate;

        if (prTemplate.includes('{each}')) {
            if (!prTemplate.includes('{end:each}')) {
                throw new FatalError('failed to create GitHub pull request. PR template file is missing {end:each}');
            }

            const eachMatch = prTemplate.match(/{each}([\s\S]*?){end:each}/);
            
            if (!eachMatch) {
                throw new FatalError('failed to create GitHub pull request. Could not find content between {each} and {end:each}');
            }

            let eachTemplate = eachMatch[1];

            if (eachTemplate.startsWith('\n')) {
                eachTemplate = eachTemplate.substring(1);
            }

            if (eachTemplate.endsWith('\n')) {
                eachTemplate = eachTemplate.substring(0, eachTemplate.length - 1);
            }

            const eachContent: string[] = [];

            for (const hash of data.hashes) {
                for (const match of hash.matches) {
                    let text: string = eachTemplate;
                    text = text.split('{key}').join(match);
                    text = text.split('{hash}').join(hash.hash);
                    text = text.split('{message}').join(hash.message);
                    eachContent.push(text);
                }
            }

            prBody = prBody.replace(eachMatch[0], eachContent.join(''));
        }

        return prBody;
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
            url: remoteUrl.split('\n').join(''),
            owner: owner.trim(),
            repo: repo.trim(),
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

    private writeRelease = (data: object): void => {
        try {
            const filename = `release-${dayjs().format('MM-DD-YYYY-HH:mm:ss')}.json`;
            const filePath = path.join(os.homedir(), '.kraken', 'temp', filename);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            Logger.success(`release data written to ${filePath}`);
        } catch (err) {
            Logger.error(`failed to write release file: ${(err as Error).message}`, data);
        }
    }
}

const releaseCommand = new ReleaseCommand();

export const exec = (ctx: IContext): Promise<IContext> => releaseCommand.execute(ctx);
export const help = () => releaseCommand.help();