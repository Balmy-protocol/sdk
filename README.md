# Balmy SDK

A comprehensive TypeScript SDK for interacting with the Balmy protocol and various blockchain networks.

## 🧪 Installation

### Yarn

```bash
yarn add @balmy/sdk
```

### NPM

```bash
npm install @balmy/sdk
```

## Features

- Multi-chain support with comprehensive chain definitions
- Type-safe interactions with blockchain networks
- Built-in services for common blockchain operations
- Support for various DeFi operations including:
  - Token balances and allowances
  - Price feeds
  - Gas estimation
  - DCA (Dollar Cost Averaging)
  - Permit2 token approvals
  - Earn protocols
  - Quote fetching
  - Block and transaction metadata

## Core Types

### Basic Types

- `Address`: Ethereum address string
- `TokenAddress`: Token contract address
- `ChainId`: Network chain ID
- `TimeString`: Time representation
- `Timestamp`: Unix timestamp
- `BigIntish`: Big number representation (string | number | bigint)

### Chain Definition

```typescript
type Chain = {
  chainId: ChainId;
  name: string;
  ids: string[];
  nativeCurrency: { symbol: string; name: string };
  wToken: Address;
  publicRPCs: string[];
  explorer: string;
  testnet?: boolean;
};
```

### Transaction Types

- `InputTransaction`: Transaction input parameters
- `BuiltTransaction`: Built transaction ready for submission
- `ContractCall`: Smart contract interaction parameters

### Token Amounts

```typescript
type AmountsOfToken = {
  amount: bigint;
  amountInUnits: string;
  amountInUSD?: string;
};
```

## Quick Start

### 👷🏽‍♀️ Building the SDK

```typescript
import { buildSDK } from "@balmy/sdk";

const sdk = buildSDK(config);
```

### ⚖️ Getting Balance for Multiple Tokens

```typescript
const accountBalances = await sdk.balanceService.getBalancesForTokens({
  account: "0x000000000000000000000000000000000000dead",
  tokens: {
    [Chains.ETHEREUM.chainId]: [
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
    ],
    [Chains.OPTIMISM.chainId]: [
      "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC
      "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
    ],
  },
  config: {
    timeout: "30s",
  },
});
```

### 💸 Getting Allowances

```typescript
const accountAllowances = await sdk.allowanceService.getAllowances({
  chainId: Chains.ETHEREUM.chainId,
  token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
  owner: "0x000000000000000000000000000000000000dead",
  spenders: ["0x6666666600000000000000000000000000009999"],
});
```

### 🔄 Getting Trade Quotes

```typescript
const allQuotes = await sdk.quoteService.getAllQuotesWithTxs({
  request: {
    chainId: Chains.ETHEREUM.chainId,
    sellToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    buyToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    order: {
      type: "sell",
      sellAmount: utils.parseUnits("1000", 6), // 1000 USDC
    },
    slippagePercentage: 1,
    takerAddress: signer.address,
    gasSpeed: {
      speed: "instant",
    },
  },
  config: {
    sort: {
      by: "most-swapped-accounting-for-gas",
    },
  },
});
```

## Services

### Allowances Service

The Allowances Service provides functionality to check and manage token allowances across different chains.

#### Objective and Potential

- **Objective**: Enable efficient management of token approvals across multiple chains and protocols
- **Potential Use Cases**:
  - Batch checking multiple token approvals in a single call
  - Optimizing gas costs by checking approvals before transactions
  - Managing permissions for DeFi protocols and dApps
  - Cross-chain allowance monitoring and management

#### Methods

##### `supportedChains()`

Returns an array of chain IDs that are supported by the service.

```typescript
const chains = sdk.allowanceService.supportedChains();
```

##### `getAllowanceInChain(params)`

Gets the allowance for a specific token and spender on a given chain.

```typescript
const allowance = await sdk.allowanceService.getAllowanceInChain({
  chainId: Chains.ETHEREUM.chainId,
  token: "0x...", // Token address
  owner: "0x...", // Owner address
  spender: "0x...", // Spender address
  config: { timeout: TimeString },
});
```

##### `getAllowancesInChain(params)`

Gets multiple allowances in a single call for a specific chain.

```typescript
const allowances = await sdk.allowanceService.getAllowancesInChain({
  chainId: Chains.ETHEREUM.chainId,
  allowances: [
    { token: "0x...", owner: "0x...", spender: "0x..." },
    { token: "0x...", owner: "0x...", spender: "0x..." },
  ],
  config: { timeout: TimeString },
});
```

