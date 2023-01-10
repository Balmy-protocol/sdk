import { Network, Networks } from '@logic/networks';
import { network as hardhatNetwork } from 'hardhat';

export const fork = async (network: Network) => {  
  const params = [
    {
      forking: {        
        jsonRpcUrl: getUrl(network),
      },
    },
  ];
  await hardhatNetwork.provider.request({
    method: 'hardhat_reset',
    params,
  });
};

function getUrl(network: Network) {
  const path = getPath(network)
  const key = process.env.ALCHEMY_API_KEY
  if (!key) throw new Error('Alchemy key not set')
  return `https://${path}/${key}`
}

function getPath(network: Network) {
  switch (network.chainId) {
    case Networks.ETHEREUM.chainId:
      return "eth-mainnet.alchemyapi.io/v2";
    case Networks.POLYGON.chainId:
      return "polygon-mainnet.g.alchemy.com/v2";
    case Networks.ARBITRUM.chainId:
      return "arb-mainnet.g.alchemy.com/v2";
    case Networks.OPTIMISM.chainId:
      return "opt-mainnet.g.alchemy.com/v2";
    default:
      throw new Error(`Unsupported network ${network.chainId}`)
  }
}