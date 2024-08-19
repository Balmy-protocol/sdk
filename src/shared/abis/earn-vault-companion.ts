export default [
  {
    inputs: [
      { internalType: 'contract IEarnVault', name: 'vault', type: 'address' },
      { internalType: 'StrategyId', name: 'strategyId', type: 'uint96' },
      { internalType: 'address', name: 'depositToken', type: 'address' },
      { internalType: 'uint256', name: 'depositAmount', type: 'uint256' },
      { internalType: 'address', name: 'owner_', type: 'address' },
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
      { internalType: 'bool', name: 'maxApprove', type: 'bool' },
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
      { internalType: 'address', name: 'allowanceToken', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
      { internalType: 'bytes', name: 'swapData', type: 'bytes' },
    ],
    name: 'runSwap',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    stateMutability: 'payable',
    type: 'function',
  },

  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bytes', name: 'signature', type: 'bytes' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'permitTakeFromCaller',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'contract IERC20', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'takeFromCaller',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes[]', name: 'data', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ internalType: 'bytes[]', name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
