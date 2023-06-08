import ms from 'ms';
import { expect } from 'chai';
import { given, then, when } from '@test-utils/bdd';
import { Chains } from '@chains';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { MulticallService } from '@services/multicall/multicall-service';
import { ProviderService } from '@services/providers/provider-service';
import { ERC20_ABI } from '@shared/abis/erc20';
import { CallResult, FailedCall, SuccessfulCall } from '@services/multicall/types';

jest.retryTimes(3);
jest.setTimeout(ms('30s'));

const PROVIDER_SERVICE = new ProviderService(new PublicRPCsSource());

describe('Multicall Service', () => {
  describe('tryReadOnlyMulticall', () => {
    tryReadOnlyMulticallTest();
  });

  describe('readOnlyMulticall', () => {
    readOnlyMulticallTest();
  });

  function readOnlyMulticallTest() {
    let response: ReadonlyArray<bigint>[];
    when(`trying a call`, () => {
      given(async () => {
        const calls = [{ address: DAI, abi: { humanReadable: ERC20_ABI }, functionName: 'allowance', args: [OWNER, OWNER] }];
        response = await new MulticallService(PROVIDER_SERVICE).readOnlyMulticall({ chainId: Chains.ETHEREUM.chainId, calls });
      });
      then('both are reported correctly', () => {
        expect(response).to.have.lengthOf(1);
        expect(response[0]).to.eql(0n);
      });
    });
  }

  function tryReadOnlyMulticallTest() {
    let response: CallResult[];
    when(`trying a call that fails with another that works`, () => {
      given(async () => {
        const calls = [
          { address: DAI, abi: { humanReadable: ERC20_ABI }, functionName: 'transferFrom', args: [OWNER, OWNER, 100000000000] },
          { address: DAI, abi: { humanReadable: ERC20_ABI }, functionName: 'allowance', args: [OWNER, OWNER] },
        ];
        response = await new MulticallService(PROVIDER_SERVICE).tryReadOnlyMulticall({ chainId: Chains.ETHEREUM.chainId, calls });
      });
      then('both are reported correctly', () => {
        expect(response).to.have.lengthOf(2);
        expect(response[0].status).to.equal('failure');
        expect(response[1].status).to.equal('success');
        expect((response[0] as FailedCall).error).to.not.be.empty;
        expect((response[1] as SuccessfulCall).result).to.equal(0n);
      });
    });
  }
});

const OWNER = '0x0000000000000000000000000000000000000001';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
