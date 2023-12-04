import { IMulticallService } from '@services/multicall/types';
import { IBalanceService, IBalanceSource } from '@services/balances/types';
import { CacheConfig } from '@shared/concurrent-lru-cache';
import { RPCBalanceSource, RPCBalanceSourceConfig } from '@services/balances/balance-sources/rpc-balance-source';
import { IProviderService } from '@services/providers';
import { BalanceService } from '@services/balances/balance-service';
import { IFetchService } from '@services/fetch';
import { AlchemyBalanceSource } from '@services/balances/balance-sources/alchemy-balance-source';
import { MoralisBalanceSource } from '@services/balances/balance-sources/moralis-balance-source';
import { CachedBalanceSource } from '@services/balances/balance-sources/cached-balance-source';
import { PortalsFiBalanceSource } from '@services/balances/balance-sources/portals-fi-balance-source';
import { OneInchBalanceSource } from '@services/balances/balance-sources/1inch-balance-source';
import { MagpieBalanceSource } from '@services/balances/balance-sources/magpie-balance-source';

export type BalanceSourceInput =
  | { type: 'rpc-multicall'; config?: RPCBalanceSourceConfig }
  | { type: 'cached'; underlyingSource: BalanceSourceInput; config: CacheConfig }
  | { type: 'custom'; instance: IBalanceSource }
  | { type: 'alchemy'; key: string }
  | { type: '1inch' }
  | { type: 'magpie' }
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
      return new RPCBalanceSource(providerService, multicallService, source?.config);
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService, providerService, multicallService });
      return new CachedBalanceSource(underlying, source.config);
    case 'custom':
      return source.instance;
    case 'alchemy':
      return new AlchemyBalanceSource(source.key);
    case 'portals-fi':
      return new PortalsFiBalanceSource(fetchService, source.key);
    case '1inch':
      return new OneInchBalanceSource(fetchService);
    case 'magpie':
      return new MagpieBalanceSource(fetchService);
    case 'moralis':
      return new MoralisBalanceSource(fetchService, source.key);
  }
}
