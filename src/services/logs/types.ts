export type LogLevel = 'ALL' | 'LOG' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'OFF';

export type ILogsService = {
  getLogger({ name }: { name: string }): ILogger;
};

export type ILogger = {
  log(message?: any, ...optionalParams: any[]): void;
  debug(message?: any, ...optionalParams: any[]): void;
  info(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
};
