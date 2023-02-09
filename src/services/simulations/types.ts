import { Address, AmountOfToken, ChainId, TimeString } from '@types';

type SimulationSupport = 'none' | 'gas-only' | 'state-changes';
export type SimulationQueriesSupport = {
  transaction: SimulationSupport;
  bundle: SimulationSupport;
};

export type ISimulationSource = {
  supportedQueries(): Record<ChainId, SimulationQueriesSupport>;
  simulateTransaction(_: { chainId: ChainId; tx: Transaction; config?: { timeout?: TimeString } }): Promise<SimulationResult>;
  simulateTransactionBundle(_: { chainId: ChainId; bundle: Transaction[]; config?: { timeout?: TimeString } }): Promise<SimulationResult[]>;
};
export type Transaction = { from: Address; to: Address; data?: string; value?: AmountOfToken };
export type SuccessfulSimulation = {
  successful: true;
  estimatedGas: AmountOfToken;
  stageChanges: StateChange[];
};
export type FailedSimulation = {
  successful: false;
  kind: 'invalid-tx' | 'simulation-failed' | 'unknown-error';
  message?: string;
};
export type SimulationResult = SuccessfulSimulation | FailedSimulation;
export type StateChange =
  | ({ type: 'erc20-transfer' } & ERC20TransferStateChange)
  | ({ type: 'native-asset-transfer' } & NativeTransferStateChange)
  | ({ type: 'erc20-approval' } & ERC20ApprovalStateChange);

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
