export default [
  {
    type: 'function',
    name: 'withdrawableFunds',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'funds',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'withdrawn',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'stillPending',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
] as const;
