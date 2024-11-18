import { commands } from './commands';
import { FatalError } from './lib/error';
import { Logger } from './lib/logger';
import { Parser } from './lib/parser';
import { IContext } from './types';
import { getConfig } from './utils/config';

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
  
  if ((ctx.command !== '--version' && ctx.command !== '-v' && !commands.has(ctx.command))
  ) {
    Logger.error('invalid command');
    process.exit(1);
  }

  const command = (ctx.command === '--version' || ctx.command === '-v')
    ? 'printversion'
    : ctx.command;

  getConfig()
    .then(config => {
      ctx.config = config;
      return import(`./commands/${command}`);
    })
    .then((module: any) => {
      return module.exec(ctx);
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
