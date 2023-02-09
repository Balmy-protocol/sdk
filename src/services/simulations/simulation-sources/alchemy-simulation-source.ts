import { IFetchService } from '@services/fetch';
import { alchemySupportedChains, callAlchemyRPC } from '@shared/alchemy-rpc';
import { Address, AmountOfToken, ChainId, TimeString } from '@types';
import { BigNumber } from 'ethers';
import { hexValue } from 'ethers/lib/utils';
import { ISimulationSource, SimulationResult, SimulationQueriesSupport, Transaction, StateChange } from '../types';

export class AlchemySimulationSource implements ISimulationSource {
  constructor(private readonly fetchService: IFetchService, private readonly alchemyKey: string) {}

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
    tx: Transaction;
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult> {
    const response = await this.callRPC<Result>(chainId, 'alchemy_simulateAssetChanges', [fixTransaction(tx)], config?.timeout);
    if (!response.ok) {
      if (response.status === 400) {
        const {
          error: { message },
        } = await response.json();
        return {
          successful: false,
          kind: 'INVALID_TRANSACTION',
          message,
        };
      } else {
        return {
          successful: false,
          kind: 'UNKNOWN_ERROR',
          message: await response.text(),
        };
      }
    }
    const { result }: { result: Result } = await response.json();
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
  }

  async simulateTransactionBundle(_: {
    chainId: ChainId;
    bundle: Transaction[];
    config?: { timeout?: TimeString };
  }): Promise<SimulationResult[]> {
    // const response = await this.callRPC<Result>(chainId, 'alchemy_simulateExecutionBundle', [bundle.map(fixTransaction)], config?.timeout)
    throw new Error('Operation not supported');
  }

  private callRPC<T>(chainId: ChainId, method: string, params: any, timeout?: TimeString) {
    return callAlchemyRPC(this.fetchService, this.alchemyKey, chainId, method, params, timeout);
  }
}

function fixTransaction(tx: Transaction) {
  // Alchemy doesn't support zeroed data yet, so we make it undefied
  const valueBN = BigNumber.from(tx.value ?? 0);
  const dataBN = BigNumber.from(tx.data ?? 0);
  const value = valueBN.isZero() ? undefined : hexValue(valueBN.toHexString());
  const data = dataBN.isZero() ? undefined : tx.data;
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
