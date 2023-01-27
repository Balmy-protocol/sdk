import { TransactionRequest } from '@ethersproject/providers';
import { GasPrice, GasSpeed } from '@services/gas/types';
import { BaseToken } from '@services/tokens/types';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { Either, WithRequired } from '@utility-types';
import { BigNumber, BigNumberish } from 'ethers';
import { CompareQuotesBy, CompareQuotesUsing } from './quote-compare';
import { QuoteSourceMetadata, QuoteSourceSupport } from './quote-sources/base';

export type GlobalQuoteSourceConfig = {
  referrerAddress?: TokenAddress;
};

export type SourceMetadata = Omit<QuoteSourceMetadata<QuoteSourceSupport>, 'supports'> & {
  id: string;
  supports: QuoteSourceSupport & { chains: ChainId[] };
};
export type IQuoteService = {
  supportedChains(): Promise<ChainId[]>;
  supportedSources(): Promise<SourceMetadata[]>;
  supportedSourcesInChain(chainId: ChainId): Promise<SourceMetadata[]>;
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
  getQuote(sourceId: string, request: IndividualQuoteRequest): Promise<QuoteResponse>;
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
  filters?: Either<{ includeSources: string[] }, { excludeSources: string[] }>;
  includeNonTransferSourcesWhenRecipientIsSet?: boolean;
  estimateBuyOrdersWithSellOnlySources?: boolean;
};

export type TokenWithOptionalPrice = BaseToken & { price?: number };
export type QuoteTx = WithRequired<TransactionRequest, 'to' | 'from' | 'data'> & Partial<GasPrice>;
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
  source: { id: string; allowanceTarget: Address; name: string; logoURI: string };
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

type AmountOfToken = {
  amount: BigNumber;
  amountInUnits: number;
  amountInUSD?: number;
};

export type IgnoreFailedQuotes<
  IgnoredFailed extends boolean,
  Response extends QuoteResponse | EstimatedQuoteResponse
> = IgnoredFailed extends true ? Response : Response | FailedQuote;

export type FailedQuote = { failed: true; name: string; logoURI: string; error: any };
