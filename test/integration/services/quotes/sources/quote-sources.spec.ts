import ms from 'ms';
import { ethers } from 'hardhat';
import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber, constants, utils } from 'ethers';
import { expect } from 'chai';
import crossFetch from 'cross-fetch';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { given, then, when } from '@test-utils/bdd';
import { fork } from '@test-utils/evm';
import { TransactionResponse } from '@ethersproject/providers';
import { Chains, getChainByKeyOrFail } from '@chains';
import { Addresses } from '@shared/constants';
import { addPercentage, isSameAddress, substractPercentage, wait } from '@shared/utils';
import { Chain, TokenAddress, Address, ChainId } from '@types';
import { IQuoteSource, QuoteSourceSupport, SourceQuoteRequest, SourceQuoteResponse } from '@services/quotes/quote-sources/types';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean-gas-price-source';
import { FetchService } from '@services/fetch/fetch-service';
import { GasPrice } from '@services/gas/types';
import { Test, EXCEPTIONS, CONFIG } from '../quote-tests-config';
import {
  approve,
  assertRecipientsBalanceIsIncreasedAsExpected,
  assertUsersBalanceIsReducedAsExpected,
  calculateBalancesFor,
  chainsWithTestData,
  loadTokens,
  mintMany,
  TestToken,
} from '@test-utils/erc20';
import { QUOTE_SOURCES, SourceWithConfigId } from '@services/quotes/source-registry';
import { SourceId } from '@services/quotes/types';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { Deferred } from '@shared/deferred';
import { TriggerablePromise } from '@shared/triggerable-promise';

// This is meant to be used for local testing. On the CI, we will do something different
const RUN_FOR: { source: SourceWithConfigId; chains: Chain[] | 'all' } = {
  source: 'rango',
  chains: [Chains.ARBITRUM],
};
const ROUNDING_ISSUES: SourceId[] = ['rango'];

// Since trading tests can be a little bit flaky, we want to re-test before failing
jest.retryTimes(3);
jest.setTimeout(ms('5m'));