##### `getAllowances(params)`

Gets allowances across multiple chains in a single call.

```typescript
const allowances = await sdk.allowanceService.getAllowances({
  allowances: [
    {
      chainId: Chains.ETHEREUM.chainId,
      token: "0x...",
      owner: "0x...",
      spender: "0x...",
    },
    {
      chainId: Chains.OPTIMISM.chainId,
      token: "0x...",
      owner: "0x...",
      spender: "0x...",
    },
  ],
  config: { timeout: TimeString },
});
```

### Balances Service

The Balances Service allows querying token balances across multiple chains and tokens.

#### Objective and Potential

- **Objective**: Provide a unified interface for retrieving token balances across multiple chains
- **Potential Use Cases**:
  - Portfolio tracking across multiple chains
  - Balance monitoring for DeFi positions
  - Multi-chain wallet integration
  - Automated balance checks for trading strategies

```typescript
// Get balances for multiple tokens across chains
const balances = await sdk.balanceService.getBalancesForTokens({
  account: "0x...",
  tokens: {
    [Chains.ETHEREUM.chainId]: ["0x...", "0x..."],
    [Chains.OPTIMISM.chainId]: ["0x...", "0x..."],
  },
});
```

### Quotes Service

The Quotes Service provides comprehensive functionality for getting trade quotes from various DEX aggregators.

#### Objective and Potential

- **Objective**: Aggregate and optimize trade quotes from multiple DEX sources
- **Potential Use Cases**:
  - Finding the best trade routes across multiple DEXs
  - Gas-optimized trading strategies
  - Cross-chain arbitrage opportunities
  - Automated trading systems
  - Price impact analysis

#### Methods

##### `supportedSources()`

Returns metadata about all supported quote sources.

```typescript
const sources = sdk.quoteService.supportedSources();
```

##### `supportedChains()`

Returns an array of chain IDs that are supported by the service.

```typescript
const chains = sdk.quoteService.supportedChains();
```

##### `supportedSourcesInChain(params)`

Returns metadata about quote sources supported in a specific chain.

```typescript
const sources = sdk.quoteService.supportedSourcesInChain({
  chainId: Chains.ETHEREUM.chainId,
});
```

##### `supportedGasSpeeds()`

Returns supported gas speeds for each chain.

```typescript
const gasSpeeds = sdk.quoteService.supportedGasSpeeds();
```

##### `estimateQuotes(params)`

Gets estimated quotes from all sources without transaction details.

```typescript
const quotes = sdk.quoteService.estimateQuotes({
  request: {
    chainId: Chains.ETHEREUM.chainId,
    sellToken: "0x...",
    buyToken: "0x...",
    order: { type: "sell", sellAmount: BigInt("1000000") },
    slippagePercentage: 1,
  },
  config: { timeout: TimeString },
});
```

##### `estimateAllQuotes(params)`

Gets estimated quotes from all sources and returns them in a sorted array.

```typescript
const quotes = await sdk.quoteService.estimateAllQuotes({
  request: {
    chainId: Chains.ETHEREUM.chainId,
    sellToken: "0x...",
    buyToken: "0x...",
    order: { type: "sell", sellAmount: BigInt("1000000") },
    slippagePercentage: 1,
  },
  config: {
    ignoredFailed: boolean,
    sort: { by: "most-swapped-accounting-for-gas", using: "gas-price" },
    timeout: TimeString,
  },
});
```

##### `getQuotes(params)`

Gets quotes from all sources with transaction details.

```typescript
const quotes = sdk.quoteService.getQuotes({
  request: {
    chainId: Chains.ETHEREUM.chainId,
    sellToken: "0x...",
    buyToken: "0x...",
    order: { type: "sell", sellAmount: BigInt("1000000") },
    slippagePercentage: 1,
    takerAddress: "0x...",
  },
  config: { timeout: TimeString },
});
```

##### `getAllQuotes(params)`

Gets quotes from all sources and returns them in a sorted array.

```typescript
const quotes = await sdk.quoteService.getAllQuotes({
  request: {
    chainId: Chains.ETHEREUM.chainId,
    sellToken: "0x...",
    buyToken: "0x...",
    order: { type: "sell", sellAmount: BigInt("1000000") },
    slippagePercentage: 1,
    takerAddress: "0x...",
  },
  config: {
    ignoredFailed: boolean,
    sort: { by: "most-swapped-accounting-for-gas", using: "gas-price" },
    timeout: TimeString,
  },
});
```

