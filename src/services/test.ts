// import { Network, TransactionRequest } from "@ethersproject/providers";
// import { IQuickGasCostCalculator } from "@ports/gas-calculation/gas-calculator";
// import { Address, Token, TokenAddress } from "@types"
// import { BigNumber, BigNumberish } from "ethers";
// import { StringValue } from "ms";

// type Only<T, U> = { [P in keyof T]: T[P]; } & { [P in keyof U]?: never; };
// type Either<T, U> = Only<T, U> | Only<U, T>;

// type Speed = 'safeLow' | 'average' | 'fast'
// type SourcesConfig = { [K in keyof typeof SOURCE_BUILDERS]: NonNullable<GetConfigFromBuilder<(typeof SOURCE_BUILDERS)[K]>> };

// export type LegacyGasPrice = { gasPrice: BigNumber }
// export type EIP1159GasPrice = { maxFeePerGas: BigNumber, maxPriorityFeePerGas: BigNumber }
// export type GasPrice = LegacyGasPrice | EIP1159GasPrice
// export type GasSpeed = 'safeLow' | 'average' | 'fast'
// export type GasEstimation<NetworkGasPrice extends GasPrice> = { gasCostNativeToken: BigNumber, gasCostUSD: BigNumber } & NetworkGasPrice
// type GasService<SupportedSpeed = Speed> = {
//   supportedNetworks(): Network[];
//   estimateGas: (network: Network, tx: TransactionRequest) => Promise<BigNumber>;
//   getGasPrice: (network: Network, speed?: SupportedSpeed) => Promise<GasPrice>
//   calculateGasCost: (network: Network, tx: TransactionRequest, gasEstimation: BigNumber, speed?: SupportedSpeed) => Promise<GasEstimation<GasPrice>>;
//   getQuickGasCalculator: (network: Network) => Promise<IQuickGasCostCalculator<GasPrice>>;
// }

// type LogoURI = string
// type SupportByQuoteSource = { buyOrders: boolean, swapAndTransfer: boolean }
// export type DexMetadata<SupportByDex extends SupportByQuoteSource> = {
//   name: string,
//   supports: { networks: Network[] } & SupportByDex;
//   logoURI: LogoURI;
// }

// type Components = {
//   fetch: typeof global.fetch,
//   gasManager: GasService<any>
// }

// type QuoteSourceAdapterBuilder<
//   Adapter extends QuoteSourceAdapter<Support, Config>,
//   Support extends SupportByQuoteSource = SupportByQuoteSource,
//   Config = undefined,
// > = {
//   canBeBuilt(config: Config | undefined): boolean
//   build(config: Config): Adapter
// }

// type QuoteSourceAdapter<Support extends SupportByQuoteSource, Config = undefined> = {
//   getConfig(): Config
//   getMetadata(): DexMetadata<Support>
//   quote(_: { components: Components, request: SwapQuoteRequest<Support> }): {}
// }

// export type BaseOrder = SellOrder | BuyOrder
// export type BaseSwapConfig = { slippagePercentage: number, txValidFor: StringValue, timeout: StringValue }
// export type BaseSwapContext = { takeFrom: Address }
// type BaseSwapQuoteRequest<Order extends BaseOrder, Config extends BaseSwapConfig, Context extends BaseSwapContext> = {
//   network: Network,
//   sellToken: Token,
//   buyToken: Token,
//   order: Order
//   config: Config
//   context: Context
// }

// export type SwapQuoteResponse = {
//   sellToken: Token,
//   sellAmount: BigNumber,
//   maxSellAmount: BigNumber,
//   buyToken: Token,
//   buyAmount: BigNumber,
//   minBuyAmount: BigNumber,
//   type: 'sell' | 'buy',
//   recipient: Address
//   dex: { address: Address, allowanceTarget: Address },
//   calldata: string,
//   estimatedGas: BigNumber,
//   value?: BigNumber,
// }

// export type SellOrder = { type: 'sell', sellAmount: BigNumber }
// export type BuyOrder = { type: 'buy', buyAmount: BigNumber }
// export type SwapQuoteRequest<
//   SupportByDex extends SupportByQuoteSource,
//   Order extends ConfigurableOrder<SupportByDex> = ConfigurableOrder<SupportByDex>,
//   Config extends BaseSwapConfig = BaseSwapConfig,
//   Context extends ConfigurableContext<SupportByDex> = ConfigurableContext<SupportByDex>> = BaseSwapQuoteRequest<Order, Config, Context>
// type ConfigurableOrder<SupportByDex extends SupportByQuoteSource> = IsBuyOrder<SupportByDex> extends true ? SellOrder | BuyOrder : SellOrder
// type ConfigurableContext<SupportByDex extends SupportByQuoteSource> = IsSwapAndTransfer<SupportByDex> extends true ? BaseSwapContext & { recipient?: Address } : BaseSwapContext
// type IsSwapAndTransfer<SupportByDex extends SupportByQuoteSource> = SupportByDex['swapAndTransfer']
// type IsBuyOrder<SupportByDex extends SupportByQuoteSource> = SupportByDex['buyOrders']

