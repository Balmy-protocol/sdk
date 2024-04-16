import { getAddress } from 'viem';
import { addPercentage, isSameAddress, subtractPercentage } from '@shared/utils';
import { Address, Chain, TokenAddress } from '@types';
import { SourceQuoteResponse } from './types';
import { FailedToGenerateQuoteError } from '../errors';
import { SourceMetadata } from '../types';
import { Addresses } from '@shared/constants';

export function failed(metadata: SourceMetadata, chain: Chain, sellToken: TokenAddress, buyToken: TokenAddress, error?: any): never {
  throw new FailedToGenerateQuoteError(metadata.name, chain.chainId, sellToken, buyToken, error);
}

type SlippagelessQuote = Omit<SourceQuoteResponse, 'minBuyAmount' | 'maxSellAmount' | 'type'>;
export function addQuoteSlippage(quote: SlippagelessQuote, type: 'sell' | 'buy', slippagePercentage: number): SourceQuoteResponse {
  return type === 'sell'
    ? {
        ...quote,
        type,
        minBuyAmount: subtractPercentage(quote.buyAmount, slippagePercentage, 'up'),
        maxSellAmount: quote.sellAmount,
      }
    : {
        ...quote,
        type,
        maxSellAmount: BigInt(addPercentage(quote.sellAmount, slippagePercentage, 'up')),
        minBuyAmount: quote.buyAmount,
      };
}

export function calculateAllowanceTarget(sellToken: TokenAddress, allowanceTarget: Address) {
  return isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : allowanceTarget;
}

export function checksum(address: Address) {
  return getAddress(address);
}
