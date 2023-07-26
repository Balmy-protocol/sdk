import { encodeFunctionData, parseAbi } from 'viem';
import { IMulticallService } from '@services/multicall';
import { calculateDeadline } from '@shared/utils';
import { PERMIT2_ADAPTER_ABI } from '@shared/abis/permit2-adapter';
import { Addresses } from '@shared/constants';
import {
  ArbitraryCallWithBatchPermitParams,
  ArbitraryCallWithoutPermitParams,
  ArbitraryCallWithPermitParams,
  BaseArbitraryCallParams,
  BatchPermitData,
  BatchPermitParams,
  IPermit2ArbitraryService,
  Permit2Transaction,
  PermitData,
  SinglePermitParams,
} from './types';
import { calculateNonce } from './utils/calculate-nonce';
import { PERMIT2_ADAPTER_ADDRESS, PERMIT2_ADDRESS } from './utils/config';
import { PERMIT2_TRANSFER_FROM_TYPES, PERMIT2_BATCH_TRANSFER_FROM_TYPES } from './utils/eip712-types';

export class Permit2ArbitraryService implements IPermit2ArbitraryService {
  readonly contractAddress = PERMIT2_ADAPTER_ADDRESS;

  constructor(private readonly multicallService: IMulticallService) {}

  async preparePermitData({ appId, chainId, token, amount, signerAddress, signatureValidFor }: SinglePermitParams): Promise<PermitData> {
    const nonce = await calculateNonce({ chainId, wordSeed: appId, user: signerAddress, multicall: this.multicallService }).then((nonce) =>
      nonce.toString()
    );
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
          spender: PERMIT2_ADAPTER_ADDRESS,
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

  async prepareBatchPermitData({ appId, chainId, tokens, signerAddress, signatureValidFor }: BatchPermitParams): Promise<BatchPermitData> {
    const nonce = await calculateNonce({ chainId, wordSeed: appId, user: signerAddress, multicall: this.multicallService }).then((nonce) =>
      nonce.toString()
    );
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
          spender: PERMIT2_ADAPTER_ADDRESS,
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

  buildArbitraryCallWithPermit(params: ArbitraryCallWithPermitParams) {
    return this.buildArbitraryCallInternal({
      ...params,
      functionName: 'executeWithPermit',
    });
  }

  buildArbitraryCallWithBatchPermit(params: ArbitraryCallWithBatchPermitParams): Permit2Transaction {
    return this.buildArbitraryCallInternal({
      ...params,
      functionName: 'executeWithBatchPermit',
    });
  }

  buildArbitraryCallWithoutPermit(params: ArbitraryCallWithoutPermitParams): Permit2Transaction {
    const permitData = {
      token: Addresses.ZERO_ADDRESS,
      nonce: 0,
      signature: '0x',
      deadline: calculateDeadline(params.txValidFor),
    };
    return this.buildArbitraryCallInternal({
      ...params,
      permitData,
      functionName: 'executeWithPermit',
    });
  }

  private buildArbitraryCallInternal({
    permitData: { deadline, ...permitData },
    calls,
    allowanceTargets,
    distribution,
    functionName,
  }: BaseArbitraryCallParams & { functionName: string }) {
    if (calls.length === 0) throw new Error('Must submit at least one call');
    const repeatedToken = findRepeatedKey(distribution ?? {});
    if (repeatedToken) throw new Error(`Found token '${repeatedToken}' more than once, with different casing`);

    const allowances = allowanceTargets?.map(({ token, target }) => ({ token, allowanceTarget: target })) ?? [];
    const encodedCalls = calls.map((call) =>
      'data' in call
        ? {
            target: call.to,
            data: call.data,
            value: call.value ?? 0,
          }
        : {
            target: call.address,
            data: encodeFunctionData({
              abi: 'json' in call.abi ? call.abi.json : parseAbi(call.abi.humanReadable),
              functionName: call.functionName,
              args: call.args ?? [],
            }),
            value: call.value ?? 0,
          }
    );
    const transferOut = Object.entries(distribution ?? {}).map(([token, distribution]) => ({ token, distribution }));
    const totalValue = calls.reduce((sum, { value }) => sum + BigInt(value ?? 0), 0n);

    const data = encodeFunctionData({
      abi: parseAbi(PERMIT2_ADAPTER_ABI),
      functionName,
      args: [permitData, allowances, encodedCalls, transferOut, deadline],
    });

    return {
      to: PERMIT2_ADAPTER_ADDRESS,
      data,
      value: totalValue.toString(),
    };
  }
}

function findRepeatedKey(object: Record<string, any>) {
  const keys = new Set<string>();
  for (const key in object) {
    const lower = key.toLowerCase();
    if (keys.has(lower)) {
      return key;
    }
    keys.add(lower);
  }
  return undefined;
}
