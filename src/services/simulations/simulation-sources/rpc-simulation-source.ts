import { IProviderService } from '@services/providers';
import { AmountOfToken, BigIntish, ChainId, TimeString, TransactionRequest } from '@types';
import { utils } from 'ethers';
import { ISimulationSource, SimulationResult, SimulationQueriesSupport, FailedSimulation } from '../types';
import { mapTxToViemTx } from '@shared/viem';

export class RPCSimulationSource implements ISimulationSource {
  constructor(private readonly providerService: IProviderService, private readonly client: 'ethers' | 'viem' = 'ethers') {}

  supportedQueries(): Record<ChainId, SimulationQueriesSupport> {
    const entries = this.providerService
      .supportedChains()
      .map<[ChainId, SimulationQueriesSupport]>((chainId) => [chainId, { transaction: 'gas-only', bundle: 'none' }]);
    return Object.fromEntries(entries);
  }

  async simulateTransaction({
    chainId,
    tx,
  }: {
    chainId: ChainId;
    tx: TransactionRequest;
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult> {
    if (!utils.isAddress(tx.from)) return invalidTx('"from" is not a valid address');
    if (!utils.isAddress(tx.to)) return invalidTx('"to" is not a valid address');
    if (!isValid(tx.data)) return invalidTx('"data" is not a valid');
    if (!isValid(tx.value)) return invalidTx('"value" is not a valid');

    try {
      const estimatedGas = await this.estimateGas(chainId, tx);
      return {
        successful: true,
        stageChanges: [],
        estimatedGas,
      };
    } catch (e: any) {
      return {
        successful: false,
        kind: 'SIMULATION_FAILED',
        message: e.reason ?? e.message ?? e,
      };
    }
  }

  async simulateTransactionBundle(_: {
    chainId: ChainId;
    bundle: TransactionRequest[];
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult[]> {
    throw new Error('Operation not supported');
  }

  private estimateGas(chainId: ChainId, tx: TransactionRequest): Promise<AmountOfToken> {
    const viemTx = mapTxToViemTx(tx);
    const promise =
      this.client === 'viem'
        ? this.providerService.getViemPublicClient({ chainId }).estimateGas({
            ...viemTx,
            account: viemTx.from,
          })
        : this.providerService.getEthersProvider({ chainId }).estimateGas(tx);
    return promise.then((estimate) => estimate.toString());
  }
}

function invalidTx(message: string): FailedSimulation {
  return {
    successful: false,
    kind: 'INVALID_TRANSACTION',
    message,
  };
}

function isValid(value: BigIntish | undefined) {
  if (!value) return true;
  try {
    BigInt(value);
    return true;
  } catch {
    return false;
  }
}
