import ms from 'ms';
import { ethers } from 'hardhat';
import {
  impersonateAccount,
  setBalance,
  SnapshotRestorer,
  stopImpersonatingAccount,
  takeSnapshot,
} from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber, BigNumberish, Bytes, constants, Contract, utils } from 'ethers';
import { expect } from 'chai';
import crossFetch from 'cross-fetch';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { given, then, when } from '@test-utils/bdd';
import { fork } from '@test-utils/evm';
import { TransactionResponse } from '@ethersproject/providers';
import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { calculatePercentage, isSameAddress } from '@shared/utils';
import { Chain, TokenAddress, ChainId, Address } from '@types';
import { AvailableSources, GlobalQuoteSourceConfig } from '@services/quotes/types';
import { QuoteSource, QuoteSourceSupport, SourceQuoteRequest, SourceQuoteResponse } from '@services/quotes/quote-sources/base';
import { DefiLlamaToken, DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { AllSourcesConfig, buildSources } from '@services/quotes/sources-list';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean';
import { FetchService } from '@services/fetch/fetch-service';
import { GasPrice } from '@services/gas/types';

// It's very time expensive to test all sources for all chains, so we need to choose
const RUN_FOR: { source: AvailableSources | undefined; chain: Chain | undefined } = {
  source: undefined, // If undefined, will select one randomly
  chain: undefined, // If undefined, will select one randomly
};

// Since trading tests can be a little bit flaky, we want to re-test before failing
jest.retryTimes(3);
jest.setTimeout(ms('5m'));

const CONFIG: GlobalQuoteSourceConfig & AllSourcesConfig = {
  odos: { apiKey: process.env.ODOS_API_KEY! },
};

type TokenData = { address: TokenAddress; whale: Address };
type ChainTokens = { WBTC: TokenData; USDC: TokenData; wToken: TokenData };
// TODO: Add more chains
const TOKENS: Record<ChainId, Record<string, TokenData>> = {
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

enum Test {
  SELL_USDC_TO_NATIVE,
  SELL_NATIVE_TO_WBTC,
  BUY_WTOKEN_WITH_NATIVE,
  BUY_NATIVE_WITH_WTOKEN,
  BUY_NATIVE_WITH_USDC,
  WRAP_NATIVE_TOKEN,
  UNWRAP_WTOKEN,
  SELL_NATIVE_TO_USDC_AND_TRANSFER,
  WRAP_NATIVE_TOKEN_AND_TRANSFER,
  UNWRAP_WTOKEN_AND_TRANSFER,
}
const EXCEPTIONS: Partial<Record<AvailableSources, Test[]>> = {
  ['uniswap']: [
    Test.BUY_WTOKEN_WITH_NATIVE,
    Test.BUY_NATIVE_WITH_WTOKEN,
    Test.WRAP_NATIVE_TOKEN,
    Test.UNWRAP_WTOKEN,
    Test.WRAP_NATIVE_TOKEN_AND_TRANSFER,
    Test.UNWRAP_WTOKEN_AND_TRANSFER,
  ],
};

describe('Quote Sources', () => {
  const { sourceId, source } = getSource();
  const metadata = source.getMetadata();
  describe(metadata.name, () => {
    const chain = getChain(source);
    describe(`${chain.name}`, () => {
      const ONE_NATIVE_TOKEN = utils.parseEther('1');
      let user: SignerWithAddress, recipient: SignerWithAddress;
      let nativeToken: DefiLlamaToken, wToken: DefiLlamaToken, USDC: DefiLlamaToken, WBTC: DefiLlamaToken;
      let initialBalances: Record<Address, Record<TokenAddress, BigNumber>>;
      let snapshot: SnapshotRestorer;
      let gasPricePromise: Promise<GasPrice>;

      beforeAll(async () => {
        await fork(chain);
        [user, recipient] = await ethers.getSigners();
        await loadTokens(chain);
        await mintTokens();
        await calculateInitialBalances();
        gasPricePromise = new OpenOceanGasPriceSource(FETCH_SERVICE).getGasPrice(chain.chainId).then((gasPrice) => gasPrice['standard']);
        snapshot = await takeSnapshot();
      });

      afterEach(async () => {
        await snapshot.restore();
      });

      describe('Sell order', () => {
        if (shouldExecute(sourceId, Test.SELL_USDC_TO_NATIVE)) {
          when('swapping 1000 USDC to native token', () => {
            const SELL_AMOUNT = utils.parseUnits('1000', 6);
            let quote: SourceQuoteResponse;
            let txs: TransactionResponse[];
            given(async () => {
              quote = await buildQuote(source, {
                sellToken: USDC,
                buyToken: nativeToken,
                order: {
                  type: 'sell',
                  sellAmount: SELL_AMOUNT,
                },
              });
              txs = [await approve({ amount: SELL_AMOUNT, to: quote.swapper.allowanceTarget, for: USDC }), await execute({ quote, as: user })];
            });
            then('result is as expected', async () => {
              assertQuoteIsConsistent(quote, {
                sellToken: USDC,
                buyToken: nativeToken,
                sellAmount: SELL_AMOUNT,
                type: 'sell',
              });
              await assertUsersBalanceIsReduceAsExpected(txs, USDC, quote);
              await assertRecipientsBalanceIsIncreasedAsExpected(txs, nativeToken, quote, user);
            });
          });
        }
        if (shouldExecute(sourceId, Test.SELL_NATIVE_TO_WBTC)) {
          when('swapping 1 native token to WBTC', () => {
            let quote: SourceQuoteResponse;
            let txs: TransactionResponse[];
            given(async () => {
              quote = await buildQuote(source, {
                sellToken: nativeToken,
                buyToken: WBTC,
                order: {
                  type: 'sell',
                  sellAmount: ONE_NATIVE_TOKEN,
                },
              });
              txs = [await execute({ quote, as: user })];
            });
            then('result is as expected', async () => {
              assertQuoteIsConsistent(quote, {
                sellToken: nativeToken,
                buyToken: WBTC,
                sellAmount: ONE_NATIVE_TOKEN,
                type: 'sell',
              });
              await assertUsersBalanceIsReduceAsExpected(txs, nativeToken, quote);
              await assertRecipientsBalanceIsIncreasedAsExpected(txs, WBTC, quote, user);
            });
          });
        }
      });
      if (metadata.supports.swapAndTransfer) {
        describe('Swap and transfer', () => {
          if (shouldExecute(sourceId, Test.SELL_NATIVE_TO_USDC_AND_TRANSFER)) {
            when('swapping 1 native token to USDC', () => {
              let quote: SourceQuoteResponse;
              let txs: TransactionResponse[];
              given(async () => {
                quote = await buildQuote(source, {
                  sellToken: nativeToken,
                  buyToken: USDC,
                  order: {
                    type: 'sell',
                    sellAmount: ONE_NATIVE_TOKEN,
                  },
                  recipient,
                });
                txs = [await execute({ quote, as: user })];
              });
              then('result is as expected', async () => {
                assertQuoteIsConsistent(quote, {
                  sellToken: nativeToken,
                  buyToken: USDC,
                  sellAmount: ONE_NATIVE_TOKEN,
                  type: 'sell',
                });
                await assertUsersBalanceIsReduceAsExpected(txs, nativeToken, quote);
                await assertRecipientsBalanceIsIncreasedAsExpected(txs, USDC, quote, recipient);
              });
            });
          }
          if (shouldExecute(sourceId, Test.WRAP_NATIVE_TOKEN_AND_TRANSFER)) {
            when('wrapping 1 native token and transferring', () => {
              let quote: SourceQuoteResponse;
              let txs: TransactionResponse[];
              given(async () => {
                quote = await buildQuote(source, {
                  sellToken: nativeToken,
                  buyToken: wToken,
                  order: {
                    type: 'sell',
                    sellAmount: ONE_NATIVE_TOKEN,
                  },
                  recipient,
                });
                txs = [await execute({ quote, as: user })];
              });
              then('result is as expected', async () => {
                assertQuoteIsConsistent(quote, {
                  sellToken: nativeToken,
                  buyToken: wToken,
                  sellAmount: ONE_NATIVE_TOKEN,
                  buyAmount: ONE_NATIVE_TOKEN,
                  type: 'sell',
                  slippagePercentage: 0,
                });
                await assertUsersBalanceIsReduceAsExpected(txs, nativeToken, quote);
                await assertRecipientsBalanceIsIncreasedAsExpected(txs, wToken, quote, recipient);
              });
            });
          }
          if (shouldExecute(sourceId, Test.UNWRAP_WTOKEN_AND_TRANSFER)) {
            when('unwrapping 1 wtoken and transferring', () => {
              let quote: SourceQuoteResponse;
              let txs: TransactionResponse[];
              given(async () => {
                quote = await buildQuote(source, {
                  sellToken: wToken,
                  buyToken: nativeToken,
                  order: {
                    type: 'sell',
                    sellAmount: ONE_NATIVE_TOKEN,
                  },
                  recipient,
                });
                txs = [
                  await approve({ amount: ONE_NATIVE_TOKEN, to: quote.swapper.allowanceTarget, for: wToken }),
                  await execute({ quote, as: user }),
                ];
              });
              then('result is as expected', async () => {
                assertQuoteIsConsistent(quote, {
                  sellToken: wToken,
                  buyToken: nativeToken,
                  sellAmount: ONE_NATIVE_TOKEN,
                  buyAmount: ONE_NATIVE_TOKEN,
                  type: 'sell',
                  slippagePercentage: 0,
                });
                await assertUsersBalanceIsReduceAsExpected(txs, wToken, quote);
                await assertRecipientsBalanceIsIncreasedAsExpected(txs, nativeToken, quote, recipient);
              });
            });
          }
        });
      }
      if (metadata.supports.buyOrders) {
        describe('Buy order', () => {
          if (shouldExecute(sourceId, Test.BUY_NATIVE_WITH_USDC)) {
            when('buying 1 native token with USDC', () => {
              let quote: SourceQuoteResponse;
              let txs: TransactionResponse[];
              given(async () => {
                quote = await buildQuote(source, {
                  sellToken: USDC,
                  buyToken: nativeToken,
                  order: {
                    type: 'buy',
                    buyAmount: ONE_NATIVE_TOKEN,
                  },
                });
                txs = [
                  await approve({ amount: quote.maxSellAmount, to: quote.swapper.allowanceTarget, for: USDC }),
                  await execute({ quote, as: user }),
                ];
              });
              then('result is as expected', async () => {
                assertQuoteIsConsistent(quote, {
                  sellToken: USDC,
                  buyToken: nativeToken,
                  buyAmount: ONE_NATIVE_TOKEN,
                  type: 'buy',
                });
                await assertUsersBalanceIsReduceAsExpected(txs, USDC, quote);
                await assertRecipientsBalanceIsIncreasedAsExpected(txs, nativeToken, quote, user);
              });
            });
          }
          if (shouldExecute(sourceId, Test.BUY_WTOKEN_WITH_NATIVE)) {
            when('buying 1 wToken with native token', () => {
              let quote: SourceQuoteResponse;
              let txs: TransactionResponse[];
              given(async () => {
                quote = await buildQuote(source, {
                  sellToken: nativeToken,
                  buyToken: wToken,
                  order: {
                    type: 'buy',
                    buyAmount: ONE_NATIVE_TOKEN,
                  },
                });
                txs = [
                  await approve({ amount: ONE_NATIVE_TOKEN, to: quote.swapper.allowanceTarget, for: wToken }),
                  await execute({ quote, as: user }),
                ];
              });
              then('result is as expected', async () => {
                assertQuoteIsConsistent(quote, {
                  sellToken: nativeToken,
                  buyToken: wToken,
                  sellAmount: ONE_NATIVE_TOKEN,
                  buyAmount: ONE_NATIVE_TOKEN,
                  type: 'buy',
                  slippagePercentage: 0,
                });
                await assertUsersBalanceIsReduceAsExpected(txs, nativeToken, quote);
                await assertRecipientsBalanceIsIncreasedAsExpected(txs, wToken, quote, user);
              });
            });
          }
          if (shouldExecute(sourceId, Test.BUY_NATIVE_WITH_WTOKEN)) {
            when('buying 1 native token with wToken', () => {
              let quote: SourceQuoteResponse;
              let txs: TransactionResponse[];
              given(async () => {
                quote = await buildQuote(source, {
                  sellToken: wToken,
                  buyToken: nativeToken,
                  order: {
                    type: 'buy',
                    buyAmount: ONE_NATIVE_TOKEN,
                  },
                });
                txs = [
                  await approve({ amount: quote.maxSellAmount, to: quote.swapper.allowanceTarget, for: wToken }),
                  await execute({ quote, as: user }),
                ];
              });
              then('result is as expected', async () => {
                assertQuoteIsConsistent(quote, {
                  sellToken: wToken,
                  buyToken: nativeToken,
                  sellAmount: ONE_NATIVE_TOKEN,
                  buyAmount: ONE_NATIVE_TOKEN,
                  type: 'buy',
                  slippagePercentage: 0,
                });
                await assertUsersBalanceIsReduceAsExpected(txs, wToken, quote);
                await assertRecipientsBalanceIsIncreasedAsExpected(txs, nativeToken, quote, user);
              });
            });
          }
        });
      }
      describe('Wrap / Unwrap', () => {
        if (shouldExecute(sourceId, Test.WRAP_NATIVE_TOKEN)) {
          when('wrapping 1 native token', () => {
            let quote: SourceQuoteResponse;
            let txs: TransactionResponse[];
            given(async () => {
              quote = await buildQuote(source, {
                sellToken: nativeToken,
                buyToken: wToken,
                order: {
                  type: 'sell',
                  sellAmount: ONE_NATIVE_TOKEN,
                },
              });
              txs = [await execute({ quote, as: user })];
            });
            then('result is as expected', async () => {
              assertQuoteIsConsistent(quote, {
                sellToken: nativeToken,
                buyToken: wToken,
                sellAmount: ONE_NATIVE_TOKEN,
                buyAmount: ONE_NATIVE_TOKEN,
                type: 'sell',
                slippagePercentage: 0,
              });
              await assertUsersBalanceIsReduceAsExpected(txs, nativeToken, quote);
              await assertRecipientsBalanceIsIncreasedAsExpected(txs, wToken, quote, user);
            });
          });
        }
        if (shouldExecute(sourceId, Test.UNWRAP_WTOKEN)) {
          when('unwrapping 1 wtoken', () => {
            let quote: SourceQuoteResponse;
            let txs: TransactionResponse[];
            given(async () => {
              quote = await buildQuote(source, {
                sellToken: wToken,
                buyToken: nativeToken,
                order: {
                  type: 'sell',
                  sellAmount: ONE_NATIVE_TOKEN,
                },
              });
              txs = [
                await approve({ amount: ONE_NATIVE_TOKEN, to: quote.swapper.allowanceTarget, for: wToken }),
                await execute({ quote, as: user }),
              ];
            });
            then('result is as expected', async () => {
              assertQuoteIsConsistent(quote, {
                sellToken: wToken,
                buyToken: nativeToken,
                sellAmount: ONE_NATIVE_TOKEN,
                buyAmount: ONE_NATIVE_TOKEN,
                type: 'sell',
                slippagePercentage: 0,
              });
              await assertUsersBalanceIsReduceAsExpected(txs, wToken, quote);
              await assertRecipientsBalanceIsIncreasedAsExpected(txs, nativeToken, quote, user);
            });
          });
        }
      });

      function assertQuoteIsConsistent(
        quote: SourceQuoteResponse,
        {
          sellToken,
          sellAmount,
          buyToken,
          buyAmount,
          type,
          slippagePercentage,
        }: {
          sellToken: DefiLlamaToken;
          buyToken: DefiLlamaToken;
          type: 'sell' | 'buy';
          sellAmount?: BigNumber;
          buyAmount?: BigNumber;
          isSwapAndTransfer?: boolean;
          slippagePercentage?: number;
        }
      ) {
        expect(quote.type).to.equal(type);
        if (type === 'sell') {
          expect(quote.sellAmount).to.equal(sellAmount);
          expect(quote.sellAmount).to.equal(quote.maxSellAmount);
          if (buyAmount) {
            expect(quote.buyAmount).to.equal(buyAmount);
          } else {
            validateQuote(sellToken, buyToken, sellAmount!, quote.buyAmount);
          }
          const allowedSlippage = calculatePercentage(quote.buyAmount, slippagePercentage ?? SLIPPAGE_PERCENTAGE);
          expect(quote.minBuyAmount).to.be.gte(quote.buyAmount.sub(allowedSlippage));
          if (isSameAddress(sellToken.address, Addresses.NATIVE_TOKEN)) {
            expect(quote.value).to.equal(quote.maxSellAmount);
          } else {
            const isValueNotSet = (value?: BigNumber) => !value || value.isZero();
            expect(isValueNotSet(quote.value)).to.be.true;
          }
        } else {
          expect(quote.buyAmount).to.equal(buyAmount);
          expect(quote.buyAmount).to.equal(quote.minBuyAmount);
          if (sellAmount) {
            expect(quote.sellAmount).to.equal(sellAmount);
          } else {
            validateQuote(buyToken, sellToken, buyAmount!, quote.sellAmount);
          }
          const allowedSlippage = calculatePercentage(quote.sellAmount, slippagePercentage ?? SLIPPAGE_PERCENTAGE);
          expect(quote.maxSellAmount).to.be.lte(quote.sellAmount.add(allowedSlippage));
        }
      }

      const TRESHOLD_PERCENTAGE = 3; // 3%
      function validateQuote(from: DefiLlamaToken, to: DefiLlamaToken, fromAmount: BigNumber, toAmount: BigNumber) {
        const fromPriceBN = utils.parseEther(`${from.price!}`);
        const toPriceBN = utils.parseEther(`${to.price!}`);
        const magnitudeFrom = utils.parseUnits('1', from.decimals);
        const magnitudeTo = utils.parseUnits('1', to.decimals);
        const expected = fromAmount.mul(fromPriceBN).mul(magnitudeTo).div(toPriceBN).div(magnitudeFrom);

        const threshold = expected.mul(TRESHOLD_PERCENTAGE * 10).div(100 * 10);
        const [upperThreshold, lowerThreshold] = [expected.add(threshold), expected.sub(threshold)];
        expect(toAmount).to.be.lte(upperThreshold).and.to.be.gte(lowerThreshold);
      }

      async function assertUsersBalanceIsReduceAsExpected(txs: TransactionResponse[], sellToken: DefiLlamaToken, quote: SourceQuoteResponse) {
        const initialBalance = initialBalances[user.address][sellToken.address];
        const bal = await balance({ of: user.address, for: sellToken });
        if (isSameAddress(sellToken.address, Addresses.NATIVE_TOKEN)) {
          const gasSpent = await calculateGasSpent(txs);
          expect(bal).to.equal(initialBalance.sub(gasSpent).sub(quote.value ?? 0));
        } else {
          expect(bal).to.be.gte(initialBalance.sub(quote.maxSellAmount));
        }
      }

      async function assertRecipientsBalanceIsIncreasedAsExpected(
        txs: TransactionResponse[],
        buyToken: DefiLlamaToken,
        quote: SourceQuoteResponse,
        recipient: SignerWithAddress
      ) {
        const initialBalance = initialBalances[recipient.address][buyToken.address];
        const bal = await balance({ of: recipient.address, for: buyToken });
        if (isSameAddress(buyToken.address, Addresses.NATIVE_TOKEN)) {
          const gasSpent = await calculateGasSpent(txs);
          expect(bal.sub(initialBalance).add(gasSpent)).to.be.gte(quote.minBuyAmount);
        } else {
          expect(bal.sub(initialBalance)).to.be.gte(quote.minBuyAmount);
        }
      }

      async function calculateGasSpent(txs: TransactionResponse[]) {
        const gasSpentEach = await Promise.all(txs.map((tx) => tx.wait().then((receipt) => receipt.gasUsed.mul(receipt.effectiveGasPrice))));
        return gasSpentEach.reduce((accum, curr) => accum.add(curr), constants.Zero);
      }

      async function loadTokens(chain: Chain) {
        const address = (name: string) => TOKENS[chain.chainId][name].address;
        const tokenSource = new DefiLlamaTokenSource(FETCH_SERVICE);
        const tokens = await tokenSource.getTokens({
          [chain.chainId]: [Addresses.NATIVE_TOKEN, chain.wToken, address('USDC'), address('WBTC')],
        });
        nativeToken = tokens[chain.chainId][Addresses.NATIVE_TOKEN];
        wToken = tokens[chain.chainId][chain.wToken];
        USDC = tokens[chain.chainId][address('USDC')];
        WBTC = tokens[chain.chainId][address('WBTC')];
      }

      async function mintTokens() {
        await mint({ amount: utils.parseUnits('10000', 6), of: USDC, to: user });
        await mint({ amount: ONE_NATIVE_TOKEN.mul(3), of: nativeToken, to: user });
        await mint({ amount: ONE_NATIVE_TOKEN, of: wToken, to: user });
      }

      async function calculateInitialBalances() {
        initialBalances = {};
        for (const signer of [user, recipient]) {
          const entries = [nativeToken, wToken, USDC, WBTC].map<Promise<[TokenAddress, BigNumber]>>(async (token) => [
            token.address,
            await balance({ of: signer.address, for: token }),
          ]);
          initialBalances[signer.address] = Object.fromEntries(await Promise.all(entries));
        }
      }

      type Quote = Pick<SourceQuoteRequest<{ swapAndTransfer: boolean; buyOrders: true }>, 'order'> & {
        recipient?: SignerWithAddress;
        sellToken: DefiLlamaToken;
        buyToken: DefiLlamaToken;
      };
      function buildQuote(source: QuoteSource<any, any, any>, { sellToken, buyToken, ...quote }: Quote) {
        return source.quote(
          { fetchService: FETCH_SERVICE },
          {
            ...quote,
            sellToken: sellToken.address,
            buyToken: buyToken.address,
            chain,
            config: {
              slippagePercentage: SLIPPAGE_PERCENTAGE,
              txValidFor: '5m',
              timeout: '15s',
            },
            accounts: { takeFrom: user.address, recipient: quote.recipient?.address },
            sellTokenData: Promise.resolve(sellToken),
            buyTokenData: Promise.resolve(buyToken),
            context: { gasPrice: gasPricePromise },
          }
        );
      }

      function execute({ as, quote }: { as: SignerWithAddress; quote: SourceQuoteResponse }) {
        return as.sendTransaction({ to: quote.swapper.address, data: quote.calldata, value: quote.value });
      }

      function balance({ of, for: token }: { of: Address; for: DefiLlamaToken }) {
        if (isSameAddress(token.address, Addresses.NATIVE_TOKEN)) {
          return ethers.provider.getBalance(of);
        } else {
          return new Contract(token.address, ERC20_ABI, ethers.provider).balanceOf(of);
        }
      }

      function shouldExecute(sourceId: AvailableSources, test: Test) {
        return !EXCEPTIONS[sourceId]?.includes(test);
      }

      function approve({ amount, to, for: token }: { amount: BigNumberish; to: Address; for: DefiLlamaToken }) {
        return new Contract(token.address, ERC20_ABI, user).approve(to, amount);
      }

      async function mint({ of: token, amount, to: user }: { amount: Exclude<BigNumberish, Bytes>; of: DefiLlamaToken; to: SignerWithAddress }) {
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
    });
  });
});

function getSource() {
  const sources = buildSources(CONFIG, CONFIG);
  let sourceId = RUN_FOR.source;
  if (!sourceId) {
    // Choose one random if none is chosen
    const ids = Object.keys(sources) as AvailableSources[];
    sourceId = chooseRandom(ids);
  }
  return { sourceId, source: sources[sourceId] };
}

function getChain(source: QuoteSource<QuoteSourceSupport, any, any>): Chain {
  const possibleChains = source.getMetadata().supports.chains
    .filter((chain) => chain.chainId in TOKENS)
  return RUN_FOR.chain ?? chooseRandom(possibleChains);
}

function chooseRandom<T>(array: T[]) {
  return array[Math.floor(Math.random() * array.length)];
}

const FETCH_SERVICE = new FetchService(crossFetch);
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint)',
  'function transfer(address to, uint amount)',
  'function approve(address to, uint amount)',
];
const SLIPPAGE_PERCENTAGE = 5; // We set a high slippage so that the tests don't fail as much