// function NO_CONFIG_ADAPTER_BUILDER<
//   Adapter extends NoConfigBaseAdapter<Support>,
//   Support extends SupportByQuoteSource = GetSupportFromAdapter<Adapter>
// >(build: () => Adapter): QuoteSourceAdapterBuilder<Adapter, Support, undefined> {
//   return { canBeBuilt: () => true, build }
// }

// type GetSupportFromAdapter<T extends QuoteSourceAdapter<any, any>> = T extends QuoteSourceAdapter<infer Support, any> ? Support : never
// type GetConfigFromBuilder<T extends QuoteSourceAdapterBuilder<any, any, any>> = T extends QuoteSourceAdapterBuilder<any, any, infer Config> ? Config : never
// type GetConfigFromAdapter<T extends QuoteSourceAdapter<any, any>> = T extends QuoteSourceAdapter<any, infer Config> ? Config : never

// function CONFIG_MUST_BE_DEFINED_ADAPTER_BUILDER<
//   Adapter extends BaseAdapter<Support, Config>,
//   Support extends SupportByQuoteSource = GetSupportFromAdapter<Adapter>,
//   Config extends NonNullable<any> = GetConfigFromAdapter<Adapter>
// >
//   (build: (config: Config) => Adapter): QuoteSourceAdapterBuilder<Adapter, Support, Config> {
//   return { canBeBuilt: (config) => !!config, build }
// }


// abstract class BaseAdapter<Support extends SupportByQuoteSource, Config = undefined> implements QuoteSourceAdapter<Support, Config> {
//   constructor(protected readonly config: Config) { }

//   getConfig() {
//     return this.config
//   }

//   abstract getMetadata(): DexMetadata<Support>
//   abstract quote(_: { components: Components; request: SwapQuoteRequest<Support> }): any

// }

// abstract class NoConfigBaseAdapter<Support extends SupportByQuoteSource> extends BaseAdapter<Support> {
//   constructor() {
//     super(undefined)
//   }
// }

// class ParaswapAdapter extends NoConfigBaseAdapter<{ swapAndTransfer: true, buyOrders: true }> {

//   getMetadata(): DexMetadata<OdosSupport> {
//     throw new Error("Method not implemented.");
//   }

// }

// type OdosConfig = { pepe: boolean }
// type OdosSupport = { swapAndTransfer: false, buyOrders: false }
// class OdosSourceAdapter extends BaseAdapter<OdosSupport, OdosConfig> {

//   getMetadata(): DexMetadata<OdosSupport> {

//   }

// }

// const pepe: Partial<SourcesConfig> = {
//   odos: { pepe: true },
//   paraswap: undefined
// }


// const SOURCE_BUILDERS = {
//   odos: CONFIG_MUST_BE_DEFINED_ADAPTER_BUILDER<OdosSourceAdapter>((config) => new OdosSourceAdapter(config)),
//   paraswap: NO_CONFIG_ADAPTER_BUILDER<ParaswapAdapter>(() => new ParaswapAdapter()),

// } satisfies Record<string, QuoteSourceAdapterBuilder<any, any, any>>

// class Quoter {

//   constructor() {

//   }

// }

// function availableDexes() {

// }

// type DexId = keyof typeof SOURCE_BUILDERS

// type QuoteFilters = {
//   includeNonTransferSourcesWhenRecipientIsSet?: boolean,
//   estimateBuyOrdersWithSellOnlySources?: boolean
// } & Either<{ includeSources?: DexId[] }, { excludeSources?: DexId[] }>

// function getQuotes({ }: {
//   sellToken: TokenAddress,
//   buyToken: TokenAddress,
//   order: Either<{ type: 'sell', sellAmount: BigNumberish }, { type: 'buy', buyAmount: BigNumberish }>
//   slippagePercentage: number

//   filters: QuoteFilters,
//   takerAddress?: Address
//   recipient?: Address

//   config: {
//     ignoredFailed?: boolean
//     gasSpeed?: 'safeLow' | 'average' | 'fast',
//     sortBy?: 'least-gas' | 'most-swapped' | 'most-profitable',
//     timeout?: 'ms',
//     txValidFor?: 'ms'
//   }
// }) {

// }
// type Quote = {
//   sellAmount: AmountOfToken,
//   buyAmount: AmountOfToken,
//   maxSellAmount: AmountOfToken,
//   minBuyAmount: AmountOfToken,
//   gas: {
//     estimatedGas: string,
//     estimatedCost: string
//     estimatedCostInUnits: string
//     estimatedCostInUSD: string
//     gasTokenSymbol: string
//   }
//   swapper: { address: Address, allowanceTarget: Address, id: DexId, name: DexId },
//   type: 'sell' | 'buy',
//   tx: {
//     to: string
//     data: string
//     value?: string
//     gasLimit?: string
//   }
// }


// type AmountOfToken = {
//   amount: string
//   amountInUnits: string,
//   amountInUSD?: string
// }