import ms from 'ms';
import { ethers } from 'hardhat';
import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { given, then, when } from '@test-utils/bdd';
import { fork } from '@test-utils/evm';
import { TransactionResponse } from '@ethersproject/providers';
import { Chains, getChainByKeyOrFail } from '@chains';
import { TokenAddress, Address } from '@types';
import { QuoteResponseWithTx } from '@services/permit2/types';
import {
  assertRecipientsBalanceIsIncreasedAsExpected,
  assertUsersBalanceIsReducedAsExpected,
  calculateBalancesFor,
  loadTokens,
  mint,
  TestToken,
} from '@test-utils/erc20';
import { buildSDK } from '@builder';
import { parseEther } from 'viem';
import { CONFIG } from '../quotes/quote-tests-config';

// Since trading tests can be a little bit flaky, we want to re-test before failing
jest.retryTimes(3);
jest.setTimeout(ms('5m'));

const {
  permit2Service: { quotes: permit2QuoteService },
} = buildSDK({ quotes: { defaultConfig: CONFIG, sourceList: { type: 'local' } } });

// This test validates quotes, but the SDK can't connect to the local test network. So we need to use addresses that have enough
// balance, because we can't simulate it on the real chain
const NATIVE_WHALES = {
  [Chains.POLYGON.chainId]: '0x06959153B974D0D5fDfd87D561db6d8d4FA0bb0B',
  [Chains.ETHEREUM.chainId]: '0x00000000219ab540356cbb839cbe05303d7705fa',
  [Chains.BNB_CHAIN.chainId]: '0xf977814e90da44bfa03b6295a0616a897441acec',
};
const chains = Object.keys(NATIVE_WHALES).map(Number);

describe('Permit2 Quote Service [External Quotes]', () => {
  for (const chainId of chains) {
    const chain = getChainByKeyOrFail(chainId);
    describe(`${chain.name}`, () => {
      const ONE_NATIVE_TOKEN = parseEther('1');
      let user: SignerWithAddress;
      let nativeToken: TestToken, STABLE_ERC20: TestToken, wToken: TestToken;
      let initialBalances: Record<Address, Record<TokenAddress, bigint>>;
      let snapshot: SnapshotRestorer;
      beforeAll(async () => {
        await fork({ chain });
        const whale = NATIVE_WHALES[chainId];
        if (!whale) throw new Error('Whale not set');
        user = await ethers.getImpersonatedSigner(whale);
        ({ nativeToken, STABLE_ERC20, wToken } = await loadTokens(chain));
        await mint({ amount: ONE_NATIVE_TOKEN * 3n, of: nativeToken, to: user });
        await mint({ amount: ONE_NATIVE_TOKEN * 3n, of: wToken, to: user });
        initialBalances = await calculateBalancesFor({
          tokens: [nativeToken, STABLE_ERC20, wToken],
          addresses: [user],
        });
        snapshot = await takeSnapshot();
      });
      afterEach(async () => {
        await snapshot.restore();
      });
      when('swapping 1 native token to stables', () => {
        let quote: QuoteResponseWithTx;
        let response: TransactionResponse;
        given(async () => {
          const estimatedQuotes = await permit2QuoteService.estimateAllQuotes({
            request: {
              chainId,
              sellToken: nativeToken.address,
              buyToken: STABLE_ERC20.address,
              order: {
                type: 'sell',
                sellAmount: ONE_NATIVE_TOKEN.toString(),
              },
              slippagePercentage: 5,
            },
            config: {
              timeout: '15s',
            },
          });
          const quotes = await permit2QuoteService.buildAndSimulateQuotes({
            chainId,
            quotes: estimatedQuotes,
            takerAddress: user.address,
            txValidFor: '1y',
            config: { sort: { by: 'most-swapped' } },
          });
          quote = quotes[0];
          const { gasPrice, maxFeePerGas, maxPriorityFeePerGas, ...tx } = quote.tx;
          response = await user.sendTransaction({ gasPrice, ...tx });
        });
        then('result is as expected', async () => {
          await assertUsersBalanceIsReducedAsExpected({
            txs: [response],
            sellToken: nativeToken,
            quote,
            tx: quote.tx,
            user,
            initialBalances,
          });
          await assertRecipientsBalanceIsIncreasedAsExpected({
            txs: [response],
            buyToken: STABLE_ERC20,
            quote,
            recipient: user,
            initialBalances,
          });
        });
      });
    });
  }
});
