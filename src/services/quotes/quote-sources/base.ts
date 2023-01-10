import { BigNumber } from "ethers";
import { IFetchService } from "@services/fetch/types";
import { GasPrice } from "@services/gas/types";
import { GlobalQuoteSourceConfig } from "@services/quotes/types";
import { Address, Network, TimeString, TokenAddress } from "@types";
import { BaseToken } from "@services/tokens/types";

export type QuoteSourceSupport = { buyOrders: boolean, swapAndTransfer: boolean }
export type QuoteSourceMetadata<Support extends QuoteSourceSupport> = {
  name: string,
  supports: { networks: Network[] } & Support;
  logoURI: string;
}
export type QuoteSource<
  Support extends QuoteSourceSupport,
  CustomConfigNeeded extends boolean = false,
  CustomQuoteSourceConfig = undefined
> = {
  getCustomConfig(): CustomQuoteSourceConfig
  getMetadata(): QuoteSourceMetadata<Support>
  quote(components: QuoteComponents, request: SourceQuoteRequest<Support>): Promise<SourceQuoteResponse>
}
export type QuoteComponents = {
  fetchService: IFetchService,
}

type ExtraTokenData = Pick<BaseToken, 'decimals' | 'symbol'>
export type SellOrder = { type: 'sell', sellAmount: BigNumber }
export type BuyOrder = { type: 'buy', buyAmount: BigNumber }
type BaseOrder = SellOrder | BuyOrder
type BaseSwapAccounts = { takeFrom: Address }
type BaseSwapQuoteRequest<Order extends BaseOrder, Accounts extends BaseSwapAccounts> = {
  network: Network,
  sellToken: TokenAddress,
  sellTokenData: Promise<ExtraTokenData>,
  buyToken: TokenAddress,
  buyTokenData: Promise<ExtraTokenData>,
  order: Order
  config: {
    slippagePercentage: number,
    txValidFor?: TimeString,
    timeout?: TimeString
  }
  accounts: Accounts,
  context: { gasPrice: Promise<GasPrice> },
}

export type SourceQuoteResponse = {
  sellAmount: BigNumber,
  maxSellAmount: BigNumber,
  buyAmount: BigNumber,
  minBuyAmount: BigNumber,
  type: 'sell' | 'buy',
  source: { address: Address, allowanceTarget: Address },
  calldata: string,
  estimatedGas: BigNumber,
  value?: BigNumber,
}

export type SourceQuoteRequest<
  Support extends QuoteSourceSupport,
  Order extends ConfigurableOrder<Support> = ConfigurableOrder<Support>,
  Accounts extends ConfigurableAccounts<Support> = ConfigurableAccounts<Support>
> = BaseSwapQuoteRequest<Order, Accounts>
type ConfigurableOrder<Support extends QuoteSourceSupport> = IsBuyOrder<Support> extends true ? SellOrder | BuyOrder : SellOrder
type ConfigurableAccounts<Support extends QuoteSourceSupport> = IsSwapAndTransfer<Support> extends true ? BaseSwapAccounts & { recipient?: Address } : BaseSwapAccounts
type IsSwapAndTransfer<Support extends QuoteSourceSupport> = Support['swapAndTransfer']
type IsBuyOrder<Support extends QuoteSourceSupport> = Support['buyOrders']

export abstract class BaseQuoteSource<
  Support extends QuoteSourceSupport,
  CustomConfigNeeded extends boolean,
  CustomQuoteSourceConfig
> implements QuoteSource<Support, CustomConfigNeeded, CustomQuoteSourceConfig> {

  protected readonly globalConfig: GlobalQuoteSourceConfig;
  protected readonly customConfig: CustomQuoteSourceConfig;

  constructor({ global, custom }: { global: GlobalQuoteSourceConfig, custom: CustomQuoteSourceConfig }) {
    this.globalConfig = global
    this.customConfig = custom
  }

  getCustomConfig() {
    return this.customConfig
  }

  abstract getMetadata(): QuoteSourceMetadata<Support>
  abstract quote(components: QuoteComponents, request: SourceQuoteRequest<Support>): Promise<SourceQuoteResponse>

}

export abstract class NoCustomConfigQuoteSource<Support extends QuoteSourceSupport> extends BaseQuoteSource<Support, false, undefined> {
  constructor(config: { global: GlobalQuoteSourceConfig, custom: undefined }) {
    super(config)
  }
}
