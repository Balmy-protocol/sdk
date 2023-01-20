import { IProviderSource } from '@services/providers/types';
import { MulticallService } from '@services/multicall/multicall-service';

export function buildMulticallService(providerSource: IProviderSource) {
  return new MulticallService(providerSource);
}
