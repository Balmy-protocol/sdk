import { InputTransaction } from '@types';
import { Hex, TransactionRequest } from 'viem';

export function mapTxToViemTx(tx: InputTransaction): TransactionRequest {
  return {
    ...tx,
    data: tx.data as Hex | undefined,
    to: tx.to as Hex | undefined,
    from: tx.from as Hex,
    value: tx.value ? BigInt(tx.value) : undefined,
    gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
    maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
  } as TransactionRequest;
}
