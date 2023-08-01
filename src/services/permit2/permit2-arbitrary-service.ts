import { encodeFunctionData, parseAbi } from 'viem';
import { calculateDeadline } from '@shared/utils';
import permit2AdapterAbi from '@shared/abis/permit2-adapter';
import {
  ArbitraryCallWithBatchPermitParams,
  ArbitraryCallWithoutPermitParams,
  ArbitraryCallWithPermitParams,
  BaseArbitraryCallParams,
  BatchPermitData,
  BatchPermitParams,
  IPermit2ArbitraryService,
  IPermit2Service,
  PermitData,
  SinglePermitParams,
} from './types';
import { PERMIT2_ADAPTER_ADDRESS } from './utils/config';
import { TransactionResponse } from '@types';

export class Permit2ArbitraryService implements IPermit2ArbitraryService {
  readonly contractAddress = PERMIT2_ADAPTER_ADDRESS;

  constructor(private readonly permit2Service: IPermit2Service) {}

  preparePermitData(args: SinglePermitParams): Promise<PermitData> {
    return this.permit2Service.preparePermitData({ ...args, spender: PERMIT2_ADAPTER_ADDRESS });
  }

  prepareBatchPermitData(args: BatchPermitParams): Promise<BatchPermitData> {
    return this.permit2Service.prepareBatchPermitData({ ...args, spender: PERMIT2_ADAPTER_ADDRESS });
  }

  buildArbitraryCallWithPermit(params: ArbitraryCallWithPermitParams) {
    return this.buildArbitraryCallInternal({
      ...params,
      functionName: 'executeWithPermit',
    });
  }

  buildArbitraryCallWithBatchPermit(params: ArbitraryCallWithBatchPermitParams): TransactionResponse {
    return this.buildArbitraryCallInternal({
      ...params,
      functionName: 'executeWithBatchPermit',
    });
  }

  buildArbitraryCallWithoutPermit(params: ArbitraryCallWithoutPermitParams): TransactionResponse {
    const permitData = {
      tokens: [],
      nonce: 0,
      signature: '0x',
      deadline: calculateDeadline(params.txValidFor),
    };
    return this.buildArbitraryCallInternal({
      ...params,
      permitData,
      functionName: 'executeWithBatchPermit',
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
      abi: permit2AdapterAbi as any, // We cast as any to avoid type checks
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
