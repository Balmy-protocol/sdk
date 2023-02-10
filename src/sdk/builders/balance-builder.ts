import { IMulticallService } from '@services/multicall/types';
import { IBalanceService, IBalanceSource } from '@services/balances/types';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { RPCBalanceSource } from '@services/balances/balance-sources/rpc-balance-source';
import { IProviderSource } from '@services/providers';
import { BalanceService } from '@services/balances/balance-service';
import { IFetchService } from '@services/fetch';
import { AlchemyBalanceSource } from '@services/balances/balance-sources/alchemy-balance-source';
import { MoralisBalanceSource } from '@services/balances/balance-sources/moralis-balance-source';
import { CachedBalanceSource } from '@services/balances/balance-sources/cached-balance-source';

export type BalanceSourceInput =
  | { type: 'rpc-multicall' }
  | { type: 'custom'; instance: IBalanceSource }
  | { type: 'alchemy'; key: string }
  | { type: 'moralis'; key: string };
type CachingConfig = { useCaching: false } | { useCaching: true; expiration: ExpirationConfigOptions };
export type BalanceSourceConfigInput = { caching?: CachingConfig };
export type BuildBalancesParams = { source: BalanceSourceInput; config?: BalanceSourceConfigInput };

export function buildBalanceService(
  params: BuildBalancesParams | undefined,
  fetchService: IFetchService,
  providerSource: IProviderSource,
  multicallService: IMulticallService
): IBalanceService {
  let source = buildSource(params?.source, { fetchService, providerSource, multicallService });
  if (params?.config?.caching) {
    source = new CachedBalanceSource(source);
  }
  return new BalanceService(source);
}

function buildSource(
  source: BalanceSourceInput | undefined,
  {
    fetchService,
    providerSource,
    multicallService,
  }: { fetchService: IFetchService; providerSource: IProviderSource; multicallService: IMulticallService }
): IBalanceSource {
  switch (source?.type) {
    case undefined:
    case 'rpc-multicall':
      return new RPCBalanceSource(providerSource, multicallService);
    case 'custom':
      return source.instance;
    case 'alchemy':
      return new AlchemyBalanceSource(fetchService, source.key);
    case 'moralis':
      return new MoralisBalanceSource(fetchService, source.key);
  }
}
