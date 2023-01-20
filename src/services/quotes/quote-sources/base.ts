import { BigNumber } from 'ethers';
import { IFetchService } from '@services/fetch/types';
import { GasPrice } from '@services/gas/types';
import { GlobalQuoteSourceConfig } from '@services/quotes/types';
import { Address, Chain, TimeString, TokenAddress } from '@types';
import { BaseToken } from '@services/tokens/types';
import { PartialOnly, WithRequired } from '@utility-types';

export type QuoteSourceSupport = { buyOrders: boolean; swapAndTransfer: boolean };
export type QuoteSourceMetadata<Support extends QuoteSourceSupport> = {
  name: string;
  supports: { chains: Chain[] } & Support;
  logoURI: string;
};
export type QuoteSource<Support extends QuoteSourceSupport, CustomConfigNeeded extends boolean = false, CustomQuoteSourceConfig = undefined> = {
  getCustomConfig(): CustomQuoteSourceConfig;
  getMetadata(): QuoteSourceMetadata<Support>;
  getQuote(
    components: QuoteComponents,
    request: SourceQuoteRequest<Support, { type: 'quote' }>
  ): Promise<SourceQuoteResponse<{ type: 'quote' }>>;
  estimateQuote(
    components: QuoteComponents,
    request: SourceQuoteRequest<Support, { type: 'estimation' }>
  ): Promise<SourceQuoteResponse<{ type: 'estimation' }>>;
};
export type QuoteComponents = {
  fetchService: IFetchService;
};
export type QuoteType = { type: 'quote' | 'estimation' };

type ExtraTokenData = Pick<BaseToken, 'decimals' | 'symbol'>;
export type SellOrder = { type: 'sell'; sellAmount: BigNumber };
export type BuyOrder = { type: 'buy'; buyAmount: BigNumber };
type BaseOrder = SellOrder | BuyOrder;
type BaseAccounts = { takeFrom?: Address; recipient?: Address };
type BaseSwapQuoteRequest<Order extends BaseOrder, Accounts extends BaseAccounts> = {
  chain: Chain;
  sellToken: TokenAddress;
  sellTokenData: Promise<ExtraTokenData>;
  buyToken: TokenAddress;
  buyTokenData: Promise<ExtraTokenData>;
  order: Order;
  config: {
    slippagePercentage: number;
    txValidFor?: TimeString;
    timeout?: TimeString;
  };
  accounts: Accounts;
  context: { gasPrice: Promise<GasPrice> };
};

export type SourceQuoteResponse<QuoteKind extends QuoteType = { type: 'estimation' }> = QuoteKind extends { type: 'quote' }
  ? BaseSourceQuoteResponse
  : PartialOnly<BaseSourceQuoteResponse, 'tx'>;
type BaseSourceQuoteResponse = {
  sellAmount: BigNumber;
  maxSellAmount: BigNumber;
  buyAmount: BigNumber;
  minBuyAmount: BigNumber;
  type: 'sell' | 'buy';
  allowanceTarget: Address;
  estimatedGas: BigNumber;
  tx: {
    to: Address;
    calldata: string;
    value?: BigNumber;
  };
};

export type SourceQuoteRequest<Support extends QuoteSourceSupport, QuoteKind extends QuoteType = { type: 'estimation' }> = BaseSwapQuoteRequest<
  ConfigurableOrder<Support>,
  QuoteKind extends { type: 'quote' } ? WithRequired<BaseAccounts, 'takeFrom'> : BaseAccounts
>;
type ConfigurableOrder<Support extends QuoteSourceSupport> = IsBuyOrder<Support> extends true ? SellOrder | BuyOrder : SellOrder;
type IsBuyOrder<Support extends QuoteSourceSupport> = Support['buyOrders'];

export abstract class BaseQuoteSource<Support extends QuoteSourceSupport, CustomConfigNeeded extends boolean, CustomQuoteSourceConfig>
  implements QuoteSource<Support, CustomConfigNeeded, CustomQuoteSourceConfig>
{
  protected readonly globalConfig: GlobalQuoteSourceConfig;
  protected readonly customConfig: CustomQuoteSourceConfig;

  constructor({ global, custom }: { global: GlobalQuoteSourceConfig; custom: CustomQuoteSourceConfig }) {
    this.globalConfig = global;
    this.customConfig = custom;
  }

  getCustomConfig() {
    return this.customConfig;
  }

  async getQuote(
    components: QuoteComponents,
    request: SourceQuoteRequest<Support, { type: 'quote' }>
  ): Promise<SourceQuoteResponse<{ type: 'quote' }>> {
    const response = await this.quote(components, request);
    if (!response.tx) {
      throw new Error('This should be set');
    }
    return response as SourceQuoteResponse<{ type: 'quote' }>;
  }

  estimateQuote(
    components: QuoteComponents,
    request: SourceQuoteRequest<Support, { type: 'estimation' }>
  ): Promise<SourceQuoteResponse<{ type: 'estimation' }>> {
    return this.quote(components, request);
  }

  abstract getMetadata(): QuoteSourceMetadata<Support>;
  protected abstract quote(
    components: QuoteComponents,
    request: SourceQuoteRequest<Support, { type: 'quote' | 'estimation' }>
  ): Promise<SourceQuoteResponse<{ type: 'estimation' }>>;
}

export abstract class NoCustomConfigQuoteSource<Support extends QuoteSourceSupport> extends BaseQuoteSource<Support, false, undefined> {
  constructor(config: { global: GlobalQuoteSourceConfig; custom: undefined }) {
    super(config);
  }
}