describe('Quote Sources', () => {
  const sourcesPerChain = getSources();
  for (const chainId of Object.keys(sourcesPerChain)) {
    const chain = getChainByKeyOrFail(chainId);
    describe(`${chain.name}`, () => {
      const ONE_NATIVE_TOKEN = utils.parseEther('1');
      let user = new Deferred<SignerWithAddress>(),
        recipient = new Deferred<SignerWithAddress>(),
        nativeToken = new Deferred<TestToken>(),
        wToken = new Deferred<TestToken>(),
        STABLE_ERC20 = new Deferred<TestToken>(),
        RANDOM_ERC20 = new Deferred<TestToken>(),
        gasPrice = new Deferred<GasPrice>();
      let initialBalances: Record<Address, Record<TokenAddress, BigNumber>>;
      let snapshot: SnapshotRestorer;

      beforeAll(async () => {
        await fork(chain);
        const [userSigner, recipientSigner] = await ethers.getSigners();
        const tokens = await loadTokens(chain);

        await mintMany({
          to: userSigner,
          tokens: [
            { amount: utils.parseUnits('10000', tokens.STABLE_ERC20.decimals), token: tokens.STABLE_ERC20 },
            { amount: ONE_NATIVE_TOKEN.mul(3), token: tokens.nativeToken },
            { amount: ONE_NATIVE_TOKEN, token: tokens.wToken },
          ],
        });
        initialBalances = await calculateBalancesFor({
          tokens: [tokens.nativeToken, tokens.wToken, tokens.STABLE_ERC20, tokens.RANDOM_ERC20],
          addresses: [userSigner, recipientSigner],
        });
        const gasPriceResult = await new OpenOceanGasPriceSource(FETCH_SERVICE).getGasPrice(chain).then((gasPrices) => gasPrices['standard']);

        // Resolve all deferred
        user.resolve(userSigner);
        recipient.resolve(recipientSigner);
        nativeToken.resolve(tokens.nativeToken);
        wToken.resolve(tokens.wToken);
        STABLE_ERC20.resolve(tokens.STABLE_ERC20);
        RANDOM_ERC20.resolve(tokens.RANDOM_ERC20);
        gasPrice.resolve(gasPriceResult);
        snapshot = await takeSnapshot();
      });

      afterEach(async () => {
        await snapshot.restore();
      });

      describe('Sell order', () => {
        quoteTest({
          test: Test.SELL_STABLE_TO_NATIVE,
          when: 'swapping 1000 of stables to native token',
          request: {
            sellToken: STABLE_ERC20,
            buyToken: nativeToken,
            order: {
              type: 'sell',
              sellAmount: utils.parseUnits('1000', 6),
            },
          },
        });
        quoteTest({
          test: Test.SELL_NATIVE_TO_RANDOM_ERC20,
          when: 'swapping 1 native token to random token',
          request: {
            sellToken: nativeToken,
            buyToken: RANDOM_ERC20,
            order: {
              type: 'sell',
              sellAmount: ONE_NATIVE_TOKEN,
            },
          },
        });
      });
      describe('Swap and transfer', () => {
        quoteTest({
          test: Test.SELL_NATIVE_TO_STABLE_AND_TRANSFER,
          checkSupport: (support) => support.swapAndTransfer,
          when: 'swapping 1 native token to stable',
          request: {
            sellToken: nativeToken,
            buyToken: STABLE_ERC20,
            order: {
              type: 'sell',
              sellAmount: ONE_NATIVE_TOKEN,
            },
            recipient,
          },
        });
      });
      describe('Buy order', () => {
        quoteTest({
          test: Test.BUY_NATIVE_WITH_STABLE,
          checkSupport: (support) => support.buyOrders,
          when: 'buying 1 native token with stables',
          request: {
            sellToken: STABLE_ERC20,
            buyToken: nativeToken,
            order: {
              type: 'buy',
              buyAmount: ONE_NATIVE_TOKEN,
            },
          },
        });
      });
      describe('Wrap / Unwrap', () => {
        quoteTest({
          test: Test.WRAP_NATIVE_TOKEN,
          when: 'wrapping 1 native token',
          request: {
            sellToken: nativeToken,
            buyToken: wToken,
            order: {
              type: 'sell',
              sellAmount: ONE_NATIVE_TOKEN,
            },
          },
        });
        quoteTest({
          test: Test.UNWRAP_WTOKEN,
          when: 'unwrapping 1 wtoken',
          request: {
            sellToken: wToken,
            buyToken: nativeToken,
            order: {
              type: 'sell',
              sellAmount: ONE_NATIVE_TOKEN,
            },
          },
        });
      });

      function quoteTest({
        test,
        when: title,
        request,
        checkSupport,
      }: {
        test: Test;
        when: string;
        checkSupport?: (support: QuoteSourceSupport) => boolean;
        request: Quote;
      }) {
        when(title, () => {
          for (const [sourceId, source] of Object.entries(sourcesPerChain[chain.chainId])) {
            if (
              source.isConfigAndContextValid(getConfig(sourceId)) &&
              shouldExecute(sourceId, test) &&
              (!checkSupport || checkSupport(source.getMetadata().supports))
            ) {
              const quotePromise = buildQuote(sourceId, source, request, test);
              describe(`on ${source.getMetadata().name}`, () => {
                let quote: SourceQuoteResponse;
                let sellToken: TestToken, buyToken: TestToken, recipient: SignerWithAddress | undefined, takeFrom: SignerWithAddress;
                let txs: TransactionResponse[];
                given(async () => {
                  [sellToken, buyToken, recipient, takeFrom] = await Promise.all([request.sellToken, request.buyToken, request.recipient, user]);
                  quote = await quotePromise;
                  const approveTx =
                    isSameAddress(quote.allowanceTarget, constants.AddressZero) || isSameAddress(sellToken.address, Addresses.NATIVE_TOKEN)
                      ? []
                      : [await approve({ amount: quote.maxSellAmount, to: quote.allowanceTarget, for: sellToken, from: takeFrom })];
                  txs = [...approveTx, await execute({ quote, as: takeFrom })];
                });
                then('result is as expected', async () => {
                  await assertUsersBalanceIsReducedAsExpected({
                    txs,
                    sellToken,
                    quote,
                    user: takeFrom,
                    initialBalances,
                  });
                  await assertRecipientsBalanceIsIncreasedAsExpected({
                    txs,
                    buyToken,
                    quote,
                    recipient: recipient ?? takeFrom,
                    initialBalances,
                  });
                  assertQuoteIsConsistent(quote, {
                    sellToken,
                    buyToken,
                    ...request.order,
                    sourceId,
                  });
                });
              });
            }
          }
        });
      }

      function assertQuoteIsConsistent(
        quote: SourceQuoteResponse,
        {
          sellToken,
          sellAmount,
          buyToken,
          buyAmount,
          type,
          sourceId,
        }: {
          sellToken: TestToken;
          buyToken: TestToken;
          type: 'sell' | 'buy';
          sourceId: SourceId;
          sellAmount?: BigNumber;
          buyAmount?: BigNumber;
        }
      ) {
        expect(quote.type).to.equal(type);
        if (type === 'sell') {
          expect(quote.sellAmount).to.equal(sellAmount);
          expect(quote.sellAmount).to.equal(quote.maxSellAmount);
          if (buyAmount) {
            expect(quote.buyAmount).to.be.gte(buyAmount);
          } else {
            validateQuote(sellToken, buyToken, sellAmount!, quote.buyAmount);
          }
        } else {
          expect(quote.buyAmount).to.equal(buyAmount);
          expect(quote.buyAmount).to.equal(quote.minBuyAmount);
          if (sellAmount) {
            expect(quote.sellAmount).to.be.lte(sellAmount);
          } else {
            validateQuote(buyToken, sellToken, buyAmount!, quote.sellAmount);
          }
        }
        validateMinBuyMaxSell(sourceId, quote);
        if (isSameAddress(sellToken.address, Addresses.NATIVE_TOKEN)) {
          expect(quote.tx.value).to.equal(quote.maxSellAmount);
        } else {
          const isValueNotSet = (value?: BigNumber) => !value || value.isZero();
          expect(isValueNotSet(quote.tx.value)).to.be.true;
        }
      }

      function validateMinBuyMaxSell(sourceId: SourceId, quote: SourceQuoteResponse) {
        let slippage = SLIPPAGE_PERCENTAGE;
        if (ROUNDING_ISSUES.includes(sourceId)) slippage += 0.05;
        if (quote.type === 'sell') {
          expect(quote.minBuyAmount).to.be.gte(substractPercentage(quote.buyAmount.toString(), slippage, 'up'));
        } else {
          expect(quote.maxSellAmount).to.be.lte(addPercentage(quote.sellAmount.toString(), slippage, 'up'));
        }
      }

      const TRESHOLD_PERCENTAGE = 3; // 3%
      function validateQuote(from: TestToken, to: TestToken, fromAmount: BigNumber, toAmount: BigNumber) {
        const fromPriceBN = utils.parseEther(`${from.price!}`);
        const toPriceBN = utils.parseEther(`${to.price!}`);
        const magnitudeFrom = utils.parseUnits('1', from.decimals);
        const magnitudeTo = utils.parseUnits('1', to.decimals);
        const expected = fromAmount.mul(fromPriceBN).mul(magnitudeTo).div(toPriceBN).div(magnitudeFrom);

        const threshold = expected.mul(TRESHOLD_PERCENTAGE * 10).div(100 * 10);
        const lowerThreshold = expected.sub(threshold);
        expect(toAmount).to.be.gte(lowerThreshold);
      }

      type Quote = Pick<SourceQuoteRequest<{ swapAndTransfer: boolean; buyOrders: true }>, 'order'> & {
        recipient?: Promise<SignerWithAddress>;
        sellToken: Promise<TestToken>;
        buyToken: Promise<TestToken>;
      };
      async function buildQuote(sourceId: string, source: IQuoteSource<any>, quote: Quote, test: Test) {
        const [sellToken, buyToken, takeFrom, recipient] = await Promise.all([quote.sellToken, quote.buyToken, user, quote.recipient]);
        // If we execute all requests at the same time, then we'll probably get rate-limited. So the idea is to wait a little for each test so requests are not executed concurrently
        const millisToWait = ms('0.5s') * test;
        await wait(millisToWait);
        return source.quote({
          components: { providerSource: PROVIDER_SOURCE, fetchService: FETCH_SERVICE },
          request: {
            ...quote,
            sellToken: sellToken.address,
            buyToken: buyToken.address,
            chain,
            config: {
              slippagePercentage: SLIPPAGE_PERCENTAGE,
              txValidFor: '5m',
              timeout: '15s',
            },
            accounts: { takeFrom: takeFrom.address, recipient: recipient?.address },
            external: {
              gasPrice: new TriggerablePromise(() => gasPrice),
              tokenData: new TriggerablePromise(() => Promise.resolve({ sellToken, buyToken })),
            },
          },
          config: getConfig(sourceId),
        });
      }

      function execute({
        as,
        quote: {
          tx: { value, calldata, to },
        },
      }: {
        as: SignerWithAddress;
        quote: SourceQuoteResponse;
      }) {
        return as.sendTransaction({ to, data: calldata, value });
      }

      function shouldExecute(sourceId: string, test: Test) {
        return !EXCEPTIONS[sourceId]?.includes(test);
      }
    });

    function getConfig(sourceId: SourceId) {
      return {
        ...CONFIG.global,
        ...CONFIG.custom?.[sourceId as SourceWithConfigId],
      };
    }
  }
});

