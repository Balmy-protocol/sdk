import { BigIntish } from '@types';
import { SourceListResponse, StringifiedSourceListResponse } from './types';

export function bigintify(quote: StringifiedSourceListResponse): SourceListResponse {
  return {
    ...quote,
    sellAmount: BigInt(quote.sellAmount),
    buyAmount: BigInt(quote.buyAmount),
    maxSellAmount: BigInt(quote.maxSellAmount),
    minBuyAmount: BigInt(quote.minBuyAmount),
    estimatedGas: toBigInt(quote.estimatedGas),
    tx: {
      ...quote.tx,
      value: toBigInt(quote.tx.value),
      maxPriorityFeePerGas: toBigInt(quote.tx.maxPriorityFeePerGas),
      maxFeePerGas: toBigInt(quote.tx.maxFeePerGas),
      gasPrice: toBigInt(quote.tx.gasPrice),
      gasLimit: toBigInt(quote.tx.gasLimit),
    },
  };
}

function toBigInt(value: BigIntish | undefined) {
  return value === undefined ? undefined : BigInt(value);
}
