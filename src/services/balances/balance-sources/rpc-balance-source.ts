import { BigNumber, ethers } from 'ethers';
import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { IMulticallService } from '@services/multicall';
import { chainsIntersection } from '@chains';
import { BalanceQueriesSupport } from '../types';
import { IProviderSource } from '@services/providers/types';
import { SingleChainBaseBalanceSource } from './base/single-chain-base-balance-source';

export class RPCBalanceSource extends SingleChainBaseBalanceSource {
  constructor(private readonly providerSource: IProviderSource, private readonly multicallService: IMulticallService) {
    super();
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const supportedChains = chainsIntersection(this.providerSource.supportedChains(), this.multicallService.supportedChains());
    const entries = supportedChains.map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: false }]);
    return Object.fromEntries(entries);
  }

  protected fetchERC20TokensHeldByAccountsInChain(
    chainId: ChainId,
    accounts: Address[],
    context?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, AmountOfToken>>> {
    throw new Error('Operation not supported');
  }

  protected async fetchERC20BalancesForAccountsInChain(
    chainId: ChainId,
    accounts: Record<Address, TokenAddress[]>,
    context?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, AmountOfToken>>> {
    const pairs = Object.entries(accounts).flatMap(([account, tokens]) => tokens.map((token) => ({ account, token })));
    const calls: { target: Address; decode: string; calldata: string }[] = pairs.map(({ account, token }) => ({
      target: token,
      decode: 'uint256',
      calldata: ERC_20_INTERFACE.encodeFunctionData('balanceOf', [account]),
    }));
    const multicallResults: BigNumber[] = await this.multicallService.readOnlyMulticall({ chainId, calls });
    const result: Record<Address, Record<TokenAddress, AmountOfToken>> = {};
    for (let i = 0; i < pairs.length; i++) {
      const { account, token } = pairs[i];
      if (!(account in result)) result[account] = {};
      result[account][token] = multicallResults[i].toString();
    }
    return result;
  }

  protected async fetchNativeBalancesInChain(
    chainId: ChainId,
    accounts: Address[],
    context?: { timeout?: TimeString }
  ): Promise<Record<Address, AmountOfToken>> {
    const entries = accounts.map(async (account) => [account, await this.fetchNativeBalance(chainId, account)]);
    return Object.fromEntries(await Promise.all(entries));
  }

  private fetchNativeBalance(chainId: ChainId, account: Address) {
    try {
      return this.providerSource
        .getProvider({ chainId })
        .getBalance(account)
        .then((balance) => balance.toString());
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
}

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
const ERC_20_INTERFACE = new ethers.utils.Interface(ERC20_ABI);
