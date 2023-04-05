import { addPercentage, substractPercentage } from '@shared/utils';
import { Chain, TokenAddress } from '@types';
import { SourceQuoteResponse } from './types';

export function failed(chain: Chain, sellToken: TokenAddress, buyToken: TokenAddress, error?: any): never {
  const context = error ? ` with error ${JSON.stringify(error)}` : '';
  throw new Error(`Failed to calculate quote between ${sellToken} and ${buyToken} on ${chain.name}${context}`);
}

type SlippagelessQuote = Omit<SourceQuoteResponse, 'minBuyAmount' | 'maxSellAmount' | 'type'>;
export function addQuoteSlippage(quote: SlippagelessQuote, type: 'sell' | 'buy', slippagePercentage: number): SourceQuoteResponse {
  return type === 'sell'
    ? {
        ...quote,
        type,
        minBuyAmount: substractPercentage(quote.buyAmount, slippagePercentage),
        maxSellAmount: quote.sellAmount,
      }
    : {
        ...quote,
        type,
        maxSellAmount: addPercentage(quote.sellAmount, slippagePercentage),
        minBuyAmount: quote.buyAmount,
      };
}
