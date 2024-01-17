import { ILogger, LogLevel } from '../types';
import { shouldPrintLog } from '../utils';

export class ConsoleLogger implements ILogger {
  constructor(private readonly name: string, private readonly level: LogLevel) {}

  log(message?: any, ...optionalParams: any[]): void {
    this.print('LOG', message, optionalParams);
  }

  debug(message?: any, ...optionalParams: any[]): void {
    this.print('DEBUG', message, optionalParams);
  }

  info(message?: any, ...optionalParams: any[]): void {
    this.print('INFO', message, optionalParams);
  }

  warn(message?: any, ...optionalParams: any[]): void {
    this.print('WARN', message, optionalParams);
  }

  error(message?: any, ...optionalParams: any[]): void {
    this.print('ERROR', message, optionalParams);
  }

  private print(level: LogLevel, message: any | undefined, optionalParams: any[]) {
    if (shouldPrintLog(level, this.level)) {
      if (optionalParams.length > 1) {
        return console.log(new Date().toISOString() + ' [' + level + '] (' + this.name + '): ' + (message ?? ''), ...optionalParams);
      } else {
        return console.log(new Date().toISOString() + ' [' + level + '] (' + this.name + '): ' + (message ?? ''));
      }
    }
  }
}
