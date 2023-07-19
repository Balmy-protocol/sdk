import { IMulticallService } from '@services/multicall';
import { Permit2Service } from '@services/permit2/permit2-service';

export function buildPermit2Service(multicall: IMulticallService) {
  return new Permit2Service(multicall);
}
