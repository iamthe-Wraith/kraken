import os from 'os';
import { FatalError } from './error';
import { IContext } from '../types';

interface IPattern {
  name: string;
  required: boolean;
}

interface IRegistryItem {
  description?: string;
  shortHand?: string;
  type: 'string' | 'int' | 'float' | 'boolean';
  validate?: (value: any) => boolean;
}

export class Parser {
  pattern: IPattern[] = [];

  arguments: Record<string, IRegistryItem> = {};
  parameters: Record<string, IRegistryItem> = {};
  flags: Record<string, IRegistryItem> = {};

  /**
   * @param {string} p - pattern that specifies the command name that instantiated parser is tied to, as 
   * well as all all parameters that command supports (this pattern is what sets the order of parameters
   * to be received)
   */
  constructor (p: string) {
    const pattern = p.split(' ');
    let optionalParamFound = false;

    if (pattern.length > 1) {
      const parameters = pattern.slice(1, pattern.length);
      this.pattern = parameters.map(parameter => {
        const parsedParam = parameter.replace('<', '').replace('>', '');

        if (parsedParam.indexOf('?') > -1) {
          optionalParamFound = true;

          return {
            name: parsedParam.replace('?', ''),
            required: false
          };
        } else {
          if (optionalParamFound) {
            throw new FatalError('required parameter cannot be after optional parameter');
          }

          return {
            name: parsedParam,
            required: true
          };
        }
      });
    }
  }

  /**
   * parses all command arguments that are received from command line into initial object structure
   *
   * @param {string} node - path to node in bin dir
   * @param {string} ns - path to the namespace in bin dir
   * @param {string} command - name of the command to be executed
   * @param {Array} args - rest of arguments entered (may include flags, parameters, and arguments)
   * @return {Object}
   */
  static init (_: string, ns: string, command: string, ...args: string[]) {
    if (ns) {
      let namespace: string | null = null;
  
      if (os.platform() === 'win32') {
        const nsArr = ns.split('\\\\');
        namespace = nsArr[nsArr.length - 1].split('.')[0];
      } else {
        const nsArr = ns.split('/');
        namespace = nsArr[nsArr.length - 1];
      }
  
      return {
        namespace,
        command: command || null,
        args: args || []
      };
    } else {
      throw new FatalError('no command found');
    }
  }

  /**
   * Check if a parameter or flag has already been registered with a
   * given set of identifiers.
   * @param {string} longHand
   * @param {string|undefined} shortHand
   */
  _assertNotAlreadyRegistered (longHand: string, shortHand: string) {
    [longHand, shortHand].filter(Boolean).forEach(id => {
      ['argument', 'flag'].forEach(type => {
        const registry = this[(type + 's') as ('arguments' | 'flags')];
        if (registry.hasOwnProperty(id)) {
          throw new FatalError(`${type} with identifier ${id} already exists`);
        }
      });
    });
  }

  /**
   * registers an argument with the instantiated command
   *
   * @param {string} name - name of the argument - structure: <fullName[|<abbreviatedName]>
   * @param {Object|undefined} - optional options
   * @return {this}
   *
   * @example: Parser.argument('foo|f', 'bar');
   */
  argument (name: string, opts: Record<string, string> = {}) {
    if (!name) {
      throw new FatalError('no name found in argument registration');
    }

    const [longHand, shortHand] = name.split('|');
    this._assertNotAlreadyRegistered(longHand, shortHand);
    this.arguments[longHand] = {
      shortHand: shortHand,
      type: 'string',
      ...opts
    };

    return this;
  }

  /**
   * registers a parameter with the instantiated command
   *
   * @param {string} name - the name and type of the parameter (available types: string (default), number, boolean)
   * @param {Object} - optional options
   *
   * @example: Parser.parameter('<foo:string>', 'bar');
   */
  parameter (name: string, opts: Record<string, string> = {}) {
    if (!name) {
      throw new FatalError('no name found in parameter registration');
    }

    const paramFoundInPattern = this.pattern.filter(param => param.name === name).length > 0;

    if (paramFoundInPattern) {
      if (!this.parameters.hasOwnProperty(name)) {
        this.parameters[name] = { type: 'string', ...opts };
      } else {
        throw new FatalError(`${name} is already a registered parameter`);
      }
    } else {
      throw new FatalError(`${name} was not specified in pattern`);
    }

    return this;
  }

  /**
   * registers a flag with the instantiated command
   *
   * @param {string} name - the name of the flag - structure: <fullName[|abbreviatedName]>
   * @param {Object} - optional options
   *
   * @example: Parser.flag('foo|f', 'bar');
   */
  flag (name: string, opts = {}) {
    if (!name) {
      throw new FatalError('no name found in flag registration');
    }

    const [longHand, shortHand] = name.split('|');
    this._assertNotAlreadyRegistered(longHand, shortHand);
    this.flags[longHand] = {
      shortHand: shortHand,
      type: 'string',
      ...opts
    };

    return this;
  }

