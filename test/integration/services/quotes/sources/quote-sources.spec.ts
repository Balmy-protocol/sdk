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
import { isSameAddress } from '@shared/utils';
import { Chain, TokenAddress, Address, ChainId } from '@types';
import { AvailableSources } from '@services/quotes/types';
import { QuoteSource, QuoteSourceSupport, SourceQuoteRequest, SourceQuoteResponse } from '@services/quotes/quote-sources/base';
import { DefiLlamaToken, DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { buildSources } from '@services/quotes/sources-list';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean';
import { FetchService } from '@services/fetch/fetch-service';
import { GasPrice } from '@services/gas/types';
import { Test, TOKENS, EXCEPTIONS, CONFIG } from './quote-tests-config';

// It's very time expensive to test all sources for all chains, so we need to choose
// Note: as part of the CI workflow, these values will be ignored and randomized
const RUN_FOR: { source: AvailableSources; chain: Chain } = {
  source: '1inch',
  chain: Chains.ETHEREUM,
};

// Since trading tests can be a little bit flaky, we want to re-test before failing
jest.retryTimes(3);
jest.setTimeout(ms('5m'));

describe('Quote Sources', () => {
  const sourcesPerChain = getSources();
  for (const chainId of Object.keys(sourcesPerChain)) {
    const chain = Chains.byKeyOrFail(chainId);
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
            if (shouldExecute(sourceId as AvailableSources, test) && (!checkSupport || checkSupport(source.getMetadata().supports))) {
              describe(`on ${source.getMetadata().name}`, () => {
                let quote: SourceQuoteResponse;
                let txs: TransactionResponse[];
                given(async () => {
                  quote = await buildQuote(source, quoteFtn());
                  const approveTx =
                    isSameAddress(quoteFtn().sellToken.address, Addresses.NATIVE_TOKEN) && !isSameAddress(quote.tx.to, constants.AddressZero)
                      ? []
                      : [await approve({ amount: quote.maxSellAmount, to: quote.allowanceTarget, for: USDC })];
                  txs = [...approveTx, await execute({ quote, as: user })];
                });
                then('result is as expected', async () => {
                  await assertUsersBalanceIsReduceAsExpected(txs, quoteFtn().sellToken, quote);
                  await assertRecipientsBalanceIsIncreasedAsExpected(txs, quoteFtn().buyToken, quote, quoteFtn().recipient ?? user);
                });
              });
            }
          }
        });
      }

      async function assertUsersBalanceIsReduceAsExpected(txs: TransactionResponse[], sellToken: DefiLlamaToken, quote: SourceQuoteResponse) {
        const initialBalance = initialBalances[user.address][sellToken.address];
        const bal = await balance({ of: user.address, for: sellToken });
        if (isSameAddress(sellToken.address, Addresses.NATIVE_TOKEN)) {
          const gasSpent = await calculateGasSpent(txs);
          expect(bal).to.equal(initialBalance.sub(gasSpent).sub(quote.tx.value ?? 0));
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
  }
});

function getSources() {
  const sources = buildSources(CONFIG, CONFIG);
  const result: Record<ChainId, Record<AvailableSources, QuoteSource<QuoteSourceSupport, any, any>>> = {};
  for (const [sourceId, source] of Object.entries(sources)) {
    const chains = source.getMetadata().supports.chains;
    for (const chain of chains) {
      if (!(chain.chainId in result)) {
        result[chain.chainId] = {} as any;
      }
      result[chain.chainId][sourceId as AvailableSources] = source;
    }
  }
  for (const chainId in result) {
    if (!(chainId in TOKENS)) {
      delete result[chainId];
    }
  }
  return result;
}

const FETCH_SERVICE = new FetchService(crossFetch);
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint)',
  'function transfer(address to, uint amount)',
  'function approve(address to, uint amount)',
];
const SLIPPAGE_PERCENTAGE = 5; // We set a high slippage so that the tests don't fail as much
