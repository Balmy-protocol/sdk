import { Address, BigIntish, ChainId } from '@types';
import { IMulticallService } from '@services/multicall';
import { Uint } from '@shared/constants';
import { PERMIT2_ADDRESS, WORDS_FOR_NONCE_CALCULATION } from './config';
import { PERMIT2_ABI } from '@shared/abis/permit2';

export async function calculateNonce({
  multicall,
  chainId,
  wordSeed,
  user,
}: {
  multicall: IMulticallService;
  chainId: ChainId;
  wordSeed: BigIntish;
  user: Address;
}): Promise<bigint> {
  // Calculate words based on seed word
  const words = new Array(WORDS_FOR_NONCE_CALCULATION).fill(0).map((_, i) => BigInt(wordSeed) + BigInt(i));

  // Fetch bitmaps for user's words
  const calls = words.map((word) => ({
    address: PERMIT2_ADDRESS,
    abi: { humanReadable: PERMIT2_ABI },
    functionName: 'nonceBitmap',
    args: [user, word],
  }));

  const results = await multicall.readOnlyMulticall({ chainId, calls });

  // Find nonce
  for (let i = 0; i < results.length; i++) {
    const result = BigInt(results[i]);
    if (result < Uint.MAX_256) {
      return (words[i] << 8n) + findUnusedBit(result);
    }
  }

  throw new Error('No nonce found');
}

function findUnusedBit(value: bigint) {
  const binaryString = value.toString(2).padStart(256, '0');
  for (let i = 0; i < 256; i++) {
    if (binaryString[binaryString.length - 1 - i] === '0') {
      return BigInt(i);
    }
  }
  throw new Error('Expected to find an unused bit');
}