##### `getBestQuote(params)`

Gets the best quote according to specified criteria.

```typescript
const bestQuote = await sdk.quoteService.getBestQuote({
  request: {
    chainId: Chains.ETHEREUM.chainId,
    sellToken: "0x...",
    buyToken: "0x...",
    order: { type: "sell", sellAmount: BigInt("1000000") },
    slippagePercentage: 1,
    takerAddress: "0x...",
  },
  config: {
    choose: { by: "most-swapped-accounting-for-gas", using: "gas-price" },
    timeout: TimeString,
  },
});
```

##### `getAllQuotesWithTxs(params)`

Gets quotes with built transactions from all sources.

```typescript
const quotesWithTxs = await sdk.quoteService.getAllQuotesWithTxs({
  request: {
    chainId: Chains.ETHEREUM.chainId,
    sellToken: "0x...",
    buyToken: "0x...",
    order: { type: "sell", sellAmount: BigInt("1000000") },
    slippagePercentage: 1,
    takerAddress: "0x...",
  },
  config: {
    ignoredFailed: boolean,
    sort: { by: "most-swapped-accounting-for-gas", using: "gas-price" },
    timeout: TimeString,
  },
});
```

##### `buildTxs(params)`

Builds transactions for given quotes.

```typescript
const txs = sdk.quoteService.buildTxs({
  quotes: quotes,
  sourceConfig: SourceConfig,
  config: { timeout: TimeString },
});
```

##### `buildAllTxs(params)`

Builds transactions for all quotes and returns them in a sorted array.

```typescript
const allTxs = await sdk.quoteService.buildAllTxs({
  quotes: quotes,
  sourceConfig: SourceConfig,
  config: {
    timeout: TimeString,
    ignoredFailed: boolean,
  },
});
```

### DCA Service

The DCA (Dollar Cost Averaging) Service provides functionality for setting up and managing DCA positions.

#### Objective and Potential

- **Objective**: Enable automated dollar-cost averaging strategies for any token pair
- **Potential Use Cases**:
  - Automated investment strategies
  - Risk management through periodic investments
  - Customizable DCA schedules
  - Multi-chain DCA positions
  - Permission management for shared positions

#### Methods

##### `getAllowanceTarget(params)`

Gets the allowance target address for a DCA position.

```typescript
const target = sdk.dcaService.getAllowanceTarget({
  chainId: Chains.ETHEREUM.chainId,
  from: "0x...", // Token to sell
  depositWith: "0x...", // Token to deposit with
  usePermit2: boolean,
});
```

##### `preparePermitData(params)`

Prepares permit data for token approvals.

```typescript
const permitData = await sdk.dcaService.preparePermitData({
  // Permit2 parameters
});
```

##### `buildCreatePositionTx(params)`

Builds a transaction to create a new DCA position.

```typescript
const tx = await sdk.dcaService.buildCreatePositionTx({
  chainId: Chains.ETHEREUM.chainId,
  from: { address: "0x...", variantId: "..." },
  to: { address: "0x...", variantId: "..." },
  swapInterval: DCASwapInterval.ONE_DAY,
  amountOfSwaps: 30,
  owner: "0x...",
  permissions: [{ operator: "0x...", permissions: [DCAPermission.INCREASE] }],
  deposit: { token: "0x...", amount: BigInt("1000000") },
});
```

##### `buildIncreasePositionTx(params)`

Builds a transaction to increase an existing DCA position.

```typescript
const tx = await sdk.dcaService.buildIncreasePositionTx({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "123",
  increase: { token: "0x...", amount: BigInt("1000000") },
  amountOfSwaps: 30,
});
```

##### `buildReducePositionTx(params)`

Builds a transaction to reduce an existing DCA position.

```typescript
const tx = await sdk.dcaService.buildReducePositionTx({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "123",
  amountOfSwaps: 15,
  reduce: { amount: BigInt("500000") },
  recipient: "0x...",
});
```

##### `buildReduceToBuyPositionTx(params)`

Builds a transaction to reduce a position to buy a specific amount.

```typescript
const tx = await sdk.dcaService.buildReduceToBuyPositionTx({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "123",
  amountOfSwaps: 15,
  reduce: { amountToBuy: BigInt("500000") },
  recipient: "0x...",
});
```

