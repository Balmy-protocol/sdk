import { IMulticallService } from '@services/multicall/types';
import { IBalanceService, IBalanceSource } from '@services/balances/types';
import { RPCBalanceSource } from '@services/balances/balance-sources/rpc-balance-source';
import { IProviderSource } from '@services/providers';
import { BalanceService } from '@services/balances/balance-service';

export type BalanceSourceInput = { type: 'rpc' } | { type: 'custom'; instance: IBalanceSource };

export type BuildBalancesParams = { source: BalanceSourceInput };

export function buildBalanceService(
  params: BuildBalancesParams | undefined,
  providerSource: IProviderSource,
  multicallService: IMulticallService
): IBalanceService {
  const source = buildSource(params?.source, { providerSource, multicallService });
  return new BalanceService(source);
}

function buildSource(
  source: BalanceSourceInput | undefined,
  { providerSource, multicallService }: { providerSource: IProviderSource; multicallService: IMulticallService }
): IBalanceSource {
  switch (source?.type) {
    case undefined:
    case 'rpc':
      return new RPCBalanceSource(providerSource, multicallService);
    case 'custom':
      return source.instance;
  }
}
