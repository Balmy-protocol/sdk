import ms from 'ms';
import { ethers } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { expect } from 'chai';
import crossFetch from 'cross-fetch';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { then, when } from '@test-utils/bdd';
import { Addresses } from '@shared/constants';
import { calculatePercentage, isSameAddress } from '@shared/utils';
import { Chain } from '@types';
import { AvailableSources } from '@services/quotes/types';
import { QuoteSource, SourceQuoteRequest, SourceQuoteResponse } from '@services/quotes/quote-sources/base';
import { DefiLlamaToken, DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean';
import { FetchService } from '@services/fetch/fetch-service';
import { GasPrice } from '@services/gas/types';
import { EXCEPTIONS, getAllSources, Test, TOKENS } from './quote-tests-config';
import { Chains } from '@chains';

// Since trading tests can be a little bit flaky, we want to re-test before failing
jest.retryTimes(3);
jest.setTimeout(ms('1m'));

describe('Quote Calculation', () => {
  const sourcesPerChain = getAllSources(true);

  for (const [chainId, sources] of Object.entries(sourcesPerChain)) {
    const chain = Chains.byKeyOrFail(chainId);
    describe(`${chain.name}`, () => {
      const ONE_NATIVE_TOKEN = utils.parseEther('1');

      // Have to do this or this won't work with test.concurrent on jest
      let beforeAllResolve: (_: unknown) => void;
      const beforeAllPromise = new Promise((resolve) => {
        beforeAllResolve = resolve;
      });

      let user: SignerWithAddress, recipient: SignerWithAddress;
      let nativeToken: DefiLlamaToken, wToken: DefiLlamaToken, USDC: DefiLlamaToken, WBTC: DefiLlamaToken;
      let gasPricePromise: Promise<GasPrice>;

      beforeAll(async () => {
        [user, recipient] = await ethers.getSigners();
        await loadTokens(chain);
        gasPricePromise = new OpenOceanGasPriceSource(FETCH_SERVICE).getGasPrice(chain.chainId).then((gasPrice) => gasPrice['standard']);
        beforeAllResolve({});
      });

      for (const [sourceId, source] of Object.entries(sources)) {
        const metadata = source.getMetadata();
        describe(metadata.name, () => {
          describe('Sell order', () => {
            quoteTest({
              test: Test.SELL_USDC_TO_NATIVE,
              when: 'swapping 1000 USDC to native token',
              quote: () => ({
                sellToken: USDC,
                buyToken: nativeToken,
                order: {
                  type: 'sell',
                  sellAmount: utils.parseUnits('1000', 6),
                },
              }),
            });
            quoteTest({
              test: Test.SELL_NATIVE_TO_WBTC,
              when: 'swapping 1 native token to WBTC',
              quote: () => ({
                sellToken: nativeToken,
                buyToken: WBTC,
                order: {
                  type: 'sell',
                  sellAmount: ONE_NATIVE_TOKEN,
                },
              }),
            });
          });
          if (metadata.supports.swapAndTransfer) {
            describe('Swap and transfer', () => {
              quoteTest({
                test: Test.SELL_NATIVE_TO_USDC_AND_TRANSFER,
                when: 'swapping 1 native token to USDC',
                quote: () => ({
                  sellToken: nativeToken,
                  buyToken: USDC,
                  order: {
                    type: 'sell',
                    sellAmount: ONE_NATIVE_TOKEN,
                  },
                  recipient,
                }),
              });
              quoteTest({
                test: Test.WRAP_NATIVE_TOKEN_AND_TRANSFER,
                when: 'wrapping 1 native token and transferring',
                quote: () => ({
                  sellToken: nativeToken,
                  buyToken: wToken,
                  order: {
                    type: 'sell',
                    sellAmount: ONE_NATIVE_TOKEN,
                  },
                  slippagePercentage: 0,
                  recipient,
                }),
              });
              quoteTest({
                test: Test.UNWRAP_WTOKEN_AND_TRANSFER,
                when: 'unwrapping 1 wtoken and transferring',
                quote: () => ({
                  sellToken: wToken,
                  buyToken: nativeToken,
                  order: {
                    type: 'sell',
                    sellAmount: ONE_NATIVE_TOKEN,
                  },
                  slippagePercentage: 0,
                  recipient,
                }),
              });
            });
          }
          if (metadata.supports.buyOrders) {
            describe('Buy order', () => {
              quoteTest({
                test: Test.BUY_NATIVE_WITH_USDC,
                when: 'buying 1 native token with USDC',
                quote: () => ({
                  sellToken: USDC,
                  buyToken: nativeToken,
                  order: {
                    type: 'buy',
                    buyAmount: ONE_NATIVE_TOKEN,
                  },
                }),
              });
              quoteTest({
                test: Test.BUY_WTOKEN_WITH_NATIVE,
                when: 'buying 1 wToken with native token',
                quote: () => ({
                  sellToken: nativeToken,
                  buyToken: wToken,
                  order: {
                    type: 'buy',
                    buyAmount: ONE_NATIVE_TOKEN,
                  },
                  slippagePercentage: 0,
                }),
              });
              quoteTest({
                test: Test.BUY_NATIVE_WITH_WTOKEN,
                when: 'buying 1 native token with wToken',
                quote: () => ({
                  sellToken: wToken,
                  buyToken: nativeToken,
                  order: {
                    type: 'buy',
                    buyAmount: ONE_NATIVE_TOKEN,
                  },
                  slippagePercentage: 0,
                }),
              });
            });
          }
          describe('Wrap / Unwrap', () => {
            quoteTest({
              test: Test.WRAP_NATIVE_TOKEN,
              when: 'wrapping 1 native token',
              quote: () => ({
                sellToken: nativeToken,
                buyToken: wToken,
                order: {
                  type: 'sell',
                  sellAmount: ONE_NATIVE_TOKEN,
                },
              }),
            });
            quoteTest({
              test: Test.UNWRAP_WTOKEN,
              when: 'unwrapping 1 wtoken',
              quote: () => ({
                sellToken: wToken,
                buyToken: nativeToken,
                order: {
                  type: 'sell',
                  sellAmount: ONE_NATIVE_TOKEN,
                },
              }),
            });
          });
        });

        function quoteTest({ test, when: title, quote: quoteFtn }: { test: Test; when: string; quote: () => Quote }) {
          if (shouldExecute(sourceId, test)) {
            when(title, () => {
              then.concurrent('quote is as expected', async () => {
                await beforeAllPromise;
                const quote = quoteFtn();
                const response = await buildQuote(source, quote);
                assertQuoteIsConsistent(response, {
                  sellToken: quote.sellToken,
                  buyToken: quote.buyToken,
                  ...quote.order,
                });
              });
            });
          }
        }

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
              expect(quote.buyAmount).to.be.gte(buyAmount);
            } else {
              validateQuote(sellToken, buyToken, sellAmount!, quote.buyAmount);
            }
            const allowedSlippage = calculatePercentage(quote.buyAmount, slippagePercentage ?? SLIPPAGE_PERCENTAGE);
            expect(quote.minBuyAmount).to.be.gte(quote.buyAmount.sub(allowedSlippage));
          } else {
            expect(quote.buyAmount).to.equal(buyAmount);
            expect(quote.buyAmount).to.equal(quote.minBuyAmount);
            if (sellAmount) {
              expect(quote.sellAmount).to.be.lte(sellAmount);
            } else {
              validateQuote(buyToken, sellToken, buyAmount!, quote.sellAmount);
            }
            const allowedSlippage = calculatePercentage(quote.sellAmount, slippagePercentage ?? SLIPPAGE_PERCENTAGE);
            expect(quote.maxSellAmount).to.be.lte(quote.sellAmount.add(allowedSlippage));
          }
          if (isSameAddress(sellToken.address, Addresses.NATIVE_TOKEN)) {
            expect(quote.tx.value).to.equal(quote.maxSellAmount);
          } else {
            const isValueNotSet = (value?: BigNumber) => !value || value.isZero();
            expect(isValueNotSet(quote.tx.value)).to.be.true;
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

        type Quote = Pick<SourceQuoteRequest<{ swapAndTransfer: boolean; buyOrders: true }>, 'order'> & {
          slippagePercentage?: number;
          recipient?: SignerWithAddress;
          sellToken: DefiLlamaToken;
          buyToken: DefiLlamaToken;
        };
        function buildQuote(source: QuoteSource<any, any, any>, { sellToken, buyToken, slippagePercentage, ...quote }: Quote) {
          return source.quote(
            { fetchService: FETCH_SERVICE },
            {
              ...quote,
              sellToken: sellToken.address,
              buyToken: buyToken.address,
              chain,
              config: {
                slippagePercentage: slippagePercentage ?? SLIPPAGE_PERCENTAGE,
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

        function shouldExecute(sourceId: string, test: Test) {
          return !EXCEPTIONS[sourceId as AvailableSources]?.includes(test);
        }
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
    });
  }
});
const FETCH_SERVICE = new FetchService(crossFetch);
const SLIPPAGE_PERCENTAGE = 1;