##### `buildWithdrawPositionTx(params)`

Builds a transaction to withdraw from a DCA position.

```typescript
const tx = await sdk.dcaService.buildWithdrawPositionTx({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "123",
  withdraw: {},
  recipient: "0x...",
});
```

##### `buildTerminatePositionTx(params)`

Builds a transaction to terminate a DCA position.

```typescript
const tx = await sdk.dcaService.buildTerminatePositionTx({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "123",
  withdraw: {},
  recipient: "0x...",
});
```

##### `buildMigratePositionTx(params)`

Builds a transaction to migrate a DCA position to a new hub.

```typescript
const tx = await sdk.dcaService.buildMigratePositionTx({
  chainId: Chains.ETHEREUM.chainId,
  sourceHub: "0x...",
  targetHub: "0x...",
  positionId: "123",
  migration: { useFundsFrom: "swapped", sendUnusedFundsTo: "0x..." },
});
```

##### `getSupportedPairs(params)`

Gets supported token pairs for DCA positions.

```typescript
const pairs = await sdk.dcaService.getSupportedPairs({
  chains: [Chains.ETHEREUM.chainId],
  config: { timeout: "30s" },
});
```

##### `getPositionsByAccount(params)`

Gets DCA positions for specific accounts.

```typescript
const positions = await sdk.dcaService.getPositionsByAccount({
  accounts: ["0x..."],
  chains: [Chains.ETHEREUM.chainId],
  includeHistory: true,
  config: { timeout: "30s" },
});
```

##### `getPositionsById(params)`

Gets DCA positions by their IDs.

```typescript
const positions = await sdk.dcaService.getPositionsById({
  ids: [{ chainId: Chains.ETHEREUM.chainId, hub: "0x...", positionId: 123 }],
  includeHistory: true,
  config: { timeout: "30s" },
});
```

##### `getPairSwaps(params)`

Gets swap history for a token pair.

```typescript
const swaps = await sdk.dcaService.getPairSwaps({
  chainId: Chains.ETHEREUM.chainId,
  variantTokenA: "...",
  variantTokenB: "...",
  config: { timeout: "30s" },
});
```

### Gas Service

The Gas Service provides gas price estimation and optimization across different chains.

#### Objective and Potential

- **Objective**: Optimize transaction costs across different chains and networks
- **Potential Use Cases**:
  - Gas price monitoring and optimization
  - Transaction cost estimation
  - Gas-aware trading strategies
  - Multi-chain gas price comparison
  - Automated gas price optimization

#### Methods

##### `supportedChains()`

Returns an array of chain IDs that are supported by the service.

```typescript
const chains = sdk.gasService.supportedChains();
```

##### `supportedSpeeds()`

Returns supported gas speeds for each chain.

```typescript
const speeds = sdk.gasService.supportedSpeeds();
```

##### `estimateGas(params)`

Estimates gas usage for a transaction.

```typescript
const gasEstimation = await sdk.gasService.estimateGas({
  chainId: Chains.ETHEREUM.chainId,
  tx: {
    from: "0x...",
    to: "0x...",
    data: "0x...",
  },
  config: { timeout: TimeString },
});
```

##### `getGasPrice(params)`

Gets gas prices for different speeds on a chain.

```typescript
const gasPrices = await sdk.gasService.getGasPrice({
  chainId: Chains.ETHEREUM.chainId,
  config: {
    timeout: TimeString,
    fields: {
      standard: "required" | "best effort" | "can ignore",
      fast: "required" | "best effort" | "can ignore",
      instant: "required" | "best effort" | "can ignore",
    },
  },
});
```

##### `calculateGasCost(params)`

Calculates gas cost for a transaction.

```typescript
const gasCost = await sdk.gasService.calculateGasCost({
  chainId: Chains.ETHEREUM.chainId,
  gasEstimation: BigInt("21000"),
  tx: {
    from: "0x...",
    to: "0x...",
    data: "0x...",
  },
  config: {
    timeout: TimeString,
    fields: {
      standard: "required" | "best effort" | "can ignore",
      fast: "required" | "best effort" | "can ignore",
      instant: "required" | "best effort" | "can ignore",
    },
  },
});
```

##### `getQuickGasCalculator(params)`

Gets a quick gas calculator for a specific chain.

