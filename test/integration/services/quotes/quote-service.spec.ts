import ms from 'ms';
import { ethers } from 'hardhat';
import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { given, then, when } from '@test-utils/bdd';
import { fork } from '@test-utils/evm';
import { TransactionResponse } from '@ethersproject/providers';
import { Chains } from '@chains';
import { TokenAddress, Address } from '@types';
import { QuoteResponse } from '@services/quotes/types';
import { DefiLlamaToken } from '@services/tokens/token-sources/defi-llama';
import {
  assertRecipientsBalanceIsIncreasedAsExpected,
  assertUsersBalanceIsReduceAsExpected,
  calculateBalancesFor,
  chainsWithTestData,
  loadTokens,
  mint,
} from '@test-utils/erc20';
import { buildSDK } from '@builder';

// Since trading tests can be a little bit flaky, we want to re-test before failing
jest.retryTimes(3);
jest.setTimeout(ms('5m'));

const { quoteService } = buildSDK();
const chains = chainsWithTestData(quoteService.supportedChains());

describe.skip('Quote Service', () => {
  for (const chainId of chains) {
    const chain = Chains.byKeyOrFail(chainId);
    describe(`${chain.name}`, () => {
      const ONE_NATIVE_TOKEN = utils.parseEther('1');
      let user: SignerWithAddress;
      let nativeToken: DefiLlamaToken, USDC: DefiLlamaToken;
      let initialBalances: Record<Address, Record<TokenAddress, BigNumber>>;
      let snapshot: SnapshotRestorer;

      beforeAll(async () => {
        await fork(chain);
        [user] = await ethers.getSigners();
        ({ nativeToken, USDC } = await loadTokens(chain));
        await mint({ amount: ONE_NATIVE_TOKEN.mul(3), of: nativeToken, to: user, on: chain });
        initialBalances = await calculateBalancesFor({
          tokens: [nativeToken, USDC],
          addresses: [user],
        });
        snapshot = await takeSnapshot();
      });

      afterEach(async () => {
        await snapshot.restore();
      });

      when('swapping 1 native token to USDC', () => {
        let quote: QuoteResponse;
        let txs: TransactionResponse[];
        given(async () => {
          [quote] = await quoteService.getAllQuotes({
            chainId,
            sellToken: nativeToken.address,
            buyToken: USDC.address,
            order: {
              type: 'sell',
              sellAmount: ONE_NATIVE_TOKEN,
            },
            slippagePercentage: 3,
            takerAddress: user.address,
          });
          const { gasPrice, maxFeePerGas, maxPriorityFeePerGas, ...tx } = quote.tx;
          txs = [await user.sendTransaction({ gasPrice, ...tx })];
        });
        then('result is as expected', async () => {
          await assertUsersBalanceIsReduceAsExpected({
            txs,
            sellToken: nativeToken,
            quote,
            user,
            initialBalances,
          });
          await assertRecipientsBalanceIsIncreasedAsExpected({
            txs,
            buyToken: USDC,
            quote,
            recipient: user,
            initialBalances,
          });
        });
      });
    });
  }
});
