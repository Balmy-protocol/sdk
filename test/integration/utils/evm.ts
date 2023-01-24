import { Chains } from '@chains';
import { Chain } from '@types';
import { network } from 'hardhat';

export const fork = async (chain: Chain) => {
  const params = [
    {
      forking: {
        jsonRpcUrl: getUrl(chain),
      },
    },
  ];
  await network.provider.request({
    method: 'hardhat_reset',
    params,
  });
};

function getUrl(chain: Chain) {
  const path = getPath(chain);
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error('Alchemy key not set');
  return `https://${path}/${key}`;
}

function getPath(chain: Chain) {
  switch (chain.chainId) {
    case Chains.ETHEREUM.chainId:
      return 'eth-mainnet.alchemyapi.io/v2';
    case Chains.POLYGON.chainId:
      return 'polygon-mainnet.g.alchemy.com/v2';
    case Chains.ARBITRUM.chainId:
      return 'arb-mainnet.g.alchemy.com/v2';
    case Chains.OPTIMISM.chainId:
      return 'opt-mainnet.g.alchemy.com/v2';
    default:
      return chain.publicRPCs?.[0];
  }
}
