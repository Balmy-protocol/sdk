import { IProviderService } from '@services/providers/types';
import { MulticallService } from '@services/multicall/multicall-service';

export function buildMulticallService(providerService: IProviderService) {
  return new MulticallService(providerService);
}
