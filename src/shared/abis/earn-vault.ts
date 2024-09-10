export default [
  {
    inputs: [
      { internalType: 'StrategyId', name: 'strategyId', type: 'uint96' },
      { internalType: 'address', name: 'depositToken', type: 'address' },
      { internalType: 'uint256', name: 'depositAmount', type: 'uint256' },
      { internalType: 'address', name: 'owner', type: 'address' },
      {
        components: [
          { internalType: 'address', name: 'operator', type: 'address' },
          { internalType: 'INFTPermissions.Permission[]', name: 'permissions', type: 'uint8[]' },
        ],
        internalType: 'struct INFTPermissions.PermissionSet[]',
        name: 'permissions',
        type: 'tuple[]',
      },
      { internalType: 'bytes', name: 'strategyValidationData', type: 'bytes' },
      { internalType: 'bytes', name: 'misc', type: 'bytes' },
    ],
    name: 'createPosition',
    outputs: [
      { internalType: 'uint256', name: 'positionId', type: 'uint256' },
      { internalType: 'uint256', name: 'assetsDeposited', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'positionId', type: 'uint256' },
      { internalType: 'address', name: 'depositToken', type: 'address' },
      { internalType: 'uint256', name: 'depositAmount', type: 'uint256' },
    ],
    name: 'increasePosition',
    outputs: [{ internalType: 'uint256', name: 'assetsDeposited', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'positionId', type: 'uint256' },
      { internalType: 'address[]', name: 'tokensToWithdraw', type: 'address[]' },
      { internalType: 'uint256[]', name: 'intendedWithdraw', type: 'uint256[]' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'withdraw',
    outputs: [
      { internalType: 'uint256[]', name: 'withdrawn', type: 'uint256[]' },
      { internalType: 'enum IEarnStrategy.WithdrawalType[]', name: 'withdrawalTypes', type: 'uint8[]' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  { stateMutability: 'payable', type: 'receive' },
  {
    inputs: [{ internalType: 'uint256', name: 'positionId', type: 'uint256' }],
    name: 'position',
    outputs: [
      { internalType: 'address[]', name: '', type: 'address[]' },
      { internalType: 'uint256[]', name: '', type: 'uint256[]' },
      { internalType: 'contract IEarnStrategy', name: '', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'positionId', type: 'uint256' }],
    name: 'positionsStrategy',
    outputs: [{ internalType: 'StrategyId', name: 'strategyId', type: 'uint96' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'nextNonce',
    outputs: [{ internalType: 'uint256', name: 'nextNonce', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
