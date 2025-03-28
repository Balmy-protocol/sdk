import ms from 'ms';
import { expect } from 'chai';
import { RPCMetadataProperties, RPCMetadataSource } from '@services/metadata/metadata-sources/rpc-metadata-source';
import { PublicRPCsProviderSource } from '@services/providers/provider-sources/public-rpcs-provider';
import { Addresses } from '@shared/constants';
import { ChainId, FieldsRequirements, TokenAddress } from '@types';
import { MetadataResult } from '@services/metadata/types';
import { given, then, when } from '@test-utils/bdd';
import { ProviderService } from '@services/providers/provider-service';

const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';

const PROVIDER_SERVICE = new ProviderService({ source: new PublicRPCsProviderSource() });
const RPC_METADATA_SOURCE = new RPCMetadataSource(PROVIDER_SERVICE);

jest.retryTimes(2);
jest.setTimeout(ms('1m'));

describe('RPC Metadata Source', () => {
  rpcTest({
    when: 'not specifying anything',
    expected: ['decimals', 'symbol', 'name'],
  });
  rpcTest({
    when: 'marking properties as required',
    requirements: { requirements: { decimals: 'required', symbol: 'required', name: 'required' } },
    expected: ['decimals', 'symbol', 'name'],
  });
  rpcTest({
    when: 'marking properties as best effort',
    requirements: { requirements: { decimals: 'best effort', symbol: 'best effort', name: 'best effort' } },
    expected: ['decimals', 'symbol', 'name'],
  });
  rpcTest({
    when: 'marking properties as can ignore',
    requirements: { requirements: { decimals: 'best effort', symbol: 'can ignore' }, default: 'can ignore' },
    expected: ['decimals'],
  });

  function rpcTest<Requirements extends FieldsRequirements<RPCMetadataProperties>>({
    when: title,
    requirements,
    expected,
  }: {
    when: string;
    requirements?: Requirements;
    expected: (keyof RPCMetadataProperties)[];
  }) {
    describe(title, () => {
      describe('getMetadata', () => {
        when(title, () => {
          let result: Record<ChainId, Record<TokenAddress, MetadataResult<RPCMetadataProperties, Requirements>>>;
          given(async () => {
            result = await RPC_METADATA_SOURCE.getMetadata({
              tokens: [
                { chainId: 1, token: DAI },
                { chainId: 1, token: Addresses.NATIVE_TOKEN },
              ],
              config: { fields: requirements, timeout: '30s' },
            });
          });
          then(`the returned fields are '${expected.join(', ')}'`, () => {
            expect(Object.keys(result)).to.have.lengthOf(1);
            expect(Object.keys(result[1])).to.have.lengthOf(2);
            expect(result[1][DAI]).to.have.all.keys(expected);
            expect(result[1][Addresses.NATIVE_TOKEN]).to.have.all.keys(expected);
          });
        });
      });
    });
  }
});
