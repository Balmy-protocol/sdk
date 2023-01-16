import { Addresses } from '@shared/constants';
import { calculatePercentage, isSameAddress } from '@shared/utils';
import { Chain, TokenAddress } from '@types';
import { SourceQuoteResponse } from './base';

export function failed(chain: Chain, sellToken: TokenAddress, buyToken: TokenAddress, error?: any) {
  const context = error ? ` with error ${JSON.stringify(error)}` : '';
  throw new Error(`Failed to calculate quote between ${sellToken} and ${buyToken} on ${chain.name}${context}`);
}

type SlippagelessQuote = Omit<SourceQuoteResponse, 'minBuyAmount' | 'maxSellAmount' | 'type'>;
export function addQuoteSlippage(quote: SlippagelessQuote, type: 'sell' | 'buy', slippagePercentage: number): SourceQuoteResponse {
  return type === 'sell'
    ? {
        ...quote,
        type,
        minBuyAmount: quote.buyAmount.sub(calculatePercentage(quote.buyAmount, slippagePercentage)),
        maxSellAmount: quote.sellAmount,
      }
    : {
        ...quote,
        type,
        maxSellAmount: quote.sellAmount.add(calculatePercentage(quote.sellAmount, slippagePercentage)),
        minBuyAmount: quote.buyAmount,
      };
}

export function isNativeWrapOrUnwrap(chain: Chain, sellToken: TokenAddress, buyToken: TokenAddress) {
  return !isSameAddress(sellToken, buyToken) && isNativeOrWToken(chain, sellToken) && isNativeOrWToken(chain, buyToken);
}
const isNativeOrWToken = (chain: Chain, address: TokenAddress) =>
  isSameAddress(address, chain.wToken) || isSameAddress(address, Addresses.NATIVE_TOKEN);
