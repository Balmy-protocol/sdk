import { addPercentage, substractPercentage } from '@shared/utils';
import { Chain, TokenAddress } from '@types';
import { BigNumber } from 'ethers';
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
        minBuyAmount: BigNumber.from(substractPercentage(quote.buyAmount.toString(), slippagePercentage, 'down')),
        maxSellAmount: quote.sellAmount,
      }
    : {
        ...quote,
        type,
        maxSellAmount: BigNumber.from(addPercentage(quote.sellAmount.toString(), slippagePercentage, 'up')),
        minBuyAmount: quote.buyAmount,
      };
}
