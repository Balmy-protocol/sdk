import { Hex, TransactionRequest, Address as ViemAddress } from 'viem';
import { InputTransaction } from '@types';

export function mapTxToViemTx(tx: InputTransaction): TransactionRequest & { account: ViemAddress } {
  return {
    ...tx,
    data: tx.data as Hex | undefined,
    to: tx.to as ViemAddress | undefined,
    from: tx.from as ViemAddress,
    account: tx.from as ViemAddress,
    value: tx.value ? BigInt(tx.value) : undefined,
    gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
    maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
  } as TransactionRequest & { account: ViemAddress };
}
