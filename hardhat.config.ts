import { HardhatUserConfig } from 'hardhat/types';
import '@nomiclabs/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import 'tsconfig-paths/register';

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
};

export default config;
