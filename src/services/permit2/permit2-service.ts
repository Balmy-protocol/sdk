import { Address, BigIntish, ChainId } from '@types';
import { IMulticallService } from '@services/multicall';
import {
  BatchPermitData,
  GenericBatchPermitParams,
  GenericSinglePermitParams,
  IPermit2ArbitraryService,
  IPermit2Service,
  PermitData,
} from './types';
import { Permit2ArbitraryService } from './permit2-arbitrary-service';
import { PERMIT2_ADDRESS, WORDS_FOR_NONCE_CALCULATION } from './utils/config';
import { calculateDeadline } from '@shared/utils';
import { PERMIT2_BATCH_TRANSFER_FROM_TYPES, PERMIT2_TRANSFER_FROM_TYPES } from './utils/eip712-types';
import { PERMIT2_ABI } from '@shared/abis/permit2';
import { Uint } from '@shared/constants';

export class Permit2Service implements IPermit2Service {
  readonly permit2ContractAddress: Address = PERMIT2_ADDRESS;
  readonly arbitrary: IPermit2ArbitraryService;

  constructor(private readonly multicallService: IMulticallService) {
    this.arbitrary = new Permit2ArbitraryService(this);
  }

  async calculateNonce({ chainId, appId, user }: { chainId: ChainId; appId: BigIntish; user: Address }): Promise<string> {
    // Calculate words based on seed word
    const words = new Array(WORDS_FOR_NONCE_CALCULATION).fill(0).map((_, i) => BigInt(appId) + BigInt(i));

    // Fetch bitmaps for user's words
    const calls = words.map((word) => ({
      address: PERMIT2_ADDRESS,
      abi: { humanReadable: PERMIT2_ABI },
      functionName: 'nonceBitmap',
      args: [user, word],
    }));

    const results = await this.multicallService.readOnlyMulticall({ chainId, calls });

    // Find nonce
    for (let i = 0; i < results.length; i++) {
      const result = BigInt(results[i]);
      if (result < Uint.MAX_256) {
        return ((words[i] << 8n) + findUnusedBit(result)).toString();
      }
    }

    throw new Error('No nonce found');
  }

  async preparePermitData({
    appId,
    chainId,
    spender,
    token,
    amount,
    signerAddress,
    signatureValidFor,
  }: GenericSinglePermitParams): Promise<PermitData> {
    const nonce = await this.calculateNonce({ chainId, appId, user: signerAddress });
    const deadline = calculateDeadline(signatureValidFor).toString();
    return {
      dataToSign: {
        types: PERMIT2_TRANSFER_FROM_TYPES,
        domain: {
          name: 'Permit2',
          chainId,
          verifyingContract: PERMIT2_ADDRESS,
        },
        message: {
          permitted: { token, amount: amount.toString() },
          spender,
          nonce,
          deadline,
        },
        primaryType: 'PermitTransferFrom',
      },
      permitData: {
        token,
        amount: amount.toString(),
        nonce,
        deadline,
      },
    };
  }

  async prepareBatchPermitData({
    appId,
    chainId,
    spender,
    tokens,
    signerAddress,
    signatureValidFor,
  }: GenericBatchPermitParams): Promise<BatchPermitData> {
    const nonce = await this.calculateNonce({ chainId, appId, user: signerAddress });
    const deadline = calculateDeadline(signatureValidFor).toString();
    return {
      dataToSign: {
        types: PERMIT2_BATCH_TRANSFER_FROM_TYPES,
        domain: {
          name: 'Permit2',
          chainId,
          verifyingContract: PERMIT2_ADDRESS,
        },
        message: {
          permitted: Object.entries(tokens).map(([token, amount]) => ({ token, amount: amount.toString() })),
          spender,
          nonce,
          deadline,
        },
        primaryType: 'PermitBatchTransferFrom',
      },
      permitData: {
        nonce,
        deadline,
        tokens: Object.entries(tokens).map(([token, amount]) => ({ token, amount: amount.toString() })),
      },
    };
  }
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
