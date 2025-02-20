import fs from 'fs';
import os from 'os';
import path from 'path';
import { IContext } from '../types.js';
import { Command } from './command.js';
import { Logger } from '../lib/logger.js';
import { FatalError } from '../lib/error.js';
import dayjs from 'dayjs';

class FilesCommand extends Command {
    constructor() {
        super({
            pattern: '<statuses>',
            docs: `
              Retrieves a list of all files in the .kraken/temp directory.`.trimStart()
        });

        this.flag('issues|i', {
            description: 'Only show files prefixed with issues. These are files created by the `issues` command, and contain the issues that were found in the specified platform and are ready to be added for the release.',
        });

        this.flag('prepared|p', {
            description: 'Only show files prefixed with prepared. These are files created by the `prepare` command, and contain the hashes for each of the issues that were found in the git log.',
        });

        this.argument('count|c', {
            description: 'The number of files to show. If this argument is not provided, all files will be shown.',
        });
    }

    main = async (ctx: IContext): Promise<IContext> => {
        try {
            let files = fs.readdirSync(path.join(os.homedir(), '.kraken', 'temp'));

            // Filter out hidden files and non-JSON files
            files = files.filter(file => !file.startsWith('.') && file.endsWith('.json'));

            if (ctx.arguments.flags.issues) {
                files = files.filter(file => file.startsWith('issues-'));
            }

            if (ctx.arguments.flags.prepared) {
                files = files.filter(file => file.startsWith('prepared-'));
            }

            files.sort((a, b) => {
                const aDate = dayjs(a.split('-')[1].split('.')[0]);
                const bDate = dayjs(b.split('-')[1].split('.')[0]);
                return aDate.isAfter(bDate) ? 1 : -1;
            });

            if (ctx.arguments.arguments.count) {
                const count = parseInt(ctx.arguments.arguments.count);

                if (isNaN(count) || count < 1) {
                    throw new FatalError('Invalid count found. Must be a number greater than 0.');
                }

                files = files.slice(0, ctx.arguments.arguments.count);
            }

            if (files.length) {
                Logger.log('\nFILES');
                Logger.log('-----------------newest---------------\n');
                Logger.log(files.join('\n'));
                Logger.log('\n-----------------oldest---------------');
            } else {
                Logger.warning('No files found');
            }

            return ctx;
        } catch (err: unknown) {
            if (err instanceof FatalError) {
                throw err;
            } else {
                throw new FatalError(`Failed to list files in .kraken/temp: ${(err as Error).message}`);
            }
        }
    };
}

const filesCommand = new FilesCommand();

export const exec = (ctx: IContext): Promise<IContext> => filesCommand.execute(ctx);
export const help = () => filesCommand.help();