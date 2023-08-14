import { LogLevel } from '@services/logs';
import { LogsService } from '@services/logs/logs-service';

export type BuildLogsParams = { level?: LogLevel };

export function buildLogsService(params: BuildLogsParams | undefined) {
  return new LogsService(params?.level ?? 'WARN');
}
