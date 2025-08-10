// src/lib/contracts.ts
import type { Abi } from 'viem';

export const LAUNCHPAD_FACTORY = '0x1261196CBF1F24DB47263F912FBEFB26077D352B'; // TODO
export const QUOTE_DECIMALS = 18;                 // TODO: WAPE decimals (likely 18)

export const launchpadFactoryAbi = [
  {
    type: 'function',
    name: 'createPresale',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'a',
        type: 'tuple',
        components: [
          { name: 'startAt',         type: 'uint64'  },
          { name: 'endAt',           type: 'uint64'  },
          { name: 'softCap',         type: 'uint256' },
          { name: 'hardCap',         type: 'uint256' },
          { name: 'minBuy',          type: 'uint256' },
          { name: 'maxBuy',          type: 'uint256' },
          { name: 'isPublic',        type: 'bool'    },
          { name: 'merkleRoot',      type: 'bytes32' },
          { name: 'presaleRate',     type: 'uint256' },
          { name: 'listingRate',     type: 'uint256' },
          { name: 'lpPctBps',        type: 'uint16'  },
          { name: 'payoutDelay',     type: 'uint64'  },
          { name: 'lpLockDuration',  type: 'uint64'  },
          { name: 'raiseFeeBps',     type: 'uint16'  },
          { name: 'tokenFeeBps',     type: 'uint16'  },
        ],
      },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },

  // Optional reads we might use later
  { type: 'function', name: 'defaultLpPctBps',    stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'defaultPayoutDelay', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },
  { type: 'function', name: 'defaultLpLock',      stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },
  { type: 'function', name: 'defaultRaiseFeeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'defaultTokenFeeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'quoteToken',         stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },

  {
    type: 'event',
    name: 'PoolCreated',
    inputs: [
      { indexed: true,  name: 'creator', type: 'address' },
      { indexed: false, name: 'pool',    type: 'address' },
      { indexed: true,  name: 'salt',    type: 'bytes32' },
    ],
  },
] as const satisfies Abi;
