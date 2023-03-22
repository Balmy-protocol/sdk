import { ethers } from 'ethers';
import { Address, ChainId, SupportInChain, TimeString, TokenAddress } from '@types';
import { getChainByKey } from '@chains';
import { IMulticallService } from '@services/multicall/types';
import { Addresses } from '@shared/constants';
import { filterRejectedResults, isSameAddress } from '@shared/utils';
import { timeoutPromise } from '@shared/timeouts';
import { BaseTokenMetadata, IMetadataSource } from '../types';

type RPCMetadataProperties = BaseTokenMetadata;
export class RPCMetadataSource implements IMetadataSource<RPCMetadataProperties> {
  constructor(private readonly multicallService: IMulticallService) {}

  async getMetadata({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, RPCMetadataProperties>>> {
    const promises = Object.entries(addresses).map<Promise<[ChainId, Record<TokenAddress, RPCMetadataProperties>]>>(
      async ([chainId, addresses]) => [
        Number(chainId),
        await timeoutPromise(this.fetchTokensInChain(Number(chainId), addresses), config?.timeout, { reduceBy: '100' }),
      ]
    );
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  supportedProperties() {
    const properties: SupportInChain<RPCMetadataProperties> = { symbol: 'present', decimals: 'present' };
    return Object.fromEntries(this.multicallService.supportedChains().map((chainId) => [chainId, properties]));
  }

  private async fetchTokensInChain(chainId: ChainId, addresses: Address[]): Promise<Record<TokenAddress, RPCMetadataProperties>> {
    const chain = getChainByKey(chainId);
    const addressesWithoutNativeToken = addresses.filter((address) => !isSameAddress(address, Addresses.NATIVE_TOKEN));

    const calls: { target: Address; decode: string; calldata: string }[] = addressesWithoutNativeToken.flatMap((address) => [
      { target: address, decode: 'string', calldata: SYMBOL_CALLDATA },
      { target: address, decode: 'uint8', calldata: DECIMALS_CALLDATA },
    ]);
    const multicallResults = await this.multicallService.readOnlyMulticall({ chainId, calls });
    const result: Record<TokenAddress, RPCMetadataProperties> = {};
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
