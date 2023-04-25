import { Chains } from '@chains';
import { TransactionResponse } from '@ethersproject/providers';
import { constants } from 'ethers';

export async function calculateGasSpent(...txs: TransactionResponse[]) {
  const gasSpentEach = await Promise.all(txs.map((tx) => tx.wait().then((receipt) => receipt.gasUsed.mul(receipt.effectiveGasPrice))));
  return gasSpentEach.reduce((accum, curr) => accum.add(curr), constants.Zero);
}

export const CHAINS_WITH_KNOWN_RPC_ISSUES = [Chains.AURORA, Chains.OASIS_EMERALD].map(({ chainId }) => chainId);
