import { setBalance, impersonateAccount, stopImpersonatingAccount } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';
import { Address, BigIntish, Chain, ChainId, TokenAddress } from '@types';
import { Chains } from '@chains';
import { FetchService } from '@services/fetch/fetch-service';
import { TransactionResponse } from '@ethersproject/providers';
import { SourceQuoteResponse } from '@services/quotes/quote-sources/types';
import { calculateGasSpent } from './other';
import { expect } from 'chai';
import { QuoteResponse } from '@services/quotes/types';
import { BaseTokenMetadata } from '@services/metadata/types';
import { DefiLlamaClient } from '@shared/defi-llama';
import { parseEther } from 'viem';

type TokenData = { address: TokenAddress; whale: Address };
type ChainTokens = { RANDOM_ERC20: TokenData; STABLE_ERC20: TokenData; wToken: TokenData };
export type TestToken = BaseTokenMetadata & { price: number } & IHasAddress & { whale?: Address };

export const TOKENS: Record<ChainId, Record<string, TokenData>> = {
  [Chains.ETHEREUM.chainId]: {
    STABLE_ERC20: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      whale: '0x0a59649758aa4d66e25f08dd01271e891fe52199',
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
    STABLE_ERC20: {
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
    STABLE_ERC20: {
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
    STABLE_ERC20: {
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
    STABLE_ERC20: {
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
    STABLE_ERC20: {
      address: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
      whale: '0x95bf7e307bc1ab0ba38ae10fc27084bc36fcd605',
    },
    RANDOM_ERC20: {
      address: '0xb3654dc3d10ea7645f8319668e8f54d2574fbdc8',
      whale: '0x89d9bc2f2d091cfbfc31e333d6dc555ddbc2fd29',
    },
    wToken: {
      address: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
      whale: '0x39b3bd37208cbade74d0fcbdbb12d606295b430a',
    },
  },
  [Chains.BNB_CHAIN.chainId]: {
    STABLE_ERC20: {
      address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      whale: '0x4f31fa980a675570939b737ebdde0471a4be40eb',
    },
    RANDOM_ERC20: {
      address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      whale: '0x000000000000000000000000000000000000dead',
    },
    wToken: {
      address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      whale: '0xd7d069493685a581d27824fc46eda46b7efc0063',
    },
  },
  [Chains.AVALANCHE.chainId]: {
    STABLE_ERC20: {
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
    STABLE_ERC20: {
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
  [Chains.ROOTSTOCK.chainId]: {
    STABLE_ERC20: {
      // XUSD
      address: '0xb5999795be0ebb5bab23144aa5fd6a02d080299f',
      whale: '0x100aE71cBE5D2F678F9ae938909a8d8Dc004AA41',
    },
    RANDOM_ERC20: {
      // SOV
      address: '0xefc78fc7d48b64958315949279ba181c2114abbd',
      whale: '0x7f02eC1dF0238fEB228E1062BD2c5279A712d6aF',
    },
    wToken: {
      address: '0x542fda317318ebf1d3deaf76e0b632741a7e677d',
      whale: '0xA9c3D9681215eF7623dc28eA6b75bF87fDf285D9',
    },
  },
  [Chains.AURORA.chainId]: {
    STABLE_ERC20: {
      address: '0xB12BFcA5A55806AaF64E99521918A4bf0fC40802',
      whale: '0x2fe064b6c7d274082aa5d2624709bc9ae7d16c77',
    },
    RANDOM_ERC20: {
      address: '0xc42c30ac6cc15fac9bd938618bcaa1a1fae8501d',
      whale: '0x8c14ea853321028a7bb5e4fb0d0147f183d3b677',
    },
    wToken: {
      address: '0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB',
      whale: '0x63da4db6ef4e7c62168ab03982399f9588fcd198',
    },
  },
  [Chains.EVMOS.chainId]: {
    STABLE_ERC20: {
      address: '0x51e44ffad5c2b122c8b635671fcc8139dc636e82',
      whale: '0xa8d87759fc80e08d40c6ee7857652f38e5c39aa8',
    },
    RANDOM_ERC20: {
      address: '0x3f75ceabcdfed1aca03257dc6bdc0408e2b4b026',
      whale: '0x8e000833c11e0643ab41264bd41547cb077a5003',
    },
    wToken: {
      address: '0xD4949664cD82660AaE99bEdc034a0deA8A0bd517',
      whale: '0xfcd2ce20ef8ed3d43ab4f8c2da13bbf1c6d9512f',
    },
  },
  [Chains.CANTO.chainId]: {
    STABLE_ERC20: {
      address: '0x80b5a32e4f032b2a058b4f29ec95eefeeb87adcd',
      whale: '0xdE59F060D7ee2b612E7360E6C1B97c4d8289Ca2e',
    },
    RANDOM_ERC20: {
      address: '0x7264610a66eca758a8ce95cf11ff5741e1fd0455',
      whale: '0xF0e4e74Ce34738826477b9280776fc797506fE13',
    },
    wToken: {
      address: '0x826551890Dc65655a0Aceca109aB11AbDbD7a07B',
      whale: '0x1D20635535307208919f0b67c3B2065965A85aA9',
    },
  },
} satisfies Record<ChainId, ChainTokens>;

export function chainsWithTestData(chainIds: ChainId[]) {
  return chainIds.filter((chainId) => chainId in TOKENS);
}

export async function calculateBalancesFor({ tokens, addresses }: { tokens: IHasAddress[]; addresses: IHasAddress[] }) {
  const promises = tokens.flatMap((token) =>
    addresses.map(async (hasAddress) => ({ token, hasAddress, balance: await balance({ of: hasAddress.address, for: token }) }))
  );
  const balances: Record<Address, Record<TokenAddress, bigint>> = {};
  const results = await Promise.all(promises);
  for (const { token, hasAddress, balance } of results) {
    if (!(hasAddress.address in balances)) balances[hasAddress.address] = {};
    balances[hasAddress.address][token.address] = balance;
  }
  return balances;
}

export async function balance({ of, for: token }: { of: Address; for: IHasAddress }): Promise<bigint> {
  if (isSameAddress(token.address, Addresses.NATIVE_TOKEN)) {
    const balance = await ethers.provider.getBalance(of);
    return BigInt(balance.toString());
  } else {
    const balance = await new Contract(token.address, ERC20_ABI, ethers.provider).balanceOf(of);
    return BigInt(balance.toString());
  }
}

export function approve({ amount, to, for: token, from }: { amount: BigIntish; to: Address; for: IHasAddress; from: SignerWithAddress }) {
  return new Contract(token.address, ERC20_ABI, from).approve(to, amount);
}

export async function mintMany({ to, tokens }: { to: IHasAddress; tokens: { token: TestToken; amount: BigIntish }[] }) {
  await Promise.all(tokens.map(({ token, amount }) => mint({ amount, of: token, to })));
}

export async function mint({ of: token, amount, to: user }: { amount: BigIntish; of: TestToken; to: IHasAddress }) {
  if (isSameAddress(token.address, Addresses.NATIVE_TOKEN)) {
    await setBalance(user.address, amount);
  } else {
    await impersonateAccount(token.whale!);
    const whaleSigner = await ethers.getSigner(token.whale!);
    await setBalance(whaleSigner.address, parseEther('1'));
    const contract = new Contract(token.address, ERC20_ABI, whaleSigner);
    await contract.transfer(user.address, amount);
    await stopImpersonatingAccount(token.whale!);
  }
}

export async function loadTokens(chain: Chain) {
  const address = (name: string) => TOKENS[chain.chainId][name].address;
  const whale = (name: string) => TOKENS[chain.chainId][name].whale;
  const tokenSource = new DefiLlamaClient(new FetchService());
  const addresses = { [chain.chainId]: [Addresses.NATIVE_TOKEN, chain.wToken, address('STABLE_ERC20'), address('RANDOM_ERC20')] };
  const tokens = await tokenSource.getCurrentTokenData({ addresses });
  if (!tokens[chain.chainId][Addresses.NATIVE_TOKEN]) {
    tokens[chain.chainId][Addresses.NATIVE_TOKEN] = {
      ...tokens[chain.chainId][chain.wToken],
      symbol: chain.nativeCurrency.symbol,
    };
  }
  return {
    nativeToken: { ...tokens[chain.chainId][Addresses.NATIVE_TOKEN], address: Addresses.NATIVE_TOKEN },
    wToken: { ...tokens[chain.chainId][chain.wToken], address: address('wToken'), whale: whale('wToken') },
    STABLE_ERC20: { ...tokens[chain.chainId][address('STABLE_ERC20')], address: address('STABLE_ERC20'), whale: whale('STABLE_ERC20') },
    RANDOM_ERC20: { ...tokens[chain.chainId][address('RANDOM_ERC20')], address: address('RANDOM_ERC20'), whale: whale('RANDOM_ERC20') },
  };
}

export async function assertUsersBalanceIsReducedAsExpected({
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
  initialBalances: Record<Address, Record<TokenAddress, bigint>>;
}) {
  const initialBalance = initialBalances[user.address][sellToken.address];
  const bal = await balance({ of: user.address, for: sellToken });
  if (isSameAddress(sellToken.address, Addresses.NATIVE_TOKEN)) {
    const gasSpent = await calculateGasSpent(...(txs ?? []));
    expect(bal).to.equal(initialBalance - gasSpent - BigInt(quote.tx.value ?? 0));
  } else {
    const maxSellAmount = typeof quote.maxSellAmount === 'object' ? BigInt(quote.maxSellAmount.amount) : quote.maxSellAmount;
    expect(bal).to.be.gte(initialBalance - maxSellAmount);
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
  initialBalances: Record<Address, Record<TokenAddress, bigint>>;
}) {
  const initialBalance = initialBalances[recipient.address][buyToken.address];
  const bal = await balance({ of: recipient.address, for: buyToken });
  const minBuyAmount = typeof quote.minBuyAmount === 'object' ? BigInt(quote.minBuyAmount.amount) : quote.minBuyAmount;
  if (isSameAddress(buyToken.address, Addresses.NATIVE_TOKEN)) {
    const gasSpent = await calculateGasSpent(...(txs ?? []));
    expect(bal - initialBalance + gasSpent).to.be.gte(minBuyAmount);
  } else {
    expect(bal - initialBalance).to.be.gte(minBuyAmount);
  }
}

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint)',
  'function transfer(address to, uint amount)',
  'function approve(address to, uint amount)',
];

type IHasAddress = { address: Address };
