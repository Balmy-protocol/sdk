import { IProviderService } from '@services/providers';
import { AmountOfToken, BigIntish, ChainId, TimeString, InputTransaction } from '@types';
import { isAddress } from 'viem';
import { ISimulationSource, SimulationResult, SimulationQueriesSupport, FailedSimulation } from '../types';
import { mapTxToViemTx } from '@shared/viem';

export class RPCSimulationSource implements ISimulationSource {
  constructor(private readonly providerService: IProviderService) {}

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
    tx: InputTransaction;
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult> {
    if (!isAddress(tx.from)) return invalidTx('"from" is not a valid address');
    if (!isAddress(tx.to)) return invalidTx('"to" is not a valid address');
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
    bundle: InputTransaction[];
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult[]> {
    throw new Error('Operation not supported');
  }

  private estimateGas(chainId: ChainId, tx: InputTransaction): Promise<AmountOfToken> {
    const viemTx = mapTxToViemTx(tx);
    const viemSupported = this.providerService.supportedClients()[chainId]?.viem;
    return viemSupported
      ? this.providerService
          .getViemPublicClient({ chainId })
          .estimateGas({
            ...viemTx,
            account: viemTx.from,
          })
          .then((estimate) => estimate.toString())
      : this.providerService
          .getEthersProvider({ chainId })
          .estimateGas(tx)
          .then((estimate) => estimate.toString());
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
