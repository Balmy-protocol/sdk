import { ethers } from 'ethers';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { getChainByKey } from '@chains';
import { BaseTokenMetadata, ITokenSource, KeyOfToken } from '@services/tokens/types';
import { IMulticallService } from '@services/multicall/types';
import { Addresses } from '@shared/constants';
import { filterRejectedResults, isSameAddress } from '@shared/utils';
import { timeoutPromise } from '@shared/timeouts';

export class RPCTokenSource implements ITokenSource<BaseTokenMetadata> {
  constructor(private readonly multicallService: IMulticallService) {}

  async getTokens({
    addresses,
    context,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    context?: { timeout: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, BaseTokenMetadata>>> {
    const promises = Object.entries(addresses).map<Promise<[ChainId, Record<TokenAddress, BaseTokenMetadata>]>>(async ([chainId, addresses]) => [
      parseInt(chainId),
      await timeoutPromise(this.fetchTokensInChain(parseInt(chainId), addresses), context?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  tokenProperties() {
    const properties: KeyOfToken<BaseTokenMetadata>[] = ['symbol', 'decimals'];
    return Object.fromEntries(this.multicallService.supportedChains().map((chainId) => [chainId, properties]));
  }

  private async fetchTokensInChain(chainId: ChainId, addresses: Address[]): Promise<Record<TokenAddress, BaseTokenMetadata>> {
    const chain = getChainByKey(chainId);
    const addressesWithoutNativeToken = addresses.filter((address) => !isSameAddress(address, Addresses.NATIVE_TOKEN));

    const calls: { target: Address; decode: string; calldata: string }[] = addressesWithoutNativeToken.flatMap((address) => [
      { target: address, decode: 'string', calldata: SYMBOL_CALLDATA },
      { target: address, decode: 'uint8', calldata: DECIMALS_CALLDATA },
    ]);
    const multicallResults = await this.multicallService.readOnlyMulticall({ chainId, calls });
    const result: Record<TokenAddress, BaseTokenMetadata> = {};
    for (let i = 0; i < addressesWithoutNativeToken.length; i++) {
      const address = addressesWithoutNativeToken[i];
      const symbol: string = multicallResults[i * 2];
      const decimals: number = multicallResults[i * 2 + 1];
      result[address] = { symbol, decimals };
    }

    if (addressesWithoutNativeToken.length !== addresses.length) {
      result[Addresses.NATIVE_TOKEN] = { symbol: chain?.currencySymbol ?? '???', decimals: 18 };
    }

    return result;
  }
}

const ERC20_ABI = ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'];

const ERC_20_INTERFACE = new ethers.utils.Interface(ERC20_ABI);
const SYMBOL_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('symbol');
const DECIMALS_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('decimals');
