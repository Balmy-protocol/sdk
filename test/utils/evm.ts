import { Chain } from '@types';
import { network } from 'hardhat';

export const fork = async (chain: Chain) => {
  const params = [
    {
      forking: {
        jsonRpcUrl: chain.publicRPCs?.[0],
      },
    },
  ];
  await network.provider.request({
    method: 'hardhat_reset',
    params,
  });
};
