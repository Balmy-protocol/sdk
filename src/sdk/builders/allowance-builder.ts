import { IFetchService } from '@services/fetch';
import { IMulticallService } from '@services/multicall/types';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { IAllowanceService, IAllowanceSource } from '@services/allowances/types';
import { RPCAllowanceSource } from '@services/allowances/allowance-sources/rpc-allowance-source';
import { AllowanceService } from '@services/allowances/allowance-service';
import { CachedAllowanceSource } from '@services/allowances/allowance-sources/cached-allowance-source';
import { AlchemyAllowanceSource } from '@services/allowances/allowance-sources/alchemy-allowance-source';

export type AllowanceSourceInput =
  | { type: 'rpc-multicall' }
  | { type: 'custom'; instance: IAllowanceSource }
  | { type: 'alchemy'; key: string; protocol?: 'https' | 'wss' };
type CachingConfig = { useCaching: false } | { useCaching: true; expiration: ExpirationConfigOptions };
export type AllowanceSourceConfigInput = { caching?: CachingConfig };
export type BuildAllowancesParams = { source: AllowanceSourceInput; config?: AllowanceSourceConfigInput };

export function buildAllowanceService(
  params: BuildAllowancesParams | undefined,
  fetchService: IFetchService,
  multicallService: IMulticallService
): IAllowanceService {
  let source = buildSource(params?.source, { fetchService, multicallService });
  if (params?.config?.caching?.useCaching) {
    source = new CachedAllowanceSource(source, params.config.caching.expiration);
  }
  return new AllowanceService(source);
}

function buildSource(
  source: AllowanceSourceInput | undefined,
  { fetchService, multicallService }: { fetchService: IFetchService; multicallService: IMulticallService }
): IAllowanceSource {
  switch (source?.type) {
    case undefined:
    case 'rpc-multicall':
      return new RPCAllowanceSource(multicallService);
    case 'custom':
      return source.instance;
    case 'alchemy':
      return new AlchemyAllowanceSource(source.key, source.protocol ?? 'https');
  }
}
