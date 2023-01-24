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
type ChainTokens = { RANDOM_ERC20: TokenData; USDC: TokenData; wToken: TokenData };

export const TOKENS: Record<ChainId, Record<string, TokenData>> = {
  [Chains.ETHEREUM.chainId]: {
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      whale: '0xf977814e90da44bfa03b6295a0616a897441acec',
    },
    RANDOM_ERC20: {
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
    RANDOM_ERC20: {
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
    RANDOM_ERC20: {
      address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
      whale: '0x5c2ed810328349100a66b82b78a1791b101c9d61',
    },
    wToken: {
      address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      whale: '0x8df3aad3a84da6b69a4da8aec3ea40d9091b2ac4',
    },
  },
  [Chains.ARBITRUM.chainId]: {
    USDC: {
      address: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
      whale: '0x489ee077994b6658eafa855c308275ead8097c4a',
    },
    RANDOM_ERC20: {
      address: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
      whale: '0x489ee077994b6658eafa855c308275ead8097c4a',
    },
    wToken: {
      address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      whale: '0x489ee077994b6658eafa855c308275ead8097c4a',
    },
  },
  [Chains.GNOSIS.chainId]: {
    USDC: {
      address: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
      whale: '0xc66825c5c04b3c2ccd536d626934e16248a63f68',
    },
    RANDOM_ERC20: {
      address: '0x8e5bbbb09ed1ebde8674cda39a0c169401db4252',
      whale: '0x30887fc55cbfad3487cb55bfe1779f6d2ba1c118',
    },
    wToken: {
      address: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
      whale: '0x7f90122bf0700f9e7e1f688fe926940e8839f353',
    },
  },
  [Chains.FANTOM.chainId]: {
    USDC: {
      address: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
      whale: '0xfb05aedf0cac43c6ce291d2d1be1eab568d155b4',
    },
    RANDOM_ERC20: {
      address: '0x321162cd933e2be498cd2267a90534a804051b11',
      whale: '0xb7982a8eb703d1d5e28a294e1f5a3c9a0161f36c',
    },
    wToken: {
      address: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
      whale: '0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c',
    },
  },
  [Chains.BNB_CHAIN.chainId]: {
    USDC: {
      address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      whale: '0xc2f5b9a3d9138ab2b74d581fc11346219ebf43fe',
    },
    RANDOM_ERC20: {
      address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      whale: '0x0ed7e52944161450477ee417de9cd3a859b14fd0',
    },
    wToken: {
      address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      whale: '0xacaac9311b0096e04dfe96b6d87dec867d3883dc',
    },
  },
  [Chains.AVALANCHE.chainId]: {
    USDC: {
      address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
      whale: '0x4aefa39caeadd662ae31ab0ce7c8c2c9c0a013e8',
    },
    RANDOM_ERC20: {
      address: '0x50b7545627a5162f82a992c33b87adc75187b218',
      whale: '0x686bef2417b6dc32c50a3cbfbcc3bb60e1e9a15d',
    },
    wToken: {
      address: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
      whale: '0xc73eed4494382093c6a7c284426a9a00f6c79939',
    },
  },
  [Chains.KLAYTN.chainId]: {
    USDC: {
      address: '0x6270b58be569a7c0b8f47594f191631ae5b2c86c',
      whale: '0x7d274dce8e2467fc4cdb6e8e1755db5686daebbb',
    },
    RANDOM_ERC20: {
      address: '0x5fff3a6c16c2208103f318f4713d4d90601a7313',
      whale: '0xfe8850c2d03f2e09283fd6b908aa201f5664b21b',
    },
    wToken: {
      address: '0xe4f05a66ec68b54a58b17c22107b02e0232cc817',
      whale: '0x2f72278d8f8c4840a4d9e20d609fb0b6ef622904',
    },
  },
  // Celo can't be forked with ethers.js due to different block header structure.
  // Ref.: https://github.com/NomicFoundation/hardhat/issues/1966
  // [Chains.CELO.chainId]: {
  //   USDC: {
  //     address: '0x37f750b7cc259a2f741af45294f6a16572cf5cad',
  //     whale: '0xed16807f3cd1ab579388e0b00394834e31eb512f',
  //   },
  //   RANDOM_ERC20: {
  //     address: '0xd629eb00deced2a080b7ec630ef6ac117e614f1b',
  //     whale: '0x2962518b087b3ae071ca4d737c7d874af04b2142',
  //   },
  //   wToken: {
  //     address: '0x471ece3750da237f93b8e339c536989b8978a438',
  //     whale: '0xef268b5c05452d63a17da12f562368e88a036ef1',
  //   },
  // },
  // Aurora throws baseFeePerGas error.
  // [Chains.AURORA.chainId]: {
  //   USDC: {
  //     address: '0xB12BFcA5A55806AaF64E99521918A4bf0fC40802',
  //     whale: '0x2fe064b6c7d274082aa5d2624709bc9ae7d16c77',
  //   },
  //   RANDOM_ERC20: {
  //     address: '0xf4eb217ba2454613b15dbdea6e5f22276410e89e',
  //     whale: '0xe95ac3acb464edbefe58b00010833826566b6582',
  //   },
  //   wToken: {
  //     address: '0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB',
  //     whale: '0x63da4db6ef4e7c62168ab03982399f9588fcd198',
  //   },
  // },
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
    [chain.chainId]: [Addresses.NATIVE_TOKEN, chain.wToken, address('USDC'), address('RANDOM_ERC20')],
  });
  return {
    nativeToken: tokens[chain.chainId][Addresses.NATIVE_TOKEN],
    wToken: tokens[chain.chainId][chain.wToken],
    USDC: tokens[chain.chainId][address('USDC')],
    RANDOM_ERC20: tokens[chain.chainId][address('RANDOM_ERC20')],
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
