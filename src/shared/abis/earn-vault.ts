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
] as const;
