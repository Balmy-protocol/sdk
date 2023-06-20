import { ILogger, ILogsService, LogLevel } from './types';
import { ConsoleLogger } from './loggers/console-logger';

export class LogsService implements ILogsService {
  constructor(private readonly defaultLevel: LogLevel) {}

  getLogger({ name }: { name: string }): ILogger {
    return new ConsoleLogger(name, this.defaultLevel);
  }
}
