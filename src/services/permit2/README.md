# Permit2 Service

## Introduction

From [Uniswap's blog post](https://blog.uniswap.org/permit2-and-universal-router):

> Permit2 is a token approval contract that can safely share and manage token approvals across different smart contracts. As more projects integrate with Permit2, we can standardize token approvals across all applications. In turn, Permit2 will improve the user experience by reducing transaction costs while improving smart contract security.

Basically, it would allow a user to grant your protocol authorization to use their tokens via signature, instead of the normal ERC20 approval flow. This has quite a few benefits:

- No need for multiple transactions anymore
- Authorizations can be of the exact amount needed, reducing the risk to user funds
- Authorizations can have a deadline

The normal workflow would require the user to grant the Permit2 contract "regular" ERC20 approval. It's recommended that this approval is the maximum possible so that it only has to be done once. Remember that it would be safe to do so, since funds can only be transferred with future signatures.

Once the authorization to Permit2 is granted, next time the user wants to use your protocol they would only have to:

1. Sign an authorization
1. Execute your contract

While two operations are needed, only one transaction is required 🔥

## The Service

This service can be used to interact with Permit2. It provides some helper methods that would make integration easier, while it also provides a way to give already deployed contracts Permit2 capabilities.

### Permit2 Authorization

Remember that before Permit2 can be used, you'll need to have the user authorize the Permit2 contract.

```ts
import { Contract, constants } from "ethers";
import { buildSDK } from "@mean-finance/sdk";

const sdk = buildSDK();

const TOKEN = "0x..."; // The address of the token that will be taken from the user

const tokenContract = new Contract(TOKEN, ERC20_ABI, user);
await tokenContract.approve(
  sdk.permit2Service.permit2ContractAddress,
  constants.MaxUint256
);
```

### Arbitrary Calls

Re-deploying contracts can be difficult and time-consuming. Also, sometimes it's just impossible to migrate liquidity. This service will allow you to integrate your existing contract with Permit2, without having to re-deploy.

#### Single Permit

If you simply want to take one token from the user and do something with it, this is the way to go. This should be the usual case for most protocols.

##### Example: take tokens and deposit into yield generating vault

```ts
import { buildSDK } from "@mean-finance/sdk";

const sdk = buildSDK();
const { arbitrary } = sdk.permit2Service;

const TOKEN = "0x..."; // The address of the token that will be taken from the user
const AMOUNT_TO_DEPOSIT = 1e18; // The amount of tokens to deposit
const VAULT = "0x..."; // The vault to generate yield in

// Prepare data to sign
const {
  dataToSign: { domain, types, message },
  permitData,
} = await arbitrary.preparePermitData({
  appId: APP_ID, // A number that will identify your app
  chainId: 1, // The chain's id
  signerAddress: user.address, // The user's address
  token: TOKEN,
  amount: AMOUNT_TO_DEPOSIT,
  signatureValidFor: "1d", // How long the signature will be valid for
});

// Have the user sign it
const signature = await user._signTypedData(domain, types, message);

// Build tx
const tx = arbitrary.buildArbitraryCallWithPermit({
  // Set permit data
  permitData: { ...permitData, signature },

  // Provide allowance for vault
  allowanceTargets: [{ token: TOKEN, target: VAULT }],

  // Deposit into vault
  calls: [
    {
      address: VAULT,
      abi: { json: ABI },
      functionName: "deposit",
      args: [AMOUNT_TO_DEPOSIT, arbitrary.contractAddress],
    },
  ],

  // Distribute vault tokens to user
  distribution: {
    [VAULT]: [{ recipient: user.address, shareBps: 10_000 }],
  },
});

// Send tx
await user.sendTransaction(tx);
```

#### Batch Permit

If you want to take more than one token from the user, you can do it also in one signature!

##### Example: take multiple tokens and deposit into many yield generating vaults

```ts
import { buildSDK } from "@mean-finance/sdk";

const sdk = buildSDK();
const { arbitrary } = sdk.permit2Service;

const TOKEN_1 = "0x...";
const AMOUNT_TO_DEPOSIT_1 = 1e18;
const VAULT_1 = "0x...";

const TOKEN_2 = "0x...";
const AMOUNT_TO_DEPOSIT_2 = 2e18;
const VAULT_2 = "0x...";

// Prepare data to sign
const {
  dataToSign: { domain, types, message },
  permitData,
} = await arbitrary.prepareBatchPermitData({
  appId: APP_ID, // A number that will identify your app
  chainId: 1, // The chain's id
  signerAddress: user.address, // The user's address
  tokens: {
    // Tokens to take from the user
    [TOKEN_1]: AMOUNT_TO_DEPOSIT_1,
    [TOKEN_2]: AMOUNT_TO_DEPOSIT_2,
  },
  signatureValidFor: "1d", // How long the signature will be valid for
});

// Have the user sign it
const signature = await user._signTypedData(domain, types, message);

// Build tx
const tx = arbitrary.buildArbitraryCallWithBatchPermit({
  // Set permit data
  permitData: { ...permitData, signature },

  // Provide allowance for vaults
  allowanceTargets: [
    { token: TOKEN_1, target: VAULT_1 },
    { token: TOKEN_2, target: VAULT_2 },
  ],

  calls: [
    // Deposit into first vault
    {
      address: VAULT_1,
      abi: { json: ABI_1 },
      functionName: "deposit",
      args: [AMOUNT_TO_DEPOSIT_1, arbitrary.contractAddress],
    },

    // Deposit into second vault
    {
      address: VAULT_2,
      abi: { json: ABI_2 },
      functionName: "deposit",
      args: [AMOUNT_TO_DEPOSIT_2, arbitrary.contractAddress],
    },
  ],

  // Distribute vault tokens to user
  distribution: {
    [VAULT_1]: [{ recipient: user.address, shareBps: 10_000 }],
    [VAULT_2]: [{ recipient: user.address, shareBps: 10_000 }],
  },
});

// Send tx
await user.sendTransaction(tx);
```
