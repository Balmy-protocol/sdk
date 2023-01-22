import { TransactionRequest } from '@ethersproject/providers';
import { GasPrice, GasSpeed } from '@services/gas/types';
import { BaseToken } from '@services/tokens/types';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { Either, WithRequired } from '@utility-types';
import { BigNumber, BigNumberish } from 'ethers';
import { CompareQuotesBy, CompareQuotesUsing } from './quote-compare';
import { QUOTE_SOURCES } from './sources-list';

export type GlobalQuoteSourceConfig = {
  referrerAddress?: TokenAddress;
};

export type QuoteSourcesList = typeof QUOTE_SOURCES;
export type AvailableSources = keyof QuoteSourcesList & string;

export type IQuoteService<SupportedSources extends AvailableSources> = {
  supportedChains(): ChainId[];
  supportedSources(): SupportedSources[];
  supportedSourcesInChain(chainId: ChainId): SupportedSources[];
  getQuote(sourceId: SupportedSources, request: IndividualQuoteRequest): Promise<QuoteResponse>;
  getQuotes(request: QuoteRequest<SupportedSources>): Promise<QuoteResponse>[];
  getAllQuotes<IgnoreFailed extends boolean = true>(
    request: QuoteRequest<SupportedSources>,
    config?: {
      ignoredFailed?: IgnoreFailed;
      sort?: {
        by: CompareQuotesBy;
        using?: CompareQuotesUsing;
      };
    }
  ): Promise<WithFailedQuotes<IgnoreFailed>[]>;
};

export type QuoteRequest<SupportedSources extends AvailableSources> = {
  chainId: ChainId;
  sellToken: TokenAddress;
  buyToken: TokenAddress;
  order: { type: 'sell'; sellAmount: BigNumberish } | { type: 'buy'; buyAmount: BigNumberish };
  slippagePercentage: number;
  takerAddress: Address;
  recipient?: Address;
  gasSpeed?: GasSpeed;
  quoteTimeout?: TimeString;
  txValidFor?: TimeString;
  filters?: Either<{ includeSources: SupportedSources[] }, { excludeSources: SupportedSources[] }>;
  includeNonTransferSourcesWhenRecipientIsSet?: boolean;
  estimateBuyOrdersWithSellOnlySources?: boolean;
};

export type TokenWithOptionalPrice = BaseToken & { price?: number };
export type QuoteTx = WithRequired<TransactionRequest, 'to' | 'from' | 'data'> & GasPrice;
export type QuoteResponse = {
  sellToken: TokenWithOptionalPrice;
  buyToken: TokenWithOptionalPrice;
  sellAmount: AmountOfToken;
  buyAmount: AmountOfToken;
  maxSellAmount: AmountOfToken;
  minBuyAmount: AmountOfToken;
  gas: {
    estimatedGas: BigNumber;
    estimatedCost: BigNumber;
    estimatedCostInUnits: number;
    gasTokenSymbol: string;
    estimatedCostInUSD?: number;
  };
  recipient: Address;
  source: { allowanceTarget: Address; name: string; logoURI: string };
  type: 'sell' | 'buy';
  tx: QuoteTx;
};

export type IndividualQuoteRequest = Omit<
  QuoteRequest<any>,
  'filters' | 'includeNonTransferSourcesWhenRecipientIsSet' | 'estimateBuyOrdersWithSellOnlySources'
> & {
  dontFailIfSourceDoesNotSupportTransferAndRecipientIsSet?: boolean;
  estimateBuyOrderIfSourceDoesNotSupportIt?: boolean;
};

type AmountOfToken = {
  amount: BigNumber;
  amountInUnits: number;
  amountInUSD?: number;
};

export type WithFailedQuotes<IgnoredFailed extends boolean> = IgnoredFailed extends true ? QuoteResponse : QuoteResponse | FailedQuote;

export type FailedQuote = { failed: true; name: string; logoURI: string; error: any };
