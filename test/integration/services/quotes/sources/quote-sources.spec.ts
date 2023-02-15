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
import { calculatePercentage, isSameAddress } from '@shared/utils';
import { Chain, TokenAddress, Address, ChainId } from '@types';
import { QuoteSource, QuoteSourceSupport, SourceQuoteRequest, SourceQuoteResponse } from '@services/quotes/quote-sources/base';
import { DefiLlamaToken } from '@services/tokens/token-sources/defi-llama';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean-gas-price-source';
import { FetchService } from '@services/fetch/fetch-service';
import { GasPrice } from '@services/gas/types';
import { Test, EXCEPTIONS, CONFIG } from '../quote-tests-config';
import {
  approve,
  assertRecipientsBalanceIsIncreasedAsExpected,
  assertUsersBalanceIsReduceAsExpected,
  calculateBalancesFor,
  chainsWithTestData,
  loadTokens,
  mintMany,
} from '@test-utils/erc20';
import { buildSources } from '@services/quotes/source-registry';
import { SourceId } from '@services/quotes/types';
import { buildSDK } from '@builder';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { GasService } from '@services/gas/gas-service';
import { RPCGasPriceSource } from '@services/gas/gas-price-sources/rpc-gas-price-source';

// This is meant to be used for local testing. On the CI, we will do something different
const RUN_FOR: { source: string; chains: Chain[] | 'all' } = {
  source: 'sovryn',
  chains: [Chains.ROOTSTOCK],
};
const ROUNDING_ISSUES: SourceId[] = [];

// Since trading tests can be a little bit flaky, we want to re-test before failing
jest.retryTimes(3);
jest.setTimeout(ms('5m'));

describe('Quote Sources', () => {
  const sourcesPerChain = getSources();
  for (const chainId of Object.keys(sourcesPerChain)) {
    const chain = getChainByKeyOrFail(chainId);
    describe(`${chain.name}`, () => {
      const ONE_NATIVE_TOKEN = utils.parseEther('1');
      let user: SignerWithAddress, recipient: SignerWithAddress;
      let nativeToken: DefiLlamaToken, wToken: DefiLlamaToken, USDC: DefiLlamaToken, RANDOM_ERC20: DefiLlamaToken;
      let initialBalances: Record<Address, Record<TokenAddress, BigNumber>>;
      let snapshot: SnapshotRestorer;
      let gasPricePromise: Promise<GasPrice>;

      beforeAll(async () => {
        await fork(chain);
        [user, recipient] = await ethers.getSigners();
        ({ nativeToken, wToken, USDC, RANDOM_ERC20 } = await loadTokens(chain));
        await mintMany({
          chain,
          to: user,
          tokens: [
            { amount: utils.parseUnits('10000', 6), token: USDC },
            { amount: ONE_NATIVE_TOKEN.mul(3), token: nativeToken },
            { amount: ONE_NATIVE_TOKEN, token: wToken },
          ],
        });
        initialBalances = await calculateBalancesFor({
          tokens: [nativeToken, wToken, USDC, RANDOM_ERC20],
          addresses: [user, recipient],
        });
        gasPricePromise = new OpenOceanGasPriceSource(FETCH_SERVICE).getGasPrice(chain).then((gasPrice) => gasPrice['standard']);
        snapshot = await takeSnapshot();
      });

      afterEach(async () => {
        await snapshot.restore();
      });

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
          test: Test.SELL_NATIVE_TO_RANDOM_ERC20,
          when: 'swapping 1 native token to random token',
          quote: () => ({
            sellToken: nativeToken,
            buyToken: RANDOM_ERC20,
            order: {
              type: 'sell',
              sellAmount: ONE_NATIVE_TOKEN,
            },
          }),
        });
      });
      describe('Swap and transfer', () => {
        quoteTest({
          test: Test.SELL_NATIVE_TO_USDC_AND_TRANSFER,
          checkSupport: (support) => support.swapAndTransfer,
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
      });
      describe('Buy order', () => {
        quoteTest({
          test: Test.BUY_NATIVE_WITH_USDC,
          checkSupport: (support) => support.buyOrders,
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
      });
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

      function quoteTest({
        test,
        when: title,
        quote: quoteFtn,
        checkSupport,
      }: {
        test: Test;
        when: string;
        checkSupport?: (support: QuoteSourceSupport) => boolean;
        quote: () => Quote;
      }) {
        when(title, () => {
          for (const [sourceId, source] of Object.entries(sourcesPerChain[chain.chainId])) {
            if (shouldExecute(sourceId, test) && (!checkSupport || checkSupport(source.getMetadata().supports))) {
              describe(`on ${source.getMetadata().name}`, () => {
                let quote: SourceQuoteResponse;
                let txs: TransactionResponse[];
                given(async () => {
                  quote = await buildQuote(source, quoteFtn());
                  const approveTx = isSameAddress(quote.allowanceTarget, constants.AddressZero)
                    ? []
                    : [await approve({ amount: quote.maxSellAmount, to: quote.allowanceTarget, for: quoteFtn().sellToken, from: user })];
                  txs = [...approveTx, await execute({ quote, as: user })];
                });
                then('result is as expected', async () => {
                  await assertUsersBalanceIsReduceAsExpected({
                    txs,
                    sellToken: quoteFtn().sellToken,
                    quote,
                    user,
                    initialBalances,
                  });
                  await assertRecipientsBalanceIsIncreasedAsExpected({
                    txs,
                    buyToken: quoteFtn().buyToken,
                    quote,
                    recipient: quoteFtn().recipient ?? user,
                    initialBalances,
                  });
                  assertQuoteIsConsistent(quote, {
                    sellToken: quoteFtn().sellToken,
                    buyToken: quoteFtn().buyToken,
                    ...quoteFtn().order,
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
          sellToken: DefiLlamaToken;
          buyToken: DefiLlamaToken;
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
          const allowedSlippage = calculatePercentage(quote.buyAmount, slippage);
          expect(quote.minBuyAmount).to.be.gte(quote.buyAmount.sub(allowedSlippage));
        } else {
          const allowedSlippage = calculatePercentage(quote.sellAmount, slippage);
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
        const lowerThreshold = expected.sub(threshold);
        expect(toAmount).to.be.gte(lowerThreshold);
      }

      type Quote = Pick<SourceQuoteRequest<{ swapAndTransfer: boolean; buyOrders: true }>, 'order'> & {
        recipient?: SignerWithAddress;
        sellToken: DefiLlamaToken;
        buyToken: DefiLlamaToken;
      };
      function buildQuote(source: QuoteSource<any>, { sellToken, buyToken, ...quote }: Quote) {
        return source.quote(
          { providerSource: PROVIDER_SOURCE, gasService: GAS_SERVICE, fetchService: FETCH_SERVICE },
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
  }
});

function getSources() {
  const sources = buildSources(CONFIG);
  const result: Record<ChainId, Record<string, QuoteSource<QuoteSourceSupport>>> = {};

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
const GAS_SERVICE = buildSDK().gasService;
const FETCH_SERVICE = new FetchService(crossFetch);
const SLIPPAGE_PERCENTAGE = 5; // We set a high slippage so that the tests don't fail as much
