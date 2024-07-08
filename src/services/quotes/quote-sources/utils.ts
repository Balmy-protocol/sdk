import { getAddress } from 'viem';
import { addPercentage, isSameAddress, subtractPercentage } from '@shared/utils';
import { Address, Chain, ChainId, TokenAddress } from '@types';
import { SourceQuoteResponse } from './types';
import { FailedToGenerateQuoteError } from '../errors';
import { SourceMetadata } from '../types';
import { Addresses } from '@shared/constants';

export function failed(metadata: SourceMetadata, chain: Chain | ChainId, sellToken: TokenAddress, buyToken: TokenAddress, error?: any): never {
  const chainId = typeof chain === 'number' ? chain : chain.chainId;
  throw new FailedToGenerateQuoteError(metadata.name, chainId, sellToken, buyToken, error);
}

type SlippagelessQuote<CustomQuoteSourceData extends Record<string, any>> = Omit<
  SourceQuoteResponse<CustomQuoteSourceData>,
  'minBuyAmount' | 'maxSellAmount' | 'type'
>;
export function addQuoteSlippage<CustomQuoteSourceData extends Record<string, any>>(
  quote: SlippagelessQuote<CustomQuoteSourceData>,
  type: 'sell' | 'buy',
  slippagePercentage: number
): SourceQuoteResponse<CustomQuoteSourceData> {
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
        maxSellAmount: addPercentage(quote.sellAmount, slippagePercentage, 'up'),
        minBuyAmount: quote.buyAmount,
      };
}

export function calculateAllowanceTarget(sellToken: TokenAddress, allowanceTarget: Address) {
  return isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : allowanceTarget;
}

export function checksum(address: Address) {
  return getAddress(address);
}
