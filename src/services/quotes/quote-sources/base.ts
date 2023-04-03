import { BigNumber } from 'ethers';
import { IFetchService } from '@services/fetch/types';
import { GasPrice } from '@services/gas/types';
import { GlobalQuoteSourceConfig } from '@services/quotes/types';
import { Address, Chain, ChainId, TimeString, TokenAddress } from '@types';
import { BaseTokenMetadata } from '@services/metadata/types';
import { IProviderSource } from '@services/providers';
import { ITriggerablePromise } from '@shared/triggerable-promise';

export type QuoteSourceSupport = { buyOrders: boolean; swapAndTransfer: boolean };
export type QuoteSourceMetadata<Support extends QuoteSourceSupport> = {
  name: string;
  supports: { chains: ChainId[] } & Support;
  logoURI: string;
};
export type QuoteSource<Support extends QuoteSourceSupport, CustomQuoteSourceConfig = undefined> = {
  getCustomConfig(): CustomQuoteSourceConfig;
  getMetadata(): QuoteSourceMetadata<Support>;
  quote(components: QuoteComponents, request: SourceQuoteRequest<Support>): Promise<SourceQuoteResponse>;
};

export type QuoteComponents = {
  providerSource: IProviderSource;
  fetchService: IFetchService;
};

export type SellOrder = { type: 'sell'; sellAmount: BigNumber };
export type BuyOrder = { type: 'buy'; buyAmount: BigNumber };
type BaseOrder = SellOrder | BuyOrder;
type BaseSwapAccounts = { takeFrom: Address };
type BaseSwapQuoteRequest<Order extends BaseOrder, Accounts extends BaseSwapAccounts> = {
  chain: Chain;
  sellToken: TokenAddress;
  buyToken: TokenAddress;
  order: Order;
  config: {
    slippagePercentage: number;
    txValidFor?: TimeString;
    timeout?: TimeString;
  };
  accounts: Accounts;
  external: {
    tokenData: ITriggerablePromise<{
      sellToken: BaseTokenMetadata;
      buyToken: BaseTokenMetadata;
    }>;
    gasPrice: ITriggerablePromise<GasPrice>;
  };
};

export type SourceQuoteResponse = {
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

export type SourceQuoteRequest<
  Support extends QuoteSourceSupport,
  Order extends ConfigurableOrder<Support> = ConfigurableOrder<Support>,
  Accounts extends ConfigurableAccounts<Support> = ConfigurableAccounts<Support>
> = BaseSwapQuoteRequest<Order, Accounts>;
type ConfigurableOrder<Support extends QuoteSourceSupport> = IsBuyOrder<Support> extends true ? SellOrder | BuyOrder : SellOrder;
type ConfigurableAccounts<Support extends QuoteSourceSupport> = IsSwapAndTransfer<Support> extends true
  ? BaseSwapAccounts & { recipient?: Address }
  : BaseSwapAccounts;
type IsSwapAndTransfer<Support extends QuoteSourceSupport> = Support['swapAndTransfer'];
type IsBuyOrder<Support extends QuoteSourceSupport> = Support['buyOrders'];
export abstract class BaseQuoteSource<Support extends QuoteSourceSupport, CustomQuoteSourceConfig>
  implements QuoteSource<Support, CustomQuoteSourceConfig>
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

  abstract getMetadata(): QuoteSourceMetadata<Support>;
  abstract quote(components: QuoteComponents, request: SourceQuoteRequest<Support>): Promise<SourceQuoteResponse>;
}

export abstract class NoCustomConfigQuoteSource<Support extends QuoteSourceSupport> extends BaseQuoteSource<Support, undefined> {
  constructor(config: { global: GlobalQuoteSourceConfig; custom: undefined }) {
    super(config);
  }
}
