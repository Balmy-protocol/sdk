import { ethers } from 'ethers';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { Chains, getChainByKey } from '@chains';
import { BaseToken, ITokenSource, PropertiesRecord } from '@services/tokens/types';
import { IMulticallService } from '@services/multicall/types';
import { Addresses } from '@shared/constants';
import { filterRejectedResults, isSameAddress } from '@shared/utils';
import { timeoutPromise } from '@shared/timeouts';

export class RPCTokenSource implements ITokenSource {
  constructor(private readonly multicallService: IMulticallService) {}

  supportedChains(): ChainId[] {
    return this.multicallService.supportedChains();
  }

  async getTokens({
    addresses,
    context,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    context?: { timeout: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, BaseToken>>> {
    const promises = Object.entries(addresses).map<Promise<[ChainId, Record<TokenAddress, BaseToken>]>>(async ([chainId, addresses]) => [
      parseInt(chainId),
      await timeoutPromise(this.fetchTokensInChain(parseInt(chainId), addresses), context?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  tokenProperties(): PropertiesRecord<BaseToken> {
    return {
      address: 'present',
      symbol: 'present',
      decimals: 'present',
    };
  }

  private async fetchTokensInChain(chainId: ChainId, addresses: Address[]): Promise<Record<TokenAddress, BaseToken>> {
    const chain = getChainByKey(chainId);
    const addressesWithoutNativeToken = addresses.filter((address) => !isSameAddress(address, Addresses.NATIVE_TOKEN));

    const calls: { target: Address; decode: string; calldata: string }[] = addressesWithoutNativeToken.flatMap((address) => [
      { target: address, decode: 'string', calldata: SYMBOL_CALLDATA },
      { target: address, decode: 'uint8', calldata: DECIMALS_CALLDATA },
    ]);
    const multicallResults = await this.multicallService.readOnlyMulticall({ chainId, calls });
    const result: Record<TokenAddress, BaseToken> = {};
    for (let i = 0; i < addressesWithoutNativeToken.length; i++) {
      const address = addressesWithoutNativeToken[i];
      const symbol: string = multicallResults[i * 2];
      const decimals: number = multicallResults[i * 2 + 1];
      result[address] = { address, symbol, decimals };
    }

    if (addressesWithoutNativeToken.length !== addresses.length) {
      result[Addresses.NATIVE_TOKEN] = { address: Addresses.NATIVE_TOKEN, symbol: chain?.currencySymbol ?? '???', decimals: 18 };
    }

    return result;
  }
}

const ERC20_ABI = ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'];

const ERC_20_INTERFACE = new ethers.utils.Interface(ERC20_ABI);
const SYMBOL_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('symbol');
const DECIMALS_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('decimals');