```typescript
const calculator = await sdk.gasService.getQuickGasCalculator({
  chainId: Chains.ETHEREUM.chainId,
  config: {
    timeout: TimeString,
    fields: {
      standard: "required" | "best effort" | "can ignore",
      fast: "required" | "best effort" | "can ignore",
      instant: "required" | "best effort" | "can ignore",
    },
  },
});

// Use the calculator
const gasPrices = calculator.getGasPrice();
const gasCost = calculator.calculateGasCost({
  gasEstimation: BigInt("21000"),
  tx: {
    from: "0x...",
    to: "0x...",
    data: "0x...",
  },
});
```

### Prices Service

The Prices Service provides token price feeds and conversion utilities.

#### Objective and Potential

- **Objective**: Provide reliable and comprehensive price data for tokens across multiple chains
- **Potential Use Cases**:
  - Real-time price monitoring
  - Historical price analysis
  - Price impact calculations
  - Portfolio valuation
  - Cross-chain price comparison
  - Trading strategy backtesting

#### Methods

##### `supportedChains()`

Returns an array of chain IDs that are supported by the service.

```typescript
const chains = sdk.priceService.supportedChains();
```

##### `supportedQueries()`

Returns information about supported price queries for each chain.

```typescript
const queries = sdk.priceService.supportedQueries();
```

##### `getCurrentPricesInChain(params)`

Gets current prices for tokens in a specific chain.

```typescript
const prices = await sdk.priceService.getCurrentPricesInChain({
  chainId: Chains.ETHEREUM.chainId,
  tokens: ["0x...", "0x..."],
  config: { timeout: TimeString },
});
```

##### `getCurrentPrices(params)`

Gets current prices for tokens across multiple chains.

```typescript
const prices = await sdk.priceService.getCurrentPrices({
  tokens: [
    { chainId: Chains.ETHEREUM.chainId, token: "0x..." },
    { chainId: Chains.OPTIMISM.chainId, token: "0x..." },
  ],
  config: { timeout: TimeString },
});
```

##### `getHistoricalPricesInChain(params)`

Gets historical prices for tokens in a specific chain at a given timestamp.

```typescript
const prices = await sdk.priceService.getHistoricalPricesInChain({
  chainId: Chains.ETHEREUM.chainId,
  tokens: ["0x...", "0x..."],
  timestamp: 1672531200, // Unix timestamp
  searchWidth: "1h",
  config: { timeout: TimeString },
});
```

##### `getHistoricalPrices(params)`

Gets historical prices for tokens across multiple chains at a given timestamp.

```typescript
const prices = await sdk.priceService.getHistoricalPrices({
  tokens: [
    { chainId: Chains.ETHEREUM.chainId, token: "0x..." },
    { chainId: Chains.OPTIMISM.chainId, token: "0x..." },
  ],
  timestamp: 1672531200, // Unix timestamp
  searchWidth: "1h",
  config: { timeout: TimeString },
});
```

##### `getBulkHistoricalPrices(params)`

Gets historical prices for multiple tokens at different timestamps.

```typescript
const prices = await sdk.priceService.getBulkHistoricalPrices({
  tokens: [
    { chainId: Chains.ETHEREUM.chainId, token: "0x...", timestamp: 1672531200 },
    { chainId: Chains.OPTIMISM.chainId, token: "0x...", timestamp: 1672531200 },
  ],
  searchWidth: "1h",
  config: { timeout: TimeString },
});
```

##### `getChart(params)`

Gets price chart data for tokens over a specified time period.

```typescript
const chart = await sdk.priceService.getChart({
  tokens: [
    { chainId: Chains.ETHEREUM.chainId, token: "0x..." },
    { chainId: Chains.OPTIMISM.chainId, token: "0x..." },
  ],
  span: 100, // Number of data points
  period: "1h", // Time between data points
  bound: { from: 1672531200 }, // or { upTo: "now" }
  searchWidth: "1h",
});
```

### Metadata Service

The Metadata Service provides token metadata retrieval and management.

#### Objective and Potential

- **Objective**: Standardize and simplify token metadata access across chains
- **Potential Use Cases**:
  - Token information display
  - Wallet integration
  - Token discovery
  - Cross-chain token management
  - DApp development
  - Token analytics

#### Methods

##### `supportedChains()`

Returns an array of chain IDs that are supported by the service.

```typescript
const chains = sdk.metadataService.supportedChains();
```

