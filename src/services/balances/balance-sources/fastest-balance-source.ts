import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { chainsUnion } from '@chains';
import { ILogger, ILogsService } from '@services/logs';
import { filterRequestForSource, fillResponseWithNewResult, doesResponseFulfilRequest, getSourcesThatSupportRequestOrFail } from './utils';
import { IBalanceSource, BalanceInput } from '../types';

// This source will take a list of sources and combine the results of each one to try to fulfil
// the request. As soon as there there is a response that is valid for the request, it will be returned
export class FastestBalanceSource implements IBalanceSource {
  private readonly logger: ILogger;

  constructor(private readonly sources: IBalanceSource[], logs: ILogsService) {
    if (sources.length === 0) throw new Error('No sources were specified');
    this.logger = logs.getLogger({ name: 'FastestBalanceSource' });
  }

  supportedChains() {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getBalances({
    tokens,
    config,
  }: {
    tokens: BalanceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>> {
    const sourcesInChains = getSourcesThatSupportRequestOrFail(tokens, this.sources);
    const reducedTimeout = reduceTimeout(config?.timeout, '100');
    return new Promise<Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>>(async (resolve, reject) => {
      const result: Record<ChainId, Record<Address, Record<TokenAddress, bigint>>> = {};
      const allPromises = sourcesInChains.map((source) =>
        timeoutPromise(
          source.getBalances({
            tokens: filterRequestForSource(tokens, source),
            config: { timeout: reducedTimeout },
          }),
          reducedTimeout
        ).then((response) => {
          fillResponseWithNewResult(result, response);
          if (doesResponseFulfilRequest(result, tokens).ok) {
            resolve(result);
          }
        })
      );

      Promise.allSettled(allPromises).then(() => {
        const isOk = doesResponseFulfilRequest(result, tokens);
        if (!isOk.ok) {
          // We couldn't fulfil the request, so we know we didn't resolve. We will revert then
          const missingText = isOk.missing.map(({ chainId, account, token }) => `${chainId}-${account}-${token}`).join(',');
          reject(new Error(`Failed to fulfil request: missing: ${missingText}`));
        }
      });
    });
  }
}
