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
  | { type: 'cached'; underlyingSource: BalanceSourceInput; expiration: ExpirationConfigOptions }
  | { type: 'custom'; instance: IBalanceSource }
  | { type: 'alchemy'; key: string; protocol?: 'https' | 'wss' }
  | { type: 'moralis'; key: string };
export type BuildBalancesParams = { source: BalanceSourceInput };

export function buildBalanceService(
  params: BuildBalancesParams | undefined,
  fetchService: IFetchService,
  providerSource: IProviderSource,
  multicallService: IMulticallService
): IBalanceService {
  const source = buildSource(params?.source, { fetchService, providerSource, multicallService });
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
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService, providerSource, multicallService });
      return new CachedBalanceSource(underlying, source.expiration);
    case 'custom':
      return source.instance;
    case 'alchemy':
      return new AlchemyBalanceSource(source.key, source.protocol ?? 'https');
    case 'moralis':
      return new MoralisBalanceSource(fetchService, source.key);
  }
}
