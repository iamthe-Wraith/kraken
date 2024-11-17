export class FatalError extends Error {
  isFatal = true;

  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}