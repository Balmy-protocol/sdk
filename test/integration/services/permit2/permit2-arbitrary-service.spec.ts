import ms from 'ms';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Chains } from '@chains';
import { IPermit2ArbitraryService } from '@services/permit2/types';
import { fork } from '@test-utils/evm';
import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TestToken, approve, balance, loadTokens, mint } from '@test-utils/erc20';
import { PERMIT2_ADDRESS } from '@services/permit2/utils/config';
import { Uint } from '@shared/constants';
import { parseUnits } from 'viem';
import { buildSDK } from '@builder';

jest.retryTimes(3).setTimeout(ms('2m'));

const APP_ID = '0x000000012345678910';
const CHAIN = Chains.OPTIMISM;
const VAULT_USDC = '0x81c9a7b55a4df39a9b7b5f781ec0e53539694873';
const VAULT_WETH = '0xc4d4500326981eacd020e20a81b1c479c161c7ef';
const AMOUNT_TO_DEPOSIT_USDC = parseUnits('500', 6);
const AMOUNT_TO_DEPOSIT_WETH = parseUnits('1', 18);
const ORIGINAL_AMOUNT_USDC = parseUnits('1000', 6);
const ORIGINAL_AMOUNT_ETH = parseUnits('20', 18);
const ORIGINAL_AMOUNT_WETH = parseUnits('20', 18);

