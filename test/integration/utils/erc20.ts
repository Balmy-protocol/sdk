import { setBalance, impersonateAccount, stopImpersonatingAccount } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, BigNumberish, Bytes, utils, BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';
import { Address, Chain, ChainId, TokenAddress } from '@types';
import { Chains } from '@chains';
import { BaseToken } from '@services/tokens/types';
import { DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { FetchService } from '@services/fetch/fetch-service';
import crossFetch from 'cross-fetch';
import { TransactionResponse } from '@ethersproject/providers';
import { SourceQuoteResponse } from '@services/quotes/quote-sources/base';
import { calculateGasSpent } from './other';
import { expect } from 'chai';
import { QuoteResponse } from '@services/quotes/types';

type TokenData = { address: TokenAddress; whale: Address };
type ChainTokens = { WBTC: TokenData; USDC: TokenData; wToken: TokenData };
// TODO: Add more chains
export const TOKENS: Record<ChainId, Record<string, TokenData>> = {
  [Chains.ETHEREUM.chainId]: {
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      whale: '0xf977814e90da44bfa03b6295a0616a897441acec',
    },
    WBTC: {
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      whale: '0x218b95be3ed99141b0144dba6ce88807c4ad7c09',
    },
    wToken: {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      whale: '0x08638ef1a205be6762a8b935f5da9b700cf7322c',
    },
  },
  [Chains.OPTIMISM.chainId]: {
    USDC: {
      address: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
      whale: '0xf390830df829cf22c53c8840554b98eafc5dcbc2',
    },
    WBTC: {
      address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
      whale: '0x338726dd694db9e2230ec2bb8624a2d7f566c96d',
    },
    wToken: {
      address: '0x4200000000000000000000000000000000000006',
      whale: '0x68f5c0a2de713a54991e01858fd27a3832401849',
    },
  },
  [Chains.POLYGON.chainId]: {
    USDC: {
      address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
      whale: '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245',
    },
    WBTC: {
      address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
      whale: '0x5c2ed810328349100a66b82b78a1791b101c9d61',
    },
    wToken: {
      address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      whale: '0x8df3aad3a84da6b69a4da8aec3ea40d9091b2ac4',
    },
  },
} satisfies Record<ChainId, ChainTokens>;

export async function calculateBalancesFor({ tokens, addresses }: { tokens: IHasAddress[]; addresses: IHasAddress[] }) {
  const promises = tokens.flatMap((token) =>
    addresses.map(async (hasAddress) => ({ token, hasAddress, balance: await balance({ of: hasAddress.address, for: token }) }))
  );
  const balances: Record<Address, Record<TokenAddress, BigNumber>> = {};
  const results = await Promise.all(promises);
  for (const { token, hasAddress, balance } of results) {
    if (!(hasAddress.address in balances)) balances[hasAddress.address] = {};
    balances[hasAddress.address][token.address] = balance;
  }
  return balances;
}

export function balance({ of, for: token }: { of: Address; for: IHasAddress }): Promise<BigNumber> {
  if (isSameAddress(token.address, Addresses.NATIVE_TOKEN)) {
    return ethers.provider.getBalance(of);
  } else {
    return new Contract(token.address, ERC20_ABI, ethers.provider).balanceOf(of);
  }
}

export function approve({ amount, to, for: token, from }: { amount: BigNumberish; to: Address; for: IHasAddress; from: SignerWithAddress }) {
  return new Contract(token.address, ERC20_ABI, from).approve(to, amount);
}

export async function mintMany({
  chain,
  to,
  tokens,
}: {
  chain: Chain;
  to: IHasAddress;
  tokens: { token: BaseToken; amount: Exclude<BigNumberish, Bytes> }[];
}) {
  await Promise.all(tokens.map(({ token, amount }) => mint({ amount, of: token, to, on: chain })));
}

export async function mint({
  of: token,
  amount,
  to: user,
  on: chain,
}: {
  amount: Exclude<BigNumberish, Bytes>;
  of: BaseToken;
  to: IHasAddress;
  on: Chain;
}) {
  if (isSameAddress(token.address, Addresses.NATIVE_TOKEN)) {
    await setBalance(user.address, amount);
  } else {
    const key = isSameAddress(token.address, chain.wToken) ? 'wToken' : token.symbol;
    const data = TOKENS[chain.chainId][key];
    await impersonateAccount(data.whale);
    const whale = await ethers.getSigner(data.whale);
    await setBalance(whale.address, utils.parseEther('1'));
    const contract = new Contract(data.address, ERC20_ABI, whale);
    await contract.transfer(user.address, amount);
    await stopImpersonatingAccount(data.whale);
  }
}

export async function loadTokens(chain: Chain) {
  const address = (name: string) => TOKENS[chain.chainId][name].address;
  const tokenSource = new DefiLlamaTokenSource(new FetchService(crossFetch));
  const tokens = await tokenSource.getTokens({
    [chain.chainId]: [Addresses.NATIVE_TOKEN, chain.wToken, address('USDC'), address('WBTC')],
  });
  return {
    nativeToken: tokens[chain.chainId][Addresses.NATIVE_TOKEN],
    wToken: tokens[chain.chainId][chain.wToken],
    USDC: tokens[chain.chainId][address('USDC')],
    WBTC: tokens[chain.chainId][address('WBTC')],
  };
}

export async function assertUsersBalanceIsReduceAsExpected({
  txs,
  sellToken,
  quote,
  user,
  initialBalances,
}: {
  txs?: TransactionResponse[];
  sellToken: IHasAddress;
  quote: SourceQuoteResponse | QuoteResponse;
  user: IHasAddress;
  initialBalances: Record<Address, Record<TokenAddress, BigNumber>>;
}) {
  const initialBalance = initialBalances[user.address][sellToken.address];
  const bal = await balance({ of: user.address, for: sellToken });
  if (isSameAddress(sellToken.address, Addresses.NATIVE_TOKEN)) {
    const gasSpent = await calculateGasSpent(...(txs ?? []));
    expect(bal).to.equal(initialBalance.sub(gasSpent).sub(quote.tx.value ?? 0));
  } else {
    const maxSellAmount = 'amount' in quote.maxSellAmount ? quote.maxSellAmount.amount : quote.maxSellAmount;
    expect(bal).to.be.gte(initialBalance.sub(maxSellAmount));
  }
}

export async function assertRecipientsBalanceIsIncreasedAsExpected({
  txs,
  buyToken,
  quote,
  recipient,
  initialBalances,
}: {
  txs?: TransactionResponse[];
  buyToken: IHasAddress;
  quote: SourceQuoteResponse | QuoteResponse;
  recipient: IHasAddress;
  initialBalances: Record<Address, Record<TokenAddress, BigNumber>>;
}) {
  const initialBalance = initialBalances[recipient.address][buyToken.address];
  const bal = await balance({ of: recipient.address, for: buyToken });
  const minBuyAmount = 'amount' in quote.minBuyAmount ? quote.minBuyAmount.amount : quote.minBuyAmount;
  if (isSameAddress(buyToken.address, Addresses.NATIVE_TOKEN)) {
    const gasSpent = await calculateGasSpent(...(txs ?? []));
    expect(bal.sub(initialBalance).add(gasSpent)).to.be.gte(minBuyAmount);
  } else {
    expect(bal.sub(initialBalance)).to.be.gte(minBuyAmount);
  }
}

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint)',
  'function transfer(address to, uint amount)',
  'function approve(address to, uint amount)',
];

type IHasAddress = { address: Address };