##### `supportedProperties()`

Returns information about supported metadata properties for each chain.

```typescript
const properties = sdk.metadataService.supportedProperties();
```

##### `getMetadataInChain(params)`

Gets metadata for tokens in a specific chain.

```typescript
const metadata = await sdk.metadataService.getMetadataInChain({
  chainId: Chains.ETHEREUM.chainId,
  tokens: ["0x...", "0x..."],
  config: {
    fields: { symbol: true, decimals: true }, // Specify which fields to retrieve
    timeout: TimeString,
  },
});
```

##### `getMetadata(params)`

Gets metadata for tokens across multiple chains.

```typescript
const metadata = await sdk.metadataService.getMetadata({
  tokens: [
    { chainId: Chains.ETHEREUM.chainId, token: "0x..." },
    { chainId: Chains.OPTIMISM.chainId, token: "0x..." },
  ],
  config: {
    fields: { symbol: true, decimals: true }, // Specify which fields to retrieve
    timeout: TimeString,
  },
});
```

### Permit2 Service

The Permit2 Service provides functionality for managing token approvals using the Permit2 protocol.

#### Objective and Potential

- **Objective**: Enable efficient and secure token approvals using the Permit2 standard
- **Potential Use Cases**:
  - Gas-optimized token approvals
  - Batch approvals
  - Cross-protocol permission management
  - Automated approval systems
  - Security-focused approval workflows

```typescript
// Get permit2 allowance
const allowance = await sdk.permit2Service.getAllowance({
  chainId: Chains.ETHEREUM.chainId,
  token: "0x...",
  owner: "0x...",
  spender: "0x...",
});
```

### Earn Service

The Earn Service provides functionality for yield farming and staking operations.

#### Objective and Potential

- **Objective**: Enable efficient yield farming and staking operations across multiple protocols
- **Potential Use Cases**:
  - Yield farming strategy management
  - Automated position management
  - Cross-protocol yield optimization
  - Permission-based position sharing
  - Delayed withdrawal management
  - Strategy migration and optimization

#### Methods

##### `getAllowanceTarget(params)`

Gets the allowance target address for a strategy.

```typescript
const target = await sdk.earnService.getAllowanceTarget({
  chainId: Chains.ETHEREUM.chainId,
  strategyId: "1-0x1234567890123456789012345678901234567890-42", // Format: chainId-registryAddress-strategyNumber
  depositWith: "0x...", // Token to deposit with
  usePermit2: boolean,
});
```

##### `preparePermitData(params)`

Prepares permit data for token approvals.

```typescript
const permitData = await sdk.earnService.preparePermitData({
  chainId: Chains.ETHEREUM.chainId,
  token: "0x...",
  amount: "1000000",
  spender: "0x...",
});
```

##### `preparePermissionData(params)`

Prepares permission data for position management.

```typescript
const permissionData = await sdk.earnService.preparePermissionData({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "1-0xabcdef1234567890123456789012345678901234-1337", // Format: chainId-vaultAddress-positionNumber
  permissions: [{ operator: "0x...", permissions: [EarnPermission.INCREASE] }],
  signerAddress: "0x...",
  signatureValidFor: "1w",
});
```

##### `buildCreatePositionTx(params)`

Builds a transaction to create a new earn position.

```typescript
const tx = await sdk.earnService.buildCreatePositionTx({
  chainId: Chains.ETHEREUM.chainId,
  strategyId: "1-0x1234567890123456789012345678901234567890-42", // Format: chainId-registryAddress-strategyNumber
  owner: "0x...",
  permissions: [{ operator: "0x...", permissions: [EarnPermission.INCREASE] }],
  deposit: { token: "0x...", amount: "1000000" },
});
```

##### `buildIncreasePositionTx(params)`

Builds a transaction to increase an existing position.

```typescript
const tx = await sdk.earnService.buildIncreasePositionTx({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "1-0xabcdef1234567890123456789012345678901234-1337", // Format: chainId-vaultAddress-positionNumber
  increase: { token: "0x...", amount: "1000000" },
});
```

##### `buildWithdrawPositionTx(params)`

Builds a transaction to withdraw from a position.

```typescript
const tx = await sdk.earnService.buildWithdrawPositionTx({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "1-0xabcdef1234567890123456789012345678901234-1337", // Format: chainId-vaultAddress-positionNumber
  withdraw: { type: "market", token: "0x...", amount: "1000000" },
});
```

