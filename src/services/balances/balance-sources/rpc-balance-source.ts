import { BigNumber, ethers } from 'ethers';
import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { IMulticallService } from '@services/multicall';
import { chainsIntersection } from '@chains';
import { Addresses } from '@shared/constants';
import { filterRejectedResults, isSameAddress } from '@shared/utils';
import { timeoutPromise } from '@shared/timeouts';
import { BalanceQueriesSupport, IBalanceSource } from '../types';
import { IProviderSource } from '@services/providers/types';

export class RPCBalanceSource implements IBalanceSource {
  constructor(private readonly providerSource: IProviderSource, private readonly multicallService: IMulticallService) {}

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const supportedChains = chainsIntersection(this.providerSource.supportedChains(), this.multicallService.supportedChains());
    const entries = supportedChains.map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: false }]);
    return Object.fromEntries(entries);
  }

  getTokensHeldByAccount(_: { account: Address; chains: ChainId[] }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    return Promise.reject(new Error('Operation not supported'));
  }

  async getBalancesForTokens({
    account,
    tokens,
    context,
  }: {
    account: Address;
    tokens: Record<ChainId, TokenAddress[]>;
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    const promises = Object.entries(tokens).map(async ([chainId, addresses]) => [
      parseInt(chainId),
      await timeoutPromise(this.fetchBalancesInChain(parseInt(chainId), account, addresses), context?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  private async fetchBalancesInChain(chainId: ChainId, account: Address, addresses: Address[]): Promise<Record<TokenAddress, AmountOfToken>> {
    const addressesWithoutNativeToken = addresses.filter((address) => !isSameAddress(address, Addresses.NATIVE_TOKEN));

    const calls: { target: Address; decode: string; calldata: string }[] = addressesWithoutNativeToken.flatMap((address) => [
      { target: address, decode: 'uint256', calldata: ERC_20_INTERFACE.encodeFunctionData('balanceOf', [account]) },
    ]);
    const [multicallResults, nativeBalance] = await Promise.all([
      this.multicallService.readOnlyMulticall({ chainId, calls }),
      addressesWithoutNativeToken.length !== addresses.length ? this.providerSource.getProvider({ chainId }).getBalance(account) : undefined,
    ]);

    const result: Record<TokenAddress, AmountOfToken> = {};
    for (let i = 0; i < addressesWithoutNativeToken.length; i++) {
      const address = addressesWithoutNativeToken[i];
      const balanceOf: BigNumber = multicallResults[i];
      result[address] = balanceOf.toString();
    }
    if (nativeBalance) {
      const nativeAddressUsed = addresses.find((address) => isSameAddress(Addresses.NATIVE_TOKEN, address))!;
      result[nativeAddressUsed] = nativeBalance.toString();
    }

    return result;
  }
}

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
const ERC_20_INTERFACE = new ethers.utils.Interface(ERC20_ABI);
