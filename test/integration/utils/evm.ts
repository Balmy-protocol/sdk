import { Chains } from '@chains';
import { Chain } from '@types';
import { network } from 'hardhat';

export const fork = async (chain: Chain) => {
  console.log(getUrl(chain));
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
  // if (chain.chainId === Chains.FANTOM.chainId) return 'https://ftm.rpcgator.com/';
  const key = getKey(chain);
  const path = getPath(chain);
  if (!path && !key) `https://${path}/${key}`;
  return chain.publicRPCs?.[0];
}

function getKey(chain: Chain): string {
  switch (chain.chainId) {
    case Chains.ETHEREUM.chainId:
    case Chains.POLYGON.chainId:
    case Chains.ARBITRUM.chainId:
    case Chains.OPTIMISM.chainId:
      const key = process.env.ALCHEMY_API_KEY;
      if (!key) throw new Error('Alchemy key not set');
      return key;
    // case Chains.BNB_CHAIN.chainId:
    //   return '';
    // case Chains.AVALANCHE.chainId:
    //   return '';
    // case Chains.FANTOM.chainId:
    //   return '';
    // case Chains.CELO.chainId:
    //   return '';
    // case Chains.GNOSIS.chainId:
    //   return '';
    // case Chains.KLAYTN.chainId:
    //   return '';
    // case Chains.AURORA.chainId:
    //   return '';
    default:
      return '';
  }
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
    // case Chains.BNB_CHAIN.chainId:
    //   return '';
    // case Chains.AVALANCHE.chainId:
    //   return '';
    // case Chains.FANTOM.chainId:
    //   return '';
    // case Chains.CELO.chainId:
    //   return '';
    // case Chains.GNOSIS.chainId:
    //   return '';
    // case Chains.KLAYTN.chainId:
    //   return '';
    // case Chains.AURORA.chainId:
    //   return '';
    default:
      return '';
  }
}
