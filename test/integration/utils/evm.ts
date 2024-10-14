import { alchemySupportedChains, buildAlchemyRPCUrl } from '@services/providers';
import { Chain } from '@types';
import { network } from 'hardhat';

export const fork = async ({ chain, blockNumber }: { chain: Chain; blockNumber?: number }) => {
  const params = [
    {
      forking: {
        jsonRpcUrl: getUrl(chain),
        blockNumber,
      },
    },
  ];
  await network.provider.request({
    method: 'hardhat_reset',
    params,
  });
};

function getUrl(chain: Chain) {
  const apiKey = process.env.ALCHEMY_API_KEY;
  const paid = process.env.ALCHEMY_API_KEY_TYPE === 'paid';
  const alchemyChains = alchemySupportedChains({ onlyFree: !paid });
  if (apiKey && alchemyChains.includes(chain.chainId)) {
    return buildAlchemyRPCUrl({ apiKey, chainId: chain.chainId, protocol: 'https' });
  }
  return chain.publicRPCs[0];
}
