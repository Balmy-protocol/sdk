import { Network } from '@types';
import { network as hardhatNetwork } from 'hardhat';

export const fork = async (network: Network) => {  
  const params = [
    {
      forking: {        
        jsonRpcUrl: network.publicRPCs?.[0],
      },
    },
  ];
  await hardhatNetwork.provider.request({
    method: 'hardhat_reset',
    params,
  });
};
