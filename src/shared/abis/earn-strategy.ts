export default [
  { inputs: [], name: 'asset', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ internalType: 'address', name: 'depositToken', type: 'address' }],
    name: 'isDepositTokenSupported',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'positionId', type: 'uint256' },
      { internalType: 'SpecialWithdrawalCode', name: 'withdrawalCode', type: 'uint256' },
      { internalType: 'uint256[]', name: 'toWithdraw', type: 'uint256[]' },
      { internalType: 'bytes', name: 'withdrawalData', type: 'bytes' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'specialWithdraw',
    outputs: [
      { internalType: 'uint256[]', name: 'balanceChanges', type: 'uint256[]' },
      { internalType: 'address[]', name: 'actualWithdrawnTokens', type: 'address[]' },
      { internalType: 'uint256[]', name: 'actualWithdrawnAmounts', type: 'uint256[]' },
      { internalType: 'bytes', name: 'result', type: 'bytes' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
