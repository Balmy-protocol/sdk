import { Address, BigIntish, ChainId } from '@types';
import { IMulticallService } from '@services/multicall';
import { IPermit2ArbitraryService, IPermit2Service } from './types';
import { calculateNonce } from './utils/calculate-nonce';
import { Permit2ArbitraryService } from './permit2-arbitrary-service';
import { PERMIT2_ADDRESS } from './utils/config';

export class Permit2Service implements IPermit2Service {
  readonly permit2ContractAddress: Address = PERMIT2_ADDRESS;
  readonly arbitrary: IPermit2ArbitraryService;

  constructor(private readonly multicallService: IMulticallService) {
    this.arbitrary = new Permit2ArbitraryService(multicallService);
  }

  async calculateNonce({ chainId, appId, user }: { chainId: ChainId; appId: BigIntish; user: Address }): Promise<string> {
    return calculateNonce({ chainId, wordSeed: appId, user, multicall: this.multicallService }).then((nonce) => nonce.toString());
  }
}
