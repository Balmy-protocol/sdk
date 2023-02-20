import { AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults } from '@shared/utils';
import { alchemySupportedChains, callAlchemyRPC } from '@shared/alchemy-rpc';
import { AllowanceCheck, IAllowanceSource, OwnerAddress, SpenderAddress } from '../types';

export class AlchemyAllowanceSource implements IAllowanceSource {
  constructor(private readonly alchemyKey: string, private readonly protocol: 'https' | 'wss') {}

  supportedChains(): ChainId[] {
    return alchemySupportedChains();
  }

  async getAllowances({
    allowances,
    context,
  }: {
    allowances: Record<ChainId, AllowanceCheck[]>;
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>>> {
    const promises = Object.entries(allowances).map(async ([chainId, checks]) => [
      parseInt(chainId),
      await timeoutPromise(this.fetchAllowancesInChain(parseInt(chainId), checks), context?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  private async fetchAllowancesInChain(
    chainId: ChainId,
    allowances: AllowanceCheck[],
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>> {
    const allowanceResults = await Promise.all(allowances.map((allowance) => this.fetchAllowanceInChain(chainId, allowance, context)));
    const result: Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>> = {};
    for (let i = 0; i < allowanceResults.length; i++) {
      const { token, owner, spender } = allowances[i];
      if (!(token in result)) result[token] = {};
      if (!(owner in result[token])) result[token][owner] = {};
      result[token][owner][spender] = allowanceResults[i];
    }
    return result;
  }

  private fetchAllowanceInChain(
    chainId: ChainId,
    { token, owner, spender }: AllowanceCheck,
    context?: { timeout?: TimeString }
  ): Promise<AmountOfToken> {
    return this.callRPC<AmountOfToken>(chainId, 'alchemy_getTokenAllowance', [{ contract: token, owner, spender }], context?.timeout);
  }

  private callRPC<T>(chainId: ChainId, method: string, params: any, timeout: TimeString | undefined): Promise<T> {
    return timeoutPromise(callAlchemyRPC(this.alchemyKey, this.protocol, chainId, method, params), timeout);
  }
}
