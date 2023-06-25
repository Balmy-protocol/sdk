import { AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults } from '@shared/utils';
import { alchemySupportedChains, buildAlchemyClient } from '@shared/alchemy-rpc';
import { AllowanceCheck, IAllowanceSource, OwnerAddress, SpenderAddress } from '../types';
import { buildMagpieBalanceManagerUrl, magpieSupportedChains } from '@shared/magpie';
import { IFetchService } from '@services/fetch';

export class MagpieAllowanceSource implements IAllowanceSource {
  constructor(private readonly fetchService: IFetchService) {}

  supportedChains(): ChainId[] {
    return magpieSupportedChains();
  }

  async getAllowances({
    allowances,
    config,
  }: {
    allowances: Record<ChainId, AllowanceCheck[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>>> {
    const promises = Object.entries(allowances).map(async ([chainId, checks]) => [
      parseInt(chainId),
      await timeoutPromise(this.fetchAllowances(parseInt(chainId), checks), config?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  private async fetchAllowances(
    chainId: ChainId,
    allowances: AllowanceCheck[],
    config?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>> {
    const allowanceResults = await Promise.all(allowances.map((allowance) => this.fetchAllowance(chainId, allowance, config)));
    const result: Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>> = {};
    for (let i = 0; i < allowanceResults.length; i++) {
      const { token, owner, spender } = allowances[i];
      if (!(token in result)) result[token] = {};
      if (!(owner in result[token])) result[token][owner] = {};
      result[token][owner][spender] = allowanceResults[i];
    }
    return result;
  }

  private fetchAllowance(
    chainId: ChainId,
    { token, owner, spender }: AllowanceCheck,
    config?: { timeout?: TimeString }
  ): Promise<AmountOfToken> {
    return this.fetchService
      .fetch(`${buildMagpieBalanceManagerUrl(chainId)}/allowance?walletAddress=${owner}&tokenAddress=${token}&spenderAddress=${spender}`, {
        timeout: config?.timeout,
      })
      .then((response) => response.json());
  }
}
