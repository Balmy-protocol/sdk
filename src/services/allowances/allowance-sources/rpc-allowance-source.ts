import { ChainId, TimeString, TokenAddress } from '@types';
import { IMulticallService } from '@services/multicall';
import { AllowanceCheck, IAllowanceSource, OwnerAddress, SpenderAddress } from '../types';
import { timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults } from '@shared/utils';
import ERC20_ABI from '@shared/abis/erc20';

export class RPCAllowanceSource implements IAllowanceSource {
  constructor(private readonly multicallService: IMulticallService) {}

  supportedChains(): ChainId[] {
    return this.multicallService.supportedChains();
  }

  async getAllowances({
    allowances,
    config,
  }: {
    allowances: Record<ChainId, AllowanceCheck[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, bigint>>>>> {
    const promises = Object.entries(allowances).map(async ([chainId, checks]) => [
      parseInt(chainId),
      await timeoutPromise(this.getAllowancesInChain(parseInt(chainId), checks), config?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  private async getAllowancesInChain(chainId: ChainId, checks: AllowanceCheck[]) {
    const calls = checks.map(({ token, owner, spender }) => ({
      address: token,
      abi: { json: ERC20_ABI },
      functionName: 'allowance',
      args: [owner, spender],
    }));
    const multicallResults = await this.multicallService.tryReadOnlyMulticall({ chainId, calls });
    const result: Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, bigint>>> = {};
    for (let i = 0; i < multicallResults.length; i++) {
      const multicallResult = multicallResults[i];
      if (multicallResult.status === 'failure') continue;
      const { token, owner, spender } = checks[i];
      if (!(token in result)) result[token] = {};
      if (!(owner in result[token])) result[token][owner] = {};
      result[token][owner][spender] = multicallResult.result.toString();
    }
    return result;
  }
}
