import { ethers } from "ethers"
import { Address, ChainId, Network, TokenAddress } from "@types"
import { Networks } from "@networks"
import { AddedProperties, BaseToken, ITokenSource } from "@services/tokens/types"
import { IMulticallService } from "@services/multicall/types"
import { Addresses } from "@shared/constants"
import { isSameAddress } from "@shared/utils"

export class ProviderTokenSource implements ITokenSource {

  constructor(private readonly multicallService: IMulticallService) { }  

  supportedNetworks(): Network[] {
    return this.multicallService.supportedNetworks()
  }

  async getTokens(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, BaseToken>>> {
    const promises = Object.entries(addresses)
      .map<Promise<[ChainId, Record<TokenAddress, BaseToken>]>>(async ([chainId, addresses]) => [
        parseInt(chainId),
        await this.fetchTokensInNetwork(parseInt(chainId), addresses)
      ])
    return Object.fromEntries(await Promise.all(promises))
  }

  addedProperties(): AddedProperties<BaseToken>[] {
    return []
  }

  private async fetchTokensInNetwork(chainId: ChainId, addresses: Address[]): Promise<Record<TokenAddress, BaseToken>> {
    const network = Networks.byKeyOrFail(chainId)
    const addressesWithoutNativeToken = addresses.filter(address => !isSameAddress(address, Addresses.NATIVE_TOKEN))

    const calls: { target: Address, decode: string, calldata: string }[] = addressesWithoutNativeToken.flatMap((address) => [
      { target: address, decode: 'string', calldata: SYMBOL_CALLDATA },
      { target: address, decode: 'uint8', calldata: DECIMALS_CALLDATA },
    ])
    const multicallResults = await this.multicallService.readOnlyMulticall({ network, calls })
    const result: Record<TokenAddress, BaseToken> = {}
    for (let i = 0; i < addressesWithoutNativeToken.length; i++) {
      const address = addressesWithoutNativeToken[i]
      const symbol: string = multicallResults[i * 2]
      const decimals: number = multicallResults[i * 2 + 1]
      result[address] = { address, symbol, decimals }
    }

    if (addressesWithoutNativeToken.length !== addresses.length) {
      result[Addresses.NATIVE_TOKEN] = { address: Addresses.NATIVE_TOKEN, symbol: network.currencySymbol, decimals: 18 }
    }

    return result
  }
}

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const ERC_20_INTERFACE = new ethers.utils.Interface(ERC20_ABI);
const SYMBOL_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('symbol')
const DECIMALS_CALLDATA = ERC_20_INTERFACE.encodeFunctionData('decimals')