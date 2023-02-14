import { BigNumber, ethers } from 'ethers';
import { AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { IMulticallService } from '@services/multicall';
import { AllowanceCheck, IAllowanceSource, OwnerAddress, SpenderAddress } from '../types';
import { timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults } from '@shared/utils';

export class RPCAllowanceSource implements IAllowanceSource {
  constructor(private readonly multicallService: IMulticallService) {}

  supportedChains(): ChainId[] {
    return this.multicallService.supportedChains();
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
      await timeoutPromise(this.getAllowancesInChain(parseInt(chainId), checks), context?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  private async getAllowancesInChain(chainId: ChainId, checks: AllowanceCheck[]) {
    const calls = checks.map(({ token, owner, spender }) => ({
      target: token,
      decode: 'uint256',
      calldata: ERC_20_INTERFACE.encodeFunctionData('allowance', [owner, spender]),
    }));
    const multicallResult: BigNumber[] = await this.multicallService.readOnlyMulticall({ chainId, calls });
    const result: Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>> = {};
    for (let i = 0; i < multicallResult.length; i++) {
      const { token, owner, spender } = checks[i];
      if (!(token in result)) result[token] = {};
      if (!(owner in result[token])) result[token][owner] = {};
      result[token][owner][spender] = multicallResult[i].toString();
    }
    return result;
  }
}

const ERC20_ABI = ['function allowance(address owner, address spender) view returns (uint256)'];
const ERC_20_INTERFACE = new ethers.utils.Interface(ERC20_ABI);