  /**
   * takes a value and casts it to a specific type
   *
   * @param {string} value - the value to be casted
   * @param {string} type - the type to be casted to. allowed types: string (default), int, float, boolean
   *
   * @return {type}
   */
  castToType <T>(value: any, type: 'string' | 'int' | 'float' | 'boolean'): T {
    let castedValue: T;

    if (!type) type = 'string';

    if (type === 'string') {
      try {
        castedValue = value.toString();
        return castedValue;
      } catch (err: any) {
        throw new FatalError(err);
      }
    } else if (type === 'int') {
      castedValue = parseInt(value) as T;

      if (isNaN(castedValue as number)) {
        throw new FatalError(`${value} is not of type int`);
      }
    } else if (type === 'float') {
      castedValue = parseFloat(value) as T;

      if (isNaN(castedValue as number)) {
        throw new FatalError(`${value} is not of type float`);
      }
    } else if (type === 'boolean') {
      if (value.toLowerCase().trim() === 'true' ||
        value.toLowerCase().trim() === 't' ||
        value.trim() === '1') {
        castedValue = true as T;
      } else {
        castedValue = false as T;
      }
    } else {
      throw new FatalError(`invalid type received: ${type}`);
    }

    return castedValue;
  }

  /**
   * parses any registered arguments from the args entered by user
   *
   * @param {Array} args - the args entered by user for the command
   *
   * @return {Object}
   */
  parseArguments (args: string[]) {
    const parsed: Record<string, any> = {};

    for (const arg in this.arguments) {
      const shortHand = this.arguments[arg].shortHand;

      [`--${arg}`, `-${shortHand}`].filter(Boolean).forEach(i => {
        const index = args.indexOf(i);

        if (index !== -1) {
          let castedValue = null;

          if (args[index + 1] !== undefined) {
            castedValue = this.castToType(args[index + 1], this.arguments[arg].type);
          } else {
            throw new FatalError(`no value passed to ${i}`);
          }

          if (typeof this.arguments[arg].validate === 'function') {
            if (this.arguments[arg].validate!(castedValue)) {
              parsed[arg] = castedValue as any;
            } else {
              throw new FatalError(`${arg} failed validation`);
            }
          } else {
            parsed[arg] = castedValue as any;
          }

          args.splice(index, 2);
        }
      });
    }

    return parsed;
  }

  /**
   * parses any registered flags from the args entered by the user
   *
   * @param {Array} args - the args entered by the user (requires that parseArguments is called first
   *
   * @return {Object}
   */
  parseFlags (args: string[]) {
    const flags = { ...this.flags };
    const parsed: Record<string, boolean> = {};

    for (const flag in flags) {
      const { shortHand } = flags[flag];

      [`--${flag}`, `-${shortHand}`].forEach(name => {
        const index = args.indexOf(name);

        if (index !== -1) {
          delete parsed[name];
          parsed[flag] = true;

          args.splice(index, 1);
        } else {
          delete parsed[name];
          parsed[flag] = false;
        }
      });
    }

    return parsed;
  }

  /**
   * parses any registered parameters from the args entered by the user
   *
   * @param {Array} args - the args entered by the suer (requires that parserArguments and parseFlags are called first)
   *
   * @return {Object}
   */
  parseParameters (args: string[]) {
    const parsed: Record<string, any> = {};

    if (args.length > this.pattern.length) {
      throw new FatalError(`invalid command structure - expected ${this.pattern.length} parameters, but found ${args.length}`);
    } else {
      for (let i = 0; i < this.pattern.length; i++) {
        if (args[i] !== undefined) {
          let castedValue = null;

          if (this.pattern[i].name in this.parameters) {
            castedValue = this.castToType(args[i], this.parameters[this.pattern[i].name].type);
          } else {
            throw new FatalError(`${this.pattern[i].name} is not a registered parameters`);
          }

          if (castedValue !== null) {
            parsed[this.pattern[i].name] = castedValue;
          }
        } else {
          if (this.pattern[i].required) {
            throw new FatalError(`${this.pattern[i].name} is required`);
          }
        }
      }
    }

    return parsed;
  }

  /**
   * parses the args entered by the user
   *
   * @param {Object} ctx - the context
   *
   * @return {Object} - updated context with parsed arguments and resolves with context
   */
  parse (ctx: IContext) {
    if ('args' in ctx) {
      ctx.arguments = {
        arguments: this.parseArguments(ctx.args),
        flags: this.parseFlags(ctx.args),
        parameters: this.parseParameters(ctx.args)
      };

      return ctx;
    } else {
      throw new FatalError('no args found in context - Parser:parse');
    }
  }
}