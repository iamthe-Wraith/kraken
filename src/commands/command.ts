import { FatalError } from '../lib/error.js';
import { Logger } from '../lib/logger.js';
import { Parser } from '../lib/parser.js';
import { IContext } from '../types.js';

export interface ICommandProps {
  pattern: string;
  docs?: string;
}

export class Command {
  name: string;
  parser: Parser;
  docs: string | null;

  constructor (props: ICommandProps) {
    const {
      pattern = '',
      docs = null
    } = props;

    this.name = pattern.split(' ')[0].replace('<', '').replace('>', '');
    this.parser = new Parser(pattern);
    this.docs = docs;
  }

  /**
   * this method will be overwritten by any command that needs
   * something to be done before the main piece of execution
   * can run
   *
   * >>>>> IMPORTANT! <<<<<
   * when overwiting this method, it MUST receive
   * the context as its only argument, it MUST return a Promise,
   * and it MUST resolve with the context
   */
  before (ctx: IContext): Promise<IContext> {
    return new Promise(resolve => { resolve(ctx); });
  }

  /**
   * this method will be overwritten by any command that needs
   * something to be done after the main piece of execution
   * has run
   *
   * >>>>> IMPORTANT! <<<<<
   * when overwriting this method, it MUST receive
   * the context as its only argument, it MUST return a Promise,
   * and it MUST resolve with the context
   */
  after (ctx: IContext): Promise<IContext> {
    return new Promise(resolve => { resolve(ctx); });
  }

  /**
   * this method will be overwritten by all commands and is
   * the main piece of execution for the command
   *
   * >>>>> IMPORTANT! <<<<<
   * when overwiting this method, it MUST receive
   * the context as its only argument, it MUST return a Promise
   * and it MUST resolve with the context
   */
  main (ctx: IContext): Promise<IContext> {
    return new Promise((resolve) => {
      Logger.warning('Command:main has not been overwritten');
      resolve(ctx);
    });
  }

  /**
   * the primary method to call to execute the command
   */
  execute (ctx: IContext) {
    try {
      const parsed = this.parser.parse(ctx);

      return this.before(parsed)
        .then(this.main)
        .then(this.after);
    } catch (err: any) {
      Logger.error(err.message);
      process.exit(1);
    }
  }

  /**
   * registers a new argument
   *
   * @example: Command.argument('foo|f', { type: 'string' });
   */
  argument (name: string, opts: Record<string, string>) {
    try {
      return this.parser.argument(name, opts);
    } catch (err: any) {
      Logger.error(`\nCommand:argument error\n\n${err.message}\n`);

      if (err instanceof FatalError) process.exit(1);
    }
  }

  /**
   * registers a new parameter
   *
   * @param {string} name - the name and type of the parameter - (available types: string, int, float, boolean)
   * @param {Object|undefined} opts - optional options
   *
   * @example: Command.parameter('<foo:string>', { ... });
   */
  parameter (name: string, opts: Record<string, string>) {
    try {
      return this.parser.parameter(name, opts);
    } catch (err: any) {
      Logger.error(`\nCommand:parameter error\n\n${err.message}\n`);

      if (err instanceof FatalError) process.exit(1);
    }
  }

  /**
   * registers a new flag
   *
   * @example: Command.flag('foo|f', { ... });
   */
  flag (name: string, opts: Record<string, string>) {
    try {
      return this.parser.flag(name, opts);
    } catch (err: any) {
      Logger.error(`\nCommand:flag error\n\n${err.message}\n`);

      if (err instanceof FatalError) process.exit(1);
    }
  }

  help () {
    if (this.docs === null) {
      Logger.warning('[-] no documentation has been written for this command');
    } else {
      Logger.log('\n*******************************************\n');

      Logger.log(`🐙 kraken ${this.name}\n`);
      Logger.log(`${this.docs}\n`);

      if (Object.keys(this.parser.parameters).length > 0) {
        Logger.log('...........................................\n');
        Logger.log('✅ PARAMETERS (listed in the order they must be entered) :\n');

        for (const i in this.parser.parameters) {
          const isRequired = this.parser.pattern.filter(pattern => pattern.name === i)[0].required;

          Logger.log(`${i} <${this.parser.parameters[i].type}> ${isRequired ? '' : '[optional]'}`);
          Logger.log(`${'description' in this.parser.parameters[i] ? this.parser.parameters[i].description : ''}\n`);
        }
      }

      if (Object.keys(this.parser.arguments).length > 0) {
        Logger.log('...........................................\n');
        Logger.log('✅ ARGUMENTS :\n');

        for (const i in this.parser.arguments) {
          Logger.log(`--${i}${'shortHand' in this.parser.arguments[i] && this.parser.arguments[i].shortHand ? `|-${this.parser.arguments[i].shortHand}` : ''} <${this.parser.arguments[i].type}>`);
          Logger.log(`${'description' in this.parser.arguments[i] ? this.parser.arguments[i].description : ''}\n`);
        }
      }

      if (Object.keys(this.parser.flags).length > 0) {
        Logger.log('...........................................\n');
        Logger.log('✅ FLAGS :\n');

        for (const i in this.parser.flags) {
          Logger.log(`--${i}${'shortHand' in this.parser.flags[i] && this.parser.flags[i].shortHand ? `|-${this.parser.flags[i].shortHand}` : ''}`);
          Logger.log(`${'description' in this.parser.flags[i] ? this.parser.flags[i].description : ''}\n`);
        }
      }

      Logger.log('\n*******************************************\n');
    }
  }
}