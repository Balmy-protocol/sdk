export default [
  {
    inputs: [
      { internalType: 'uint256', name: 'positionId', type: 'uint256' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'withdrawableFunds',
    outputs: [{ internalType: 'uint256', name: 'funds', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'positionId', type: 'uint256' },
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'withdraw',
    outputs: [
      { internalType: 'uint256', name: 'withdrawn', type: 'uint256' },
      { internalType: 'uint256', name: 'stillPending', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
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
