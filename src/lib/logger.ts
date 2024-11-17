export class Logger {
  static log(...args: any[]) {
    console.log(...args);
  }

  static error(...args: any[]) {
    console.error('[-] ', ...args);
  }

  static success(...args: any[]) {
    console.error('[+] ', ...args);
  }

  static warning(...args: any[]) {
    console.error('[!] ', ...args);
  }
}