import { TransactionRequest } from "@ethersproject/providers"
import { GasPrice, GasSpeed } from "@services/gas/types"
import { BaseToken } from "@services/tokens/types"
import { Address, Network, TimeString, TokenAddress } from "@types"
import { Either, WithRequired } from "@utility-types"
import { BigNumber, BigNumberish } from "ethers"
import { QUOTE_SOURCES } from "./sources-list"

export type GlobalQuoteSourceConfig = {
  referrerAddress?: TokenAddress,
}

export type QuoteSourcesList = typeof QUOTE_SOURCES
export type AvailableSources = keyof QuoteSourcesList & string

export type IQuoteService<SupportedSources extends AvailableSources> = {
  supportedNetworks(): Network[]
  supportedSources(): SupportedSources[]
  supportedSourcesInNetwork(network: Network): SupportedSources[]
  getQuotes(request: QuoteRequest<SupportedSources>): Promise<QuoteResponse>[]
}

// TODO:
// sortBy?: 'least-gas' | 'most-swapped' | 'most-profitable', MEJORAR NOMBRES
// ignoredFailed?: boolean

export type QuoteRequest<SupportedSources extends AvailableSources> = {
  network: Network,
  sellToken: TokenAddress,
  buyToken: TokenAddress,
  order: { type: 'sell', sellAmount: BigNumberish } | { type: 'buy', buyAmount: BigNumberish },
  slippagePercentage: number
  takerAddress: Address
  recipient?: Address
  gasSpeed?: GasSpeed,
  quoteTimeout?: TimeString,
  txValidFor?: TimeString,
  filters?: Either<{ includeSources: SupportedSources[] }, { excludeSources: SupportedSources[] }>,
  includeNonTransferSourcesWhenRecipientIsSet?: boolean,
  estimateBuyOrdersWithSellOnlySources?: boolean
}

export type TokenWithOptionalPrice = BaseToken & { price?: number }
export type QuoteTx = WithRequired<TransactionRequest, 'to' | 'from' | 'data'> & GasPrice
export type QuoteResponse = {
  sellToken: TokenWithOptionalPrice,
  buyToken: TokenWithOptionalPrice
  sellAmount: AmountOfToken,
  buyAmount: AmountOfToken,
  maxSellAmount: AmountOfToken,
  minBuyAmount: AmountOfToken,
  gas: {
    estimatedGas: BigNumber,
    estimatedCost: BigNumber
    estimatedCostInUnits: number
    gasTokenSymbol: string
    estimatedCostInUSD?: number
  }
  recipient: Address,
  swapper: { address: Address, allowanceTarget: Address, name: string, logoURI: string },
  type: 'sell' | 'buy',
  tx: QuoteTx
}


type AmountOfToken = {
  amount: BigNumber
  amountInUnits: number,
  amountInUSD?: number
}
