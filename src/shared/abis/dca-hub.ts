export default [
  {
    inputs: [],
    name: 'AmountTooBig',
    type: 'error',
  },
  {
    inputs: [],
    name: 'HighFee',
    type: 'error',
  },
  {
    inputs: [],
    name: 'HighPlatformFeeRatio',
    type: 'error',
  },
  {
    inputs: [],
    name: 'IntervalNotAllowed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidAllowedTokensInput',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidFee',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidInterval',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidMask',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPairs',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPosition',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidToken',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidTokens',
    type: 'error',
  },
  {
    inputs: [],
    name: 'LiquidityNotReturned',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NoSwapsToExecute',
    type: 'error',
  },
  {
    inputs: [],
    name: 'PositionDoesNotMatchToken',
    type: 'error',
  },
  {
    inputs: [],
    name: 'UnallowedToken',
    type: 'error',
  },
  {
    inputs: [],
    name: 'UnauthorizedCaller',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ZeroAddress',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ZeroAmount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ZeroSwaps',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        internalType: 'uint32',
        name: '_amountOfSwaps',
        type: 'uint32',
      },
      {
        internalType: 'uint32',
        name: '_swapInterval',
        type: 'uint32',
      },
      {
        internalType: 'address',
        name: '_owner',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            internalType: 'enum IDCAPermissionManager.Permission[]',
            name: 'permissions',
            type: 'uint8[]',
          },
        ],
        internalType: 'struct IDCAPermissionManager.PermissionSet[]',
        name: '_permissions',
        type: 'tuple[]',
      },
    ],
    name: 'deposit',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        internalType: 'uint32',
        name: '_amountOfSwaps',
        type: 'uint32',
      },
      {
        internalType: 'uint32',
        name: '_swapInterval',
        type: 'uint32',
      },
      {
        internalType: 'address',
        name: '_owner',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            internalType: 'enum IDCAPermissionManager.Permission[]',
            name: 'permissions',
            type: 'uint8[]',
          },
        ],
        internalType: 'struct IDCAPermissionManager.PermissionSet[]',
        name: '_permissions',
        type: 'tuple[]',
      },
      {
        internalType: 'bytes',
        name: '_miscellaneous',
        type: 'bytes',
      },
    ],
    name: 'deposit',
    outputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        internalType: 'uint32',
        name: '_newAmountOfSwaps',
        type: 'uint32',
      },
    ],
    name: 'increasePosition',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        internalType: 'uint32',
        name: '_newAmountOfSwaps',
        type: 'uint32',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
    ],
    name: 'reducePosition',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_recipientUnswapped',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_recipientSwapped',
        type: 'address',
      },
    ],
    name: 'terminate',
    outputs: [
      {
        internalType: 'uint256',
        name: '_unswapped',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_swapped',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
    ],
    name: 'userPosition',
    outputs: [
      {
        components: [
          {
            internalType: 'contract IERC20Metadata',
            name: 'from',
            type: 'address',
          },
          {
            internalType: 'contract IERC20Metadata',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'uint32',
            name: 'swapInterval',
            type: 'uint32',
          },
          {
            internalType: 'uint32',
            name: 'swapsExecuted',
            type: 'uint32',
          },
          {
            internalType: 'uint256',
            name: 'swapped',
            type: 'uint256',
          },
          {
            internalType: 'uint32',
            name: 'swapsLeft',
            type: 'uint32',
          },
          {
            internalType: 'uint256',
            name: 'remaining',
            type: 'uint256',
          },
          {
            internalType: 'uint120',
            name: 'rate',
            type: 'uint120',
          },
        ],
        internalType: 'struct IDCAHubPositionHandler.UserPosition',
        name: '_userPosition',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
    ],
    name: 'withdrawSwapped',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'token',
            type: 'address',
          },
          {
            internalType: 'uint256[]',
            name: 'positionIds',
            type: 'uint256[]',
          },
        ],
        internalType: 'struct IDCAHubPositionHandler.PositionSet[]',
        name: '_positions',
        type: 'tuple[]',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
    ],
    name: 'withdrawSwappedMany',
    outputs: [
      {
        internalType: 'uint256[]',
        name: '_swapped',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
