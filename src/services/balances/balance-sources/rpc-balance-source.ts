import { BigNumber, ethers } from 'ethers';
import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { IMulticallService } from '@services/multicall';
import { chainsIntersection } from '@chains';
import { BalanceQueriesSupport } from '../types';
import { IProviderSource } from '@services/providers/types';
import { BaseBalanceSource } from './base-balance-source';

export class RPCBalanceSource extends BaseBalanceSource {
  constructor(private readonly providerSource: IProviderSource, private readonly multicallService: IMulticallService) {
    super();
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const supportedChains = chainsIntersection(this.providerSource.supportedChains(), this.multicallService.supportedChains());
    const entries = supportedChains.map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: false }]);
    return Object.fromEntries(entries);
  }

  protected fetchERC20TokensHeldByAccountInChain(
    chainId: ChainId,
    account: Address,
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    throw new Error('Operation not supported');
  }

  protected async fetchERC20BalancesInChain(
    chainId: ChainId,
    account: Address,
    addresses: TokenAddress[],
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const calls: { target: Address; decode: string; calldata: string }[] = addresses.flatMap((address) => [
      { target: address, decode: 'uint256', calldata: ERC_20_INTERFACE.encodeFunctionData('balanceOf', [account]) },
    ]);
    const multicallResults: BigNumber[] = await this.multicallService.readOnlyMulticall({ chainId, calls });
    const result: Record<TokenAddress, AmountOfToken> = {};
    for (let i = 0; i < addresses.length; i++) {
      result[addresses[i]] = multicallResults[i].toString();
    }
    return result;
  }

  protected fetchNativeBalanceInChain(chainId: ChainId, account: Address, context?: { timeout?: TimeString }): Promise<AmountOfToken> {
    return this.providerSource
      .getProvider({ chainId })
      .getBalance(account)
      .then((balance) => balance.toString());
  }
}

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
const ERC_20_INTERFACE = new ethers.utils.Interface(ERC20_ABI);
