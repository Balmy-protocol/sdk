import { ChainId, TimeString, TokenAddress } from '@types';
import { AllowanceInput, IAllowanceService, IAllowanceSource, OwnerAddress, SpenderAddress } from './types';
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
  }): Promise<bigint> {
    const result = await this.getAllowancesInChain({
      chainId,
      allowances: [{ token, owner, spender }],
      config,
    });
    return result[token][owner][spender];
  }

  async getAllowancesInChain({
    chainId,
    allowances,
    config,
  }: {
    chainId: ChainId;
    allowances: Omit<AllowanceInput, 'chainId'>[];
    config?: { timeout?: TimeString };
  }) {
    const result = await this.getAllowances({
      allowances: allowances.map((allowance) => ({ chainId, ...allowance })),
      config,
    });
    return result[chainId] ?? {};
  }

  async getAllowances({ allowances, config }: { allowances: AllowanceInput[]; config?: { timeout?: TimeString } }) {
    return timeoutPromise(
      this.source.getAllowances({
        allowances,
        config,
      }),
      config?.timeout
    );
  }
}
