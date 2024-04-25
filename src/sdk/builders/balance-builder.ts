import { IBalanceService, IBalanceSource } from '@services/balances/types';
import { CacheConfig } from '@shared/concurrent-lru-cache';
import { RPCBalanceSource, RPCBalanceSourceConfig } from '@services/balances/balance-sources/rpc-balance-source';
import { IProviderService } from '@services/providers';
import { BalanceService } from '@services/balances/balance-service';
import { IFetchService } from '@services/fetch';
import { CachedBalanceSource } from '@services/balances/balance-sources/cached-balance-source';
import { OneInchBalanceSource } from '@services/balances/balance-sources/1inch-balance-source';
import { FastestBalanceSource } from '@services/balances/balance-sources/fastest-balance-source';
import { BuildProviderParams, buildProviderService } from './provider-builder';

export type BalanceSourceInput =
  | { type: 'rpc-multicall'; config?: RPCBalanceSourceConfig; customProvider?: BuildProviderParams }
  | { type: 'cached'; underlyingSource: BalanceSourceInput; config: CacheConfig }
  | { type: 'custom'; instance: IBalanceSource }
  | { type: '1inch' }
  | { type: 'fastest'; sources: BalanceSourceInput[] };
export type BuildBalancesParams = { source: BalanceSourceInput };

export function buildBalanceService(
  params: BuildBalancesParams | undefined,
  fetchService: IFetchService,
  providerService: IProviderService
): IBalanceService {
  const source = buildSource(params?.source, { fetchService, providerService });
  return new BalanceService(source);
}

function buildSource(
  source: BalanceSourceInput | undefined,
  { fetchService, providerService }: { fetchService: IFetchService; providerService: IProviderService }
): IBalanceSource {
  switch (source?.type) {
    case undefined:
    case 'rpc-multicall':
      const provider = source?.customProvider ? buildProviderService(source.customProvider) : providerService;
      return new RPCBalanceSource(provider, source?.config);
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService, providerService });
      return new CachedBalanceSource(underlying, source.config);
    case 'custom':
      return source.instance;
    case '1inch':
      return new OneInchBalanceSource(fetchService);
    case 'fastest':
      return new FastestBalanceSource(source.sources.map((source) => buildSource(source, { fetchService, providerService })));
  }
}
