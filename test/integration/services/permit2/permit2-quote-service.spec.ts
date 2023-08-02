import ms from 'ms';
import { ethers } from 'hardhat';
import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { given, then, when } from '@test-utils/bdd';
import { fork } from '@test-utils/evm';
import { TransactionResponse } from '@ethersproject/providers';
import { Chains, getChainByKeyOrFail } from '@chains';
import { TokenAddress, Address } from '@types';
import { QuoteResponse } from '@services/quotes/types';
import {
  assertRecipientsBalanceIsIncreasedAsExpected,
  assertUsersBalanceIsReducedAsExpected,
  calculateBalancesFor,
  chainsWithTestData,
  loadTokens,
  mint,
  TestToken,
} from '@test-utils/erc20';
import { buildSDK } from '@builder';
import { parseEther } from 'viem';

// Since trading tests can be a little bit flaky, we want to re-test before failing
jest.retryTimes(3);
jest.setTimeout(ms('5m'));

const {
  permit2Service: { quotes: permit2QuoteService },
} = buildSDK();
// const chains = chainsWithTestData(permit2QuoteService.supportedChains()); // TODO: Enable when we deploy the adapter to more chains
const chains = [Chains.POLYGON.chainId];

describe('Permit2 Quote Service', () => {
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
        [user] = await ethers.getSigners();
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
        let quote: QuoteResponse;
        let txs: TransactionResponse[];
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
          const quotes = await permit2QuoteService.verifyAndPrepareQuotes({
            chainId,
            quotes: estimatedQuotes,
            takerAddress: user.address,
            txValidFor: '1y',
            config: { sort: { by: 'most-swapped' } },
          });
          quote = quotes[0];
          const { gasPrice, maxFeePerGas, maxPriorityFeePerGas, ...tx } = quote.tx;
          txs = [await user.sendTransaction({ gasPrice, ...tx })];
        });
        then('result is as expected', async () => {
          await assertUsersBalanceIsReducedAsExpected({
            txs,
            sellToken: nativeToken,
            quote,
            user,
            initialBalances,
          });
          await assertRecipientsBalanceIsIncreasedAsExpected({
            txs,
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
