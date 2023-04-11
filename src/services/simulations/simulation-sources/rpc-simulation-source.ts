import { IProviderService } from '@services/providers';
import { ChainId, TimeString } from '@types';
import { BigNumber, utils } from 'ethers';
import { ISimulationSource, SimulationResult, SimulationQueriesSupport, Transaction, FailedSimulation } from '../types';

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
    tx: Transaction;
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult> {
    if (!utils.isAddress(tx.from)) return invalidTx('"from" is not a valid address');
    if (!utils.isAddress(tx.to)) return invalidTx('"to" is not a valid address');
    if (!isValid(tx.data)) return invalidTx('"data" is not a valid');
    if (!isValid(tx.value)) return invalidTx('"value" is not a valid');

    try {
      const estimatedGas = await this.providerService.getEthersProvider({ chainId }).estimateGas(tx);
      return {
        successful: true,
        stageChanges: [],
        estimatedGas: estimatedGas.toString(),
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
    bundle: Transaction[];
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult[]> {
    throw new Error('Operation not supported');
  }
}

function invalidTx(message: string): FailedSimulation {
  return {
    successful: false,
    kind: 'INVALID_TRANSACTION',
    message,
  };
}

function isValid(value: string | undefined) {
  if (!value) return true;
  try {
    BigNumber.from(value);
    return true;
  } catch {
    return false;
  }
}
