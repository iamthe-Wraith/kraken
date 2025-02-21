import fs from 'fs';
import path from 'path';
import { IContext } from '../types.js';
import { Command } from './command.js';
import { commands, commandRegistry } from './index.js';
import { FatalError } from '../lib/error.js';
import { Logger } from '../lib/logger.js';

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
      this.printGenDocs(ctx);
    } else if (commands.has(command)) {
      const commandModule = commandRegistry[command];

      if (commandModule) {
        commandModule.help();
      } else {
        throw new FatalError(`\nhelp:main error\n\ninvalid command passed to help: ${command}. \nenter 'kraken help' for a list of available commands\n`);
      }
    } else {
      throw new FatalError(`\nhelp:main error\n\ninvalid command passed to help: ${command}. \nenter 'kraken help' for a list of available commands\n`);
    }

    return ctx;
  };

  private printGenDocs = (ctx: IContext) => {
    let version = '';
  
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), '..', '..', 'package.json'), 'utf8'));
      version = `v${packageJson.version}`;
    } catch (err: any) {
      Logger.error(`\nhelp:printGenDocs error\n\nunable to retrieve kraken version\n${err.message}\n`);
    }
  
    Logger.log('\n*******************************************\n');
  
    Logger.log('Kraken 🐙');
    Logger.log(`${version}\n`);
  
    if (!ctx.config) {
      Logger.error('no config file found. run "npm install" to generate a config file.\n');
    }

    if (
      ctx.config
      && (
        !ctx.config.jiraApiToken
        || !ctx.config.jiraBaseUrl
        || !ctx.config.jiraEmail
      )
    ) {
      Logger.error('some required fields are missing from: ~/.kraken/config.json. add the missing fields and try again.\n');
    }
    
    Logger.log('AVAILABLE COMMANDS:\n');
  
    commands.forEach(cmd => {
      if (cmd !== 'test' && cmd !== 'printversion') {
        Logger.log(`  ${cmd}`);
      }
    });

    Logger.log('\n* for further documentation of each command, use the command|c argument');
    Logger.log('kraken help --command [commandName]');
    Logger.log('kraken help -c [commandName]');
  
    Logger.log('\n*******************************************\n');
  };
}

const helpCommand = new HelpCommand();

export const exec = (ctx: IContext): Promise<IContext> => helpCommand.execute(ctx);
export const help = () => helpCommand.help();