##### `buildClaimDelayedWithdrawPositionTx(params)`

Builds a transaction to claim a delayed withdrawal.

```typescript
const tx = await sdk.earnService.buildClaimDelayedWithdrawPositionTx({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "1-0xabcdef1234567890123456789012345678901234-1337", // Format: chainId-vaultAddress-positionNumber
});
```

##### `estimateMarketWithdraw(params)`

Estimates the amount of tokens that would be received from a market withdrawal.

```typescript
const estimation = await sdk.earnService.estimateMarketWithdraw({
  chainId: Chains.ETHEREUM.chainId,
  positionId: "1-0xabcdef1234567890123456789012345678901234-1337", // Format: chainId-vaultAddress-positionNumber
  token: "0x...",
  amount: "1000000",
  swapConfig: {
    slippagePercentage: 1,
    txValidFor: "1w",
  },
});
```

##### `getSupportedStrategies(params)`

Gets supported strategies for yield farming.

```typescript
const strategies = await sdk.earnService.getSupportedStrategies({
  chains: [Chains.ETHEREUM.chainId],
  config: { timeout: "30s" },
});
```

##### `getStrategy(params)`

Gets detailed information about a specific strategy.

```typescript
const strategy = await sdk.earnService.getStrategy({
  strategy: "1-0x1234567890123456789012345678901234567890-42", // Format: chainId-registryAddress-strategyNumber
  config: { timeout: "30s" },
});
```

##### `getPositionsByAccount(params)`

Gets earn positions for specific accounts.

```typescript
const positions = await sdk.earnService.getPositionsByAccount({
  accounts: ["0x..."],
  chains: [Chains.ETHEREUM.chainId],
  includeHistory: true,
  includeHistoricalBalancesFrom: 1672531200,
  config: { timeout: "30s" },
});
```

##### `getPositionsById(params)`

Gets earn positions by their IDs.

```typescript
const positions = await sdk.earnService.getPositionsById({
  ids: ["1-0xabcdef1234567890123456789012345678901234-1337"], // Format: chainId-vaultAddress-positionNumber
  includeHistory: true,
  includeHistoricalBalancesFrom: 1672531200,
  config: { timeout: "30s" },
});
```

##### `getStrategyAsset(params)`

Gets the asset token for a strategy or position.

```typescript
const asset = await sdk.earnService.getStrategyAsset({
  chainId: Chains.ETHEREUM.chainId,
  strategyId: "1-0x1234567890123456789012345678901234567890-42", // Format: chainId-registryAddress-strategyNumber
  // or positionId: "1-0xabcdef1234567890123456789012345678901234-1337" // Format: chainId-vaultAddress-positionNumber
});
```

## Advanced Usage

### Error Handling

The SDK provides comprehensive error handling for all services:

```typescript
try {
  const quotes = await sdk.quoteService.getAllQuotes({...});
} catch (error) {
  if (error instanceof FailedToGenerateAnyQuotesError) {
    // Handle quote generation failure
  }
}
```

### Configuration

Each service can be configured with custom timeouts and other parameters:

```typescript
const quotes = await sdk.quoteService.getAllQuotes({
  request: {...},
  config: {
    timeout: "30s",
    ignoredFailed: true,
    sort: {
      by: "most-swapped-accounting-for-gas",
      using: "gas-price"
    }
  }
});
```

### Multi-chain Support

All services support operations across multiple chains:

```typescript
const balances = await sdk.balanceService.getBalancesForTokens({
  account: "0x...",
  tokens: {
    [Chains.ETHEREUM.chainId]: ["0x..."],
    [Chains.OPTIMISM.chainId]: ["0x..."],
    [Chains.ARBITRUM.chainId]: ["0x..."],
  },
});
```

## 👨‍💻 Development

### Environment Setup

```bash
yarn install
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### [Docs](https://docs.balmy.xyz) | [X](https://x.com/balmy_xyz) | [Discord](http://discord.balmy.xyz/)

Balmy is the state-of-the-art DCA open protocol that enables users (or dapps) to Dollar Cost Average (DCA) any ERC20 into any ERC20 with their preferred period frequency, without sacrificing decentralization or giving up personal information to any centralized parties.

The Balmy SDK allows you to interact with the Balmy protocol, providing efficient tools to manage token balances, retrieve trade quotes from DEX aggregators, and check token holdings across multiple chains.
