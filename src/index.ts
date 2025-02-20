import { commands, commandRegistry } from './commands/index.js';
import { FatalError } from './lib/error.js';
import { Logger } from './lib/logger.js';
import { Parser } from './lib/parser.js';
import { IContext } from './types.js';
import { getConfig } from './utils/config.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export function cli(args: [string, string, string, ...string[]]) {
  const parsed = { ...Parser.init(...args) };

  const ctx: IContext = {
    ...parsed,
    arguments: {
      arguments: {},
      flags: {},
      parameters: {},
    },
    data: {},
  };

  if (ctx.command === null) {
    Logger.error('no command provided');
    process.exit(1);
  }
  
  // Handle version command directly
  if (ctx.command === '--version' || ctx.command === '-v') {
    try {
      const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
      Logger.log(packageJson.version);
      process.exit(0);
    } catch (err) {
      Logger.error('Failed to read version information');
      process.exit(1);
    }
  }

  const command = ctx.command;
  
  if (!commands.has(command)) {
    Logger.error('invalid command');
    process.exit(1);
  }

  const commandModule = commandRegistry[command];
  if (!commandModule) {
    Logger.error(`Command module ${command} not found`);
    process.exit(1);
  }

  getConfig()
    .then(config => {
      ctx.config = config;
      return commandModule.exec(ctx);
    })
    .then((ctx: IContext) => {
      if ('preventCompletion' in ctx && ctx.preventCompletion) {
        return ctx;
      } else {
        // do some cleanup here
      }
    })
    .catch((err: Error) => {
      Logger.error(err);
      if (err instanceof FatalError) process.exit(1);
    });
}
