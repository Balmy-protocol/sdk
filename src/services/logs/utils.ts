import { LogLevel } from './types';

export function shouldPrintLog(logType: LogLevel, currentLevel: LogLevel) {
  return getLogPriority(logType) >= getLogPriority(currentLevel);
}

function getLogPriority(level: LogLevel): number {
  switch (level) {
    case 'ALL':
      return 0;
    case 'LOG':
    case 'DEBUG':
      return 10;
    case 'INFO':
      return 20;
    case 'WARN':
      return 30;
    case 'ERROR':
      return 40;
    case 'OFF':
      return Infinity;
  }
}
