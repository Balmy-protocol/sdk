import { TransactionRequest } from '@ethersproject/providers';
import { GasPrice, GasSpeed, SupportedGasValues } from '@services/gas/types';
import { BaseTokenMetadata } from '@services/metadata/types';
import { Address, AmountOfToken, ChainId, SupportInChain, TimeString, TokenAddress } from '@types';
import { Either, WithRequired } from '@utility-types';
import { BigNumberish } from 'ethers';
import { CompareQuotesBy, CompareQuotesUsing } from './quote-compare';
import { QuoteSourceMetadata, QuoteSourceSupport } from './quote-sources/base';

export type GlobalQuoteSourceConfig = {
  referrer?: {
    address: Address;
    name: string;
  };
};

export type SourceId = string;
export type SourceMetadata = QuoteSourceMetadata<QuoteSourceSupport>;
export type IQuoteService = {
  supportedSources(): Record<SourceId, SourceMetadata>;
  supportedChains(): ChainId[];
  supportedSourcesInChain(chainId: ChainId): Record<SourceId, SourceMetadata>;
  supportedGasSpeeds(): Record<ChainId, SupportInChain<SupportedGasValues>>;
  estimateQuotes(estimatedRequest: EstimatedQuoteRequest): Promise<IgnoreFailedQuotes<false, EstimatedQuoteResponse>>[];
  estimateAllQuotes<IgnoreFailed extends boolean = true>(
    request: EstimatedQuoteRequest,
    config?: {
      ignoredFailed?: IgnoreFailed;
      sort?: {
        by: CompareQuotesBy;
        using?: CompareQuotesUsing;
      };
    }
  ): Promise<IgnoreFailedQuotes<IgnoreFailed, EstimatedQuoteResponse>[]>;
  getQuote(sourceId: SourceId, request: IndividualQuoteRequest): Promise<QuoteResponse>;
  getQuotes(request: QuoteRequest): Promise<IgnoreFailedQuotes<false, QuoteResponse>>[];
  getAllQuotes<IgnoreFailed extends boolean = true>(
    request: QuoteRequest,
    config?: {
      ignoredFailed?: IgnoreFailed;
      sort?: {
        by: CompareQuotesBy;
        using?: CompareQuotesUsing;
      };
    }
  ): Promise<IgnoreFailedQuotes<IgnoreFailed, QuoteResponse>[]>;
};

export type QuoteRequest = {
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
  filters?: Either<{ includeSources: SourceId[] }, { excludeSources: SourceId[] }>;
  includeNonTransferSourcesWhenRecipientIsSet?: boolean;
  estimateBuyOrdersWithSellOnlySources?: boolean;
};

export type TokenWithOptionalPrice = BaseTokenMetadata & { price?: number };
export type QuoteTx = WithRequired<TransactionRequest, 'to' | 'from' | 'data'> & Partial<GasPrice>;
export type QuoteResponse = {
  sellToken: TokenWithOptionalPrice;
  buyToken: TokenWithOptionalPrice;
  sellAmount: AmountsOfToken;
  buyAmount: AmountsOfToken;
  maxSellAmount: AmountsOfToken;
  minBuyAmount: AmountsOfToken;
  gas: {
    estimatedGas: AmountOfToken;
    estimatedCost: AmountOfToken;
    estimatedCostInUnits: string;
    gasTokenSymbol: string;
    estimatedCostInUSD?: string;
  };
  recipient: Address;
  source: { id: SourceId; allowanceTarget: Address; name: string; logoURI: string };
  type: 'sell' | 'buy';
  tx: QuoteTx;
};

export type IndividualQuoteRequest = Omit<
  QuoteRequest,
  'filters' | 'includeNonTransferSourcesWhenRecipientIsSet' | 'estimateBuyOrdersWithSellOnlySources'
> & {
  dontFailIfSourceDoesNotSupportTransferAndRecipientIsSet?: boolean;
  estimateBuyOrderIfSourceDoesNotSupportIt?: boolean;
};

export type EstimatedQuoteRequest = Omit<QuoteRequest, 'takerAddress' | 'recipient' | 'txValidFor'>;
export type EstimatedQuoteResponse = Omit<QuoteResponse, 'recipient' | 'tx'>;

export type AmountsOfToken = {
  amount: AmountOfToken;
  amountInUnits: string;
  amountInUSD?: string;
};

export type IgnoreFailedQuotes<
  IgnoredFailed extends boolean,
  Response extends QuoteResponse | EstimatedQuoteResponse
> = IgnoredFailed extends true ? Response : Response | FailedQuote;

export type FailedQuote = { failed: true; name: string; logoURI: string; error: any };
