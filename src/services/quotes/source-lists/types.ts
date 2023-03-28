import { GasPrice } from '@services/gas/types';
import { BaseTokenMetadata } from '@services/metadata/types';
import { Address, AmountOfToken } from '@types';
import { QuoteRequest, SourceMetadata, SourceId, QuoteTx } from '../types';

export type IQuoteSourceList = {
  supportedSources(): Record<SourceId, SourceMetadata>;
  getQuote(request: SourceListRequest): Promise<SourceListResponse>;
};

// It could happen that we don't want to trigger a promise unless it's necessary. This is specially true with some
// requests (like gas prices) when we might get rate limited, and only a few of the sources need it. So the idea here
// is to have a triggerable promise. It will only be executed when it's requested. At the same time, we will share the
// same promise between all who request it, so that we don't make extra requests
export type ITriggerablePromise<T> = {
  request: () => Promise<T>;
};

export type SourceListRequest = Omit<QuoteRequest, 'filters'> & {
  sourceId: SourceId;
  external: {
    tokenData: ITriggerablePromise<{
      sellToken: BaseTokenMetadata;
      buyToken: BaseTokenMetadata;
    }>;
    gasPrice: ITriggerablePromise<GasPrice>;
  };
};

export type SourceListResponse = {
  sellAmount: AmountOfToken;
  buyAmount: AmountOfToken;
  maxSellAmount: AmountOfToken;
  minBuyAmount: AmountOfToken;
  estimatedGas: AmountOfToken;
  type: 'sell' | 'buy';
  recipient: Address;
  source: { id: SourceId; allowanceTarget: Address; name: string; logoURI: string };
  tx: QuoteTx;
};
