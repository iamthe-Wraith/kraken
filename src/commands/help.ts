import fs from 'fs';
import path from 'path';
import { IContext } from '../types';
import { Command } from './command';
import { commands } from '.';
import { FatalError } from '../lib/error';
import { Logger } from '../lib/logger';

class HelpCommand extends Command {
  constructor() {
    super({
      pattern: '<help>',
      docs: `
        prints help documentation for Kraken. if a specific command is entered, documentation for that command will be printed, otherwise, general documentation will be printed, including a list of all available commands`
    });

    this.argument('command|c', {
      description: 'the command to print help documentation for'
    });
  }

  main = async (ctx: IContext): Promise<IContext> => {
    const { command = null } = ctx.arguments.arguments;

    if (command === null) {
      this.printGenDocs();
    } else if (commands.has(command)) {
      (await import(`./${command}`) as any).help();
    } else {
      throw new FatalError(`\nhelp:main error\n\ninvalid command passed to help: ${command}. \nenter 'kraken help' for a list of available commands\n`);
    }

    return ctx;
  };

  private printGenDocs = () => {
    let version = '';
  
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(require.main!.filename, '..', '..', 'package.json'), 'utf8'));
      version = `v${packageJson.version}`;
    } catch (err: any) {
      Logger.error(`\nhelp:printGenDocs error\n\nunable to retrieve kraken version\n${err.message}\n`);
    }
  
    Logger.log('\n*******************************************\n');
  
    Logger.log('Kraken');
    Logger.log(`${version}\n`);
  
    Logger.log('COMMANDS:');
    Logger.log('* for further documentation of each command, use the command|c argument');
    Logger.log('kraken help --command [commandName]');
    Logger.log('kraken help -c [commandName]\n');
  
    commands.forEach(cmd => {
      if (cmd !== 'test' && cmd !== 'printversion') {
        Logger.log(`  ${cmd}`);
      }
    });
  
    Logger.log('\n*******************************************\n');
  };
}

const helpCommand = new HelpCommand();

export const exec = (ctx: IContext): Promise<IContext> => helpCommand.execute(ctx);
export const help = () => helpCommand.help();