function getSources() {
  const sources = QUOTE_SOURCES;
  const result: Record<ChainId, Record<string, IQuoteSource<QuoteSourceSupport>>> = {};

  if (process.env.CI_CONTEXT) {
    // Will choose test on Ethereum or, if not supported, choose random chain
    for (const [sourceId, source] of Object.entries(sources)) {
      const supportedChains = chainsWithTestData(source.getMetadata().supports.chains);
      const chainId = supportedChains.includes(Chains.ETHEREUM.chainId)
        ? Chains.ETHEREUM.chainId
        : supportedChains[Math.floor(Math.random() * supportedChains.length)];
      if (!(chainId in result)) result[chainId] = {} as any;
      result[chainId][sourceId] = source;
    }
  } else {
    const source = sources[RUN_FOR.source];
    const chains =
      RUN_FOR.chains === 'all' ? chainsWithTestData(source.getMetadata().supports.chains) : RUN_FOR.chains.map(({ chainId }) => chainId);
    for (const chainId of chains) {
      if (!(chainId in result)) result[chainId] = {} as any;
      result[chainId][RUN_FOR.source] = source;
    }
  }
  return result;
}

const PROVIDER_SOURCE = new PublicRPCsSource();
const FETCH_SERVICE = new FetchService(crossFetch);
const SLIPPAGE_PERCENTAGE = 5; // We set a high slippage so that the tests don't fail as much