describe('Permit2 Arbitrary Service', () => {
  let nativeToken: TestToken, STABLE_ERC20: TestToken, wToken: TestToken;
  let chainId: number;
  let arbitrary: IPermit2ArbitraryService;
  let user: SignerWithAddress;
  let snapshot: SnapshotRestorer;

  beforeAll(async () => {
    await fork({ chain: CHAIN, blockNumber: 107705868 });
    [user] = await ethers.getSigners();
    ({ nativeToken, STABLE_ERC20, wToken } = await loadTokens(CHAIN));
    await mint({ amount: ORIGINAL_AMOUNT_ETH, of: nativeToken, to: user });
    await mint({ amount: ORIGINAL_AMOUNT_WETH, of: wToken, to: user });
    await mint({ amount: ORIGINAL_AMOUNT_USDC, of: STABLE_ERC20, to: user });
    await approve({ amount: Uint.MAX_256, to: PERMIT2_ADDRESS, for: STABLE_ERC20, from: user });
    await approve({ amount: Uint.MAX_256, to: PERMIT2_ADDRESS, for: wToken, from: user });
    chainId = await ethers.provider.getNetwork().then(({ chainId }) => chainId);
    snapshot = await takeSnapshot();
    arbitrary = buildSDK().permit2Service.arbitrary;
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  it('buildArbitraryCallWithPermit', async () => {
    // Prepare data to sign
    const {
      dataToSign: { domain, types, message },
      permitData,
    } = await arbitrary.preparePermitData({
      appId: APP_ID,
      chainId: CHAIN.chainId,
      signerAddress: user.address,
      token: STABLE_ERC20.address,
      amount: AMOUNT_TO_DEPOSIT_USDC,
      signatureValidFor: '2y',
    });

    // We need to overwrite the chain id so that it matches the fork's id
    const newDomain = { ...domain, chainId };

    // Sign it
    const signature = await user._signTypedData(newDomain, types, message);

    // Build tx
    const tx = arbitrary.buildArbitraryCallWithPermit({
      // Set permit data
      permitData: { ...permitData, signature },

      // Provide allowance for vault
      allowanceTargets: [{ token: STABLE_ERC20.address, target: VAULT_USDC }],

      // Deposit into vault
      calls: [
        {
          address: VAULT_USDC,
          abi: { humanReadable: ERC4626_ABI },
          functionName: 'deposit',
          args: [AMOUNT_TO_DEPOSIT_USDC, arbitrary.contractAddress],
        },
      ],

      // Distribute vault token to user
      distribution: {
        [VAULT_USDC]: [{ recipient: user.address, shareBps: 10_000 }],
      },
    });

    // Send tx
    await user.sendTransaction(tx);

    // Assertions
    const usdcBalance = await balance({ of: user.address, for: STABLE_ERC20 });
    const vaultBalance = await balance({ of: VAULT_USDC, for: STABLE_ERC20 });
    expect(usdcBalance).to.equal(ORIGINAL_AMOUNT_USDC - AMOUNT_TO_DEPOSIT_USDC);
    expect(vaultBalance).to.be.gt(0);
  });

  it('buildArbitraryCallWithoutPermit', async () => {
    const VAULT = '0xc4d4500326981eacd020e20a81b1c479c161c7ef';

    // Build tx
    const tx = arbitrary.buildArbitraryCallWithoutPermit({
      // Provide allowance for vault
      allowanceTargets: [{ token: wToken.address, target: VAULT }],

      calls: [
        // Convert ETH to WETH
        {
          address: wToken.address,
          abi: { humanReadable: ['function deposit() payable'] },
          functionName: 'deposit',
          args: [],
          value: AMOUNT_TO_DEPOSIT_WETH,
        },

        // Deposit into vault
        {
          address: VAULT,
          abi: { humanReadable: ERC4626_ABI },
          functionName: 'deposit',
          args: [AMOUNT_TO_DEPOSIT_WETH, arbitrary.contractAddress],
        },
      ],

      // Distribute vault token to user
      distribution: {
        [VAULT]: [{ recipient: user.address, shareBps: 10_000 }],
      },

      // Set special config
      txValidFor: '2y',
    });

    // Send tx
    await user.sendTransaction(tx);

    // Assertions
    const nativeBalance = await balance({ of: user.address, for: STABLE_ERC20 });
    const vaultBalance = await balance({ of: VAULT_WETH, for: wToken });
    expect(nativeBalance).to.be.lte(ORIGINAL_AMOUNT_ETH - AMOUNT_TO_DEPOSIT_WETH);
    expect(vaultBalance).to.be.gt(0);
  });

  it('buildArbitraryCallWithBatchPermit', async () => {
    // Prepare data to sign
    const {
      dataToSign: { domain, types, message },
      permitData,
    } = await arbitrary.prepareBatchPermitData({
      appId: APP_ID,
      chainId: CHAIN.chainId,
      signerAddress: user.address,
      tokens: {
        [STABLE_ERC20.address]: AMOUNT_TO_DEPOSIT_USDC,
        [wToken.address]: AMOUNT_TO_DEPOSIT_WETH,
      },
      signatureValidFor: '2y',
    });

    // We need to overwrite the chain id so that it matches the fork's id
    const newDomain = { ...domain, chainId };

    // Sign it
    const signature = await user._signTypedData(newDomain, types, message);

    // Build tx
    const tx = arbitrary.buildArbitraryCallWithBatchPermit({
      // Set permit data
      permitData: { ...permitData, signature },

      // Provide allowance for vaults
      allowanceTargets: [
        { token: STABLE_ERC20.address, target: VAULT_USDC },
        { token: wToken.address, target: VAULT_WETH },
      ],

      calls: [
        // Deposit into USDC vault
        {
          address: VAULT_USDC,
          abi: { humanReadable: ERC4626_ABI },
          functionName: 'deposit',
          args: [AMOUNT_TO_DEPOSIT_USDC, arbitrary.contractAddress],
        },

        // Deposit into WETH vault
        {
          address: VAULT_WETH,
          abi: { humanReadable: ERC4626_ABI },
          functionName: 'deposit',
          args: [AMOUNT_TO_DEPOSIT_WETH, arbitrary.contractAddress],
        },
      ],

      // Distribute vault token to user
      distribution: {
        [VAULT_USDC]: [{ recipient: user.address, shareBps: 10_000 }],
        [VAULT_WETH]: [{ recipient: user.address, shareBps: 10_000 }],
      },
    });

    // Send tx
    await user.sendTransaction(tx);

    // Assertions
    const usdcBalance = await balance({ of: user.address, for: STABLE_ERC20 });
    const wTokenBalance = await balance({ of: user.address, for: wToken });
    const usdcVaultBalance = await balance({ of: VAULT_USDC, for: STABLE_ERC20 });
    const wethVaultBalance = await balance({ of: VAULT_WETH, for: wToken });
    expect(usdcBalance).to.equal(ORIGINAL_AMOUNT_USDC - AMOUNT_TO_DEPOSIT_USDC);
    expect(wTokenBalance).to.equal(ORIGINAL_AMOUNT_WETH - AMOUNT_TO_DEPOSIT_WETH);
    expect(usdcVaultBalance).to.be.gt(0);
    expect(wethVaultBalance).to.be.gt(0);
  });
});

export const ERC4626_ABI = ['function deposit(uint256 assets, address receiver) returns (uint256 shares)'];
