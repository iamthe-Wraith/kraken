import type { IContext } from '../types.js';
import * as filesCmd from './files.js';
import * as helpCmd from './help.js';
import * as issuesCmd from './issues.js';
import * as prepareCmd from './prepare.js';
import * as projectsCmd from './projects.js';
import * as releaseCmd from './release.js';
import * as statusesCmd from './statuses.js';

export const commands = new Set([
    'files',
    'help',
    'issues',
    'prepare',
    'projects',
    'release',
    'statuses',
]);

export interface CommandModule {
    exec: (ctx: IContext) => Promise<IContext>;
    help: () => void;
}

// Create a static mapping of commands
export const commandRegistry: Record<string, CommandModule> = {
    files: { exec: filesCmd.exec, help: filesCmd.help },
    help: { exec: helpCmd.exec, help: helpCmd.help },
    issues: { exec: issuesCmd.exec, help: issuesCmd.help },
    prepare: { exec: prepareCmd.exec, help: prepareCmd.help },
    projects: { exec: projectsCmd.exec, help: projectsCmd.help },
    release: { exec: releaseCmd.exec, help: releaseCmd.help },
    statuses: { exec: statusesCmd.exec, help: statusesCmd.help },
};
