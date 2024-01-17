import { Address, AmountOfToken, ChainId, TimeString, InputTransaction } from '@types';

type SimulationSupport = 'none' | 'gas-only' | 'state-changes';
export type SimulationQueriesSupport = {
  transaction: SimulationSupport;
  bundle: SimulationSupport;
};

export type ISimulationSource = {
  supportedQueries(): Record<ChainId, SimulationQueriesSupport>;
  simulateTransaction(_: { chainId: ChainId; tx: InputTransaction; config?: { timeout?: TimeString } }): Promise<SimulationResult>;
  simulateTransactionBundle(_: { chainId: ChainId; bundle: InputTransaction[]; config?: { timeout?: TimeString } }): Promise<SimulationResult[]>;
};
export type SuccessfulSimulation = {
  successful: true;
  estimatedGas: AmountOfToken;
  stageChanges: StateChange[];
};
export type FailedSimulation = {
  successful: false;
  kind: 'INVALID_TRANSACTION' | 'SIMULATION_FAILED' | 'UNKNOWN_ERROR';
  message?: string;
};
export type SimulationResult = SuccessfulSimulation | FailedSimulation;
export type StateChange =
  | ({ type: 'ERC20_TRANSFER' } & ERC20TransferStateChange)
  | ({ type: 'NATIVE_ASSET_TRANSFER' } & NativeTransferStateChange)
  | ({ type: 'ERC20_APPROVAL' } & ERC20ApprovalStateChange);

export type ERC20TransferStateChange = {
  from: Address;
  to: Address;
  amount: {
    amount: AmountOfToken;
    amountInUnits: string;
  };
  asset: ERC20TokenData;
};
export type NativeTransferStateChange = {
  from: Address;
  to: Address;
  amount: {
    amount: AmountOfToken;
    amountInUnits: string;
  };
  asset: NativeTokenData;
};
export type ERC20ApprovalStateChange = {
  owner: Address;
  spender: Address;
  amount: {
    amount: AmountOfToken;
    amountInUnits: string;
  };
  asset: ERC20TokenData;
};
type ERC20TokenData = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
};
type NativeTokenData = Omit<ERC20TokenData, 'address'>;
