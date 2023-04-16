import { IMulticallService } from '@services/multicall/types';
import { IBalanceService, IBalanceSource } from '@services/balances/types';
import { CacheConfig } from '@shared/concurrent-lru-cache';
import { RPCBalanceSource } from '@services/balances/balance-sources/rpc-balance-source';
import { IProviderService } from '@services/providers';
import { BalanceService } from '@services/balances/balance-service';
import { IFetchService } from '@services/fetch';
import { AlchemyBalanceSource } from '@services/balances/balance-sources/alchemy-balance-source';
import { MoralisBalanceSource } from '@services/balances/balance-sources/moralis-balance-source';
import { CachedBalanceSource } from '@services/balances/balance-sources/cached-balance-source';
import { PortalsFiBalanceSource } from '@services/balances/balance-sources/portals-fi-balance-source';

export type BalanceSourceInput =
  | { type: 'rpc-multicall' }
  | { type: 'cached'; underlyingSource: BalanceSourceInput; config: CacheConfig }
  | { type: 'custom'; instance: IBalanceSource }
  | { type: 'alchemy'; key: string; protocol?: 'https' | 'wss' }
  | { type: 'portals-fi'; key: string }
  | { type: 'moralis'; key: string };
export type BuildBalancesParams = { source: BalanceSourceInput };

export function buildBalanceService(
  params: BuildBalancesParams | undefined,
  fetchService: IFetchService,
  providerService: IProviderService,
  multicallService: IMulticallService
): IBalanceService {
  const source = buildSource(params?.source, { fetchService, providerService, multicallService });
  return new BalanceService(source);
}

function buildSource(
  source: BalanceSourceInput | undefined,
  {
    fetchService,
    providerService,
    multicallService,
  }: { fetchService: IFetchService; providerService: IProviderService; multicallService: IMulticallService }
): IBalanceSource {
  switch (source?.type) {
    case undefined:
    case 'rpc-multicall':
      return new RPCBalanceSource(providerService, multicallService);
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService, providerService, multicallService });
      return new CachedBalanceSource(underlying, source.config);
    case 'custom':
      return source.instance;
    case 'alchemy':
      return new AlchemyBalanceSource(source.key, source.protocol ?? 'https');
    case 'portals-fi':
      return new PortalsFiBalanceSource(fetchService, source.key);
    case 'moralis':
      return new MoralisBalanceSource(fetchService, source.key);
  }
}
