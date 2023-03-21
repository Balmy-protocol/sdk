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
  | { type: 'cached'; underlyingSource: AllowanceSourceInput; expiration: ExpirationConfigOptions }
  | { type: 'custom'; instance: IAllowanceSource }
  | { type: 'alchemy'; key: string; protocol?: 'https' | 'wss' };
export type BuildAllowanceParams = { source: AllowanceSourceInput };

export function buildAllowanceService(
  params: BuildAllowanceParams | undefined,
  fetchService: IFetchService,
  multicallService: IMulticallService
): IAllowanceService {
  const source = buildSource(params?.source, { fetchService, multicallService });
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
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService, multicallService });
      return new CachedAllowanceSource(underlying, source.expiration);
    case 'custom':
      return source.instance;
    case 'alchemy':
      return new AlchemyAllowanceSource(source.key, source.protocol ?? 'https');
  }
}
