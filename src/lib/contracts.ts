// src/lib/contracts.ts
import type { Abi } from 'viem';

export const LAUNCHPAD_FACTORY = '0x1261196CBF1F24DB47263F912FBEFB26077D352B'; // TODO
export const QUOTE_DECIMALS = 18;                 // TODO: WAPE decimals (likely 18)
export const QUOTE_TOKEN = '0x48b62137EdfA95a428D35C09E44256a739F6B557' as `0x${string}`;

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

export const erc20Abi = [
    { type:'function', name:'allowance', stateMutability:'view',
      inputs:[{name:'owner',type:'address'},{name:'spender',type:'address'}],
      outputs:[{type:'uint256'}] },
    { type:'function', name:'approve', stateMutability:'nonpayable',
      inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}],
      outputs:[{type:'bool'}] },
    { type:'function', name:'balanceOf', stateMutability:'view',
      inputs:[{name:'account',type:'address'}], outputs:[{type:'uint256'}] },
    { type:'function', name:'decimals', stateMutability:'view', inputs:[], outputs:[{type:'uint8'}] },
  ] as const satisfies Abi;
  
// src/lib/contracts.ts
export const presalePoolAbi = [
    { type:'function', name:'contribute', stateMutability:'nonpayable',
      inputs:[{name:'amount',type:'uint256'},{name:'proof',type:'bytes32[]'}], outputs:[] },
    { type:'function', name:'isPublic', stateMutability:'view', inputs:[], outputs:[{type:'bool'}] },
    { type:'function', name:'isActive', stateMutability:'view', inputs:[], outputs:[{type:'bool'}] },
    { type:'function', name:'minBuy', stateMutability:'view', inputs:[], outputs:[{type:'uint256'}] },
    { type:'function', name:'maxBuy', stateMutability:'view', inputs:[], outputs:[{type:'uint256'}] },
    { type:'function', name:'startAt', stateMutability:'view', inputs:[], outputs:[{type:'uint64'}] },
    { type:'function', name:'endAt', stateMutability:'view', inputs:[], outputs:[{type:'uint64'}] },
    { type:'function', name:'contributed', stateMutability:'view',
      inputs:[{name:'',type:'address'}], outputs:[{type:'uint256'}] },
    // ⬇️ add this
    { type:'function', name:'merkleRoot', stateMutability:'view', inputs:[], outputs:[{type:'bytes32'}] },
  ] as const satisfies Abi;
  