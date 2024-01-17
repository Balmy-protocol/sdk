import { alchemySupportedChains, buildAlchemyClient } from '@shared/alchemy-rpc';
import { timeoutPromise } from '@shared/timeouts';
import { Address, AmountOfToken, ChainId, TimeString, InputTransaction } from '@types';
import { toTrimmedHex } from '@shared/utils';
import { ISimulationSource, SimulationResult, SimulationQueriesSupport, StateChange } from '../types';

export class AlchemySimulationSource implements ISimulationSource {
  constructor(private readonly alchemyKey: string) {}

  supportedQueries(): Record<ChainId, SimulationQueriesSupport> {
    const entries = alchemySupportedChains().map<[ChainId, SimulationQueriesSupport]>((chainId) => [
      chainId,
      { transaction: 'state-changes', bundle: 'none' },
    ]);
    return Object.fromEntries(entries);
  }

  async simulateTransaction({
    chainId,
    tx,
    config,
  }: {
    chainId: ChainId;
    tx: InputTransaction;
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult> {
    try {
      const result = await this.callRPC<Result>(chainId, 'alchemy_simulateAssetChanges', [fixTransaction(tx)], config?.timeout);
      if (result.error) {
        const message = 'message' in result.error ? result.error.message : result.error;
        return {
          successful: false,
          kind: 'SIMULATION_FAILED',
          message,
        };
      }
      const stageChanges = result.changes.filter(isSupportedStateChange).map(mapStateChange);
      return {
        successful: true,
        stageChanges,
        estimatedGas: result.gasUsed,
      };
    } catch (e: any) {
      const body = e.body;
      try {
        const parsed = JSON.parse(body);
        if ('error' in parsed) {
          const {
            error: { message },
          } = parsed;
          return {
            successful: false,
            kind: 'INVALID_TRANSACTION',
            message,
          };
        }
      } catch {}
      return {
        successful: false,
        kind: 'UNKNOWN_ERROR',
        message: body,
      };
    }
  }

  async simulateTransactionBundle(_: {
    chainId: ChainId;
    bundle: InputTransaction[];
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult[]> {
    // const response = await this.callRPC<Result>(chainId, 'alchemy_simulateExecutionBundle', [bundle.map(fixTransaction)], config?.timeout)
    throw new Error('Operation not supported');
  }

  private callRPC<T>(chainId: ChainId, method: string, params: any, timeout?: TimeString): Promise<T> {
    return timeoutPromise(buildAlchemyClient(this.alchemyKey, chainId).core.send(method, params), timeout);
  }
}

function fixTransaction(tx: InputTransaction) {
  // Alchemy doesn't support zeroed data yet, so we make it undefied
  const valueBN = BigInt(tx.value ?? 0);
  const dataBN = BigInt(tx.data ?? 0);
  const value = valueBN === 0n ? undefined : toTrimmedHex(valueBN);
  const data = dataBN === 0n ? undefined : tx.data;
  return { ...tx, data, value };
}

function isSupportedStateChange(stateChange: AlchemyStateChange) {
  return stateChange.assetType === 'NATIVE' || stateChange.assetType === 'ERC20';
}

function mapStateChange(stateChange: AlchemyStateChange): StateChange {
  switch (stateChange.assetType) {
    case 'ERC20':
      const amount = {
        amount: stateChange.rawAmount,
        amountInUnits: stateChange.amount,
      };
      const asset = {
        address: stateChange.contractAddress!,
        name: stateChange.name!,
        symbol: stateChange.symbol,
        decimals: stateChange.decimals!,
      };
      if (stateChange.changeType === 'APPROVE') {
        return { type: 'ERC20_APPROVAL', owner: stateChange.from, spender: stateChange.to, amount, asset };
      } else {
        return { type: 'ERC20_TRANSFER', from: stateChange.from, to: stateChange.to, amount, asset };
      }
    case 'NATIVE':
      return {
        type: 'NATIVE_ASSET_TRANSFER',
        from: stateChange.from,
        to: stateChange.to,
        amount: {
          amount: stateChange.rawAmount,
          amountInUnits: stateChange.amount,
        },
        asset: {
          name: stateChange.name!,
          symbol: stateChange.symbol,
          decimals: stateChange.decimals!,
        },
      };
  }
  throw new Error('Should not get here');
}

type AlchemyStateChange = {
  assetType: 'NATIVE' | 'ERC20' | 'ERC721' | 'ERC1155' | 'SPECIAL_NFT';
  changeType: 'APPROVE' | 'TRANSFER';
  from: Address;
  to: Address;
  rawAmount: AmountOfToken;
  amount: string;
  symbol: string;
  decimals?: number;
  contractAddress?: Address;
  name?: string;
  tokenId?: number;
};

type Result = {
  changes: AlchemyStateChange[];
  gasUsed: AmountOfToken;
  error?: any;
};
