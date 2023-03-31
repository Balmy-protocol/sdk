# Mean Finance SDK

This repository contains the code for the Mean Finance sdk.

## 🧪 Installing

### Yarn

```bash
yarn add @mean-finance/sdk
```

### NPM

```bash
npm install @mean-finance/sdk
```

## Usage

### Building the SDK

```javascript
import { buildSdk } from "@mean-finance/sdk";

const sdk = buildSdk(config);
```

### Getting balance for multiple tokens on several chains

```javascript
const accountBalances = await sdk.balanceService.getBalancesForTokens({
  account: "0x000000000000000000000000000000000000dead",
  tokens: {
    // [chainId]: [0xTokenAddress]
    [1]: [
      // Ethereum
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
    ],
    [10]: [
      // Optimism
      "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC
      "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
    ],
  },
  // Optional config
  config: {
    timeout: "30s",
  },
});

const usdcBalanceOnEthereum =
  accountBalances[1]["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"];
```

### Getting allowances of multiple spenders for a token

```javascript
const accountAllowances = await sdk.allowanceService.getAllowances({
  chainId: 1,
  token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
  owner: "0x000000000000000000000000000000000000dead",
  spenders: ["0x6666666600000000000000000000000000009999"],
});

const amountThatDevilCanSpend =
  accountAllowances["0x6666666600000000000000000000000000009999"];
```

### Quoting all dex aggregators for a trade

```javascript
const allQuotes = await sdk.quoteService.getAllQuotes({
  request: {
    chainId: 1, // Ethereum
    sellToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    buyToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    order: {
      type: "sell",
      sellAmount: utils.parseUnits("1000", 6), // 1000 USDC
    },
    slippagePercentage: 1, // 1%
    takerAddress: signer.address,
    // Optional gas speed
    gasSpeed: {
      speed: "instant",
    },
  },
  // Optional config
  config: {
    sort: {
      by: "most-swapped-accounting-for-gas",
    },
  },
});

const bestTradeBySort = allQuotes[0];
await signer.sendTransaction(bestTradeBySort.tx);
```

## 👨‍💻 Development environment

- Install dependencies

```bash
yarn install
```

## 📖 Docs

WIP - Will be at [docs.mean.finance](https://docs.mean.finance)
