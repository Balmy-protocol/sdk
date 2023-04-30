import { addPercentage, substractPercentage } from '@shared/utils';
import { Chain, TokenAddress } from '@types';
import { SourceQuoteResponse } from './types';
import { FailedToGenerateQuoteError } from '../errors';
import { SourceMetadata } from '../types';

export function failed(metadata: SourceMetadata, chain: Chain, sellToken: TokenAddress, buyToken: TokenAddress, error?: any): never {
  throw new FailedToGenerateQuoteError(metadata.name, chain.chainId, sellToken, buyToken, error);
}

type SlippagelessQuote = Omit<SourceQuoteResponse, 'minBuyAmount' | 'maxSellAmount' | 'type'>;
export function addQuoteSlippage(quote: SlippagelessQuote, type: 'sell' | 'buy', slippagePercentage: number): SourceQuoteResponse {
  return type === 'sell'
    ? {
        ...quote,
        type,
        minBuyAmount: BigInt(substractPercentage(quote.buyAmount, slippagePercentage, 'up')),
        maxSellAmount: quote.sellAmount,
      }
    : {
        ...quote,
        type,
        maxSellAmount: BigInt(addPercentage(quote.sellAmount, slippagePercentage, 'up')),
        minBuyAmount: quote.buyAmount,
      };
}
