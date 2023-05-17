import { AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { AllowanceCheck, IAllowanceService, IAllowanceSource, OwnerAddress, SpenderAddress } from './types';
import { timeoutPromise } from '@shared/timeouts';

export class AllowanceService implements IAllowanceService {
  constructor(private readonly source: IAllowanceSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  async getAllowanceInChain({
    chainId,
    token,
    owner,
    spender,
    config,
  }: {
    chainId: ChainId;
    token: TokenAddress;
    owner: OwnerAddress;
    spender: SpenderAddress;
    config?: { timeout?: TimeString };
  }): Promise<AmountOfToken> {
    const { [spender]: result } = await this.getAllowancesInChain({ chainId, token, owner, spenders: [spender], config });
    return result;
  }

  async getAllowancesInChain({
    chainId,
    token,
    owner,
    spenders,
    config,
  }: {
    chainId: ChainId;
    token: TokenAddress;
    owner: OwnerAddress;
    spenders: SpenderAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<SpenderAddress, AmountOfToken>> {
    const allowancesInChain = spenders.map((spender) => ({ token, owner, spender }));
    const result = await this.getMultipleAllowancesInChain({
      chainId,
      check: allowancesInChain,
      config,
    });
    return result[token][owner];
  }

  async getMultipleAllowancesInChain({
    chainId,
    check,
    config,
  }: {
    chainId: ChainId;
    check: AllowanceCheck[];
    config?: { timeout?: TimeString };
  }) {
    const result = await timeoutPromise(
      this.source.getAllowances({
        allowances: { [chainId]: check },
        config,
      }),
      config?.timeout
    );
    return result[chainId] ?? {};
  }
}
