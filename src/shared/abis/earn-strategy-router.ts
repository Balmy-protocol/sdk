export default [
  {
    inputs: [
      { internalType: 'contract IEarnVault', name: 'vault', type: 'address' },
      { internalType: 'uint256', name: 'positionId', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'routeByPositionId',
    outputs: [{ internalType: 'bytes', name: 'result', type: 'bytes' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'contract IEarnStrategyRegistry', name: 'registry', type: 'address' },
      { internalType: 'StrategyId', name: 'strategyId', type: 'uint96' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'routeByStrategyId',
    outputs: [{ internalType: 'bytes', name: 'result', type: 'bytes' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
