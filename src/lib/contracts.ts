// src/lib/contracts.ts
import type { Abi } from 'viem';

export const LAUNCHPAD_FACTORY =
  '0x1261196CBF1F24DB47263F912FBEFB26077D352B' as `0x${string}`;

export const QUOTE_DECIMALS = 18; // WAPE likely 18
export const QUOTE_TOKEN =
  '0x48b62137EdfA95a428D35C09E44256a739F6B557' as `0x${string}`;

/** LaunchpadFactory ABI (updated CreateArgs) */
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
          { name: 'startAt', type: 'uint64' },
          { name: 'endAt', type: 'uint64' },
          { name: 'softCap', type: 'uint256' },
          { name: 'hardCap', type: 'uint256' },
          { name: 'minBuy', type: 'uint256' },
          { name: 'maxBuy', type: 'uint256' },
          { name: 'isPublic', type: 'bool' },
          { name: 'merkleRoot', type: 'bytes32' },
          { name: 'presaleRate', type: 'uint256' },
          { name: 'listingRate', type: 'uint256' },
          { name: 'lpPctBps', type: 'uint16' },
          { name: 'payoutDelay', type: 'uint64' },
          { name: 'lpLockDuration', type: 'uint64' },
          { name: 'raiseFeeBps', type: 'uint16' },
          { name: 'tokenFeeBps', type: 'uint16' },
          { name: 'saleTokensPool', type: 'uint256' },
          { name: 'totalSupply', type: 'uint256' },
          { name: 'tokenPctToLPBps', type: 'uint16' },
          { name: 'tokenName', type: 'string' },
          { name: 'tokenSymbol', type: 'string' },
          { name: 'tokenDecimals', type: 'uint8' }
        ]
      },
      { name: 'salt', type: 'bytes32' }
    ],
    outputs: [{ name: 'pool', type: 'address' }]
  },
  
  // defaults / views
  {
    type: 'function',
    name: 'defaultLpPctBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'defaultPayoutDelay',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'defaultLpLock',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'defaultRaiseFeeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'defaultTokenFeeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'quoteToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },

  // events
  {
    type: 'event',
    name: 'PoolCreated',
    inputs: [
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'pool', type: 'address' },
      { indexed: true, name: 'salt', type: 'bytes32' },
    ],
  },
] as const satisfies Abi;

/** Minimal ERC20 ABI used in app */
export const erc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const satisfies Abi;

/** PresalePool ABI (matches your latest contract) */
export const presalePoolAbi = [
  // core actions
  { 
    type: 'function',
    name: 'quoteToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'contribute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'finalize',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'distribute',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'maxRecipients', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawCreator',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'markFailed',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },

  // views used by UI
  { type: 'function', name: 'isPublic', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'isActive', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'ended', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },

  { type: 'function', name: 'minBuy', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maxBuy', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'startAt', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },
  { type: 'function', name: 'endAt', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },

  { type: 'function', name: 'softCap', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'hardCap', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalRaised', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },

  {
    type: 'function',
    name: 'contributed',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },

  { type: 'function', name: 'merkleRoot', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },

  // static tokenomics config
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'saleTokensPool', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tokenPctToLPBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'lpPctBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },

  // fees & timings
  { type: 'function', name: 'platformFeeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'tokenFeeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'lpLockDuration', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },
  { type: 'function', name: 'payoutDelay', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },

  // state flags & addresses
  { type: 'function', name: 'finalized', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'failed', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'token', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'creatorPayoutAt', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },

  // derived “final” rates (post-finalize; 1e18 scale)
  { type: 'function', name: 'presaleRateFinal', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'listingRateFinal', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },

  // helpers
  {
    type: 'function',
    name: 'claimable',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const satisfies Abi;
