import type { Sale } from '../types'

export const sales: Sale[] = [
  {
    id: '1', kind:'presale', name:'Banakoa Tools', creator:'0x1234...abcd',
    softCap: 100, hardCap: 300, raised: 72, price: 0.002, start: Date.now()/1000 - 3600,
    end: Date.now()/1000 + 3600*24, phase:'active', allowlist:true, lpLockDays:90
  },
  {
    id: '2', kind:'fair', name:'Jungle Vines', creator:'0x9a9a...beef',
    softCap: 50, raised: 12, start: Date.now()/1000 + 3600*4,
    end: Date.now()/1000 + 3600*30, phase:'upcoming', lpLockDays:180
  },
  {
    id: '3', kind:'presale', name:'Ape Relays', creator:'0x7777...7777',
    softCap: 80, hardCap: 200, raised: 210, price: 0.0015, start: Date.now()/1000 - 3600*30,
    end: Date.now()/1000 - 3600, phase:'ended', allowlist:false, lpLockDays:365
  }
]
