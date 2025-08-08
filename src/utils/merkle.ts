// src/utils/merkle.ts
import { Buffer } from 'buffer';
import { keccak256 } from 'ethers';
import { MerkleTree } from 'merkletreejs';

export const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v.trim());

/** keccak256 as a Buffer-returning function for merkletreejs */
function hashBuf(data: Uint8Array): Buffer {
  const hex = keccak256(data);            // "0x..." hex
  return Buffer.from(hex.slice(2), 'hex');
}

/** Leaf = keccak256(raw 20-byte address) like Solidity abi.encodePacked(address) */
export function leafFor(addr: string): Buffer {
  const clean = addr.trim().toLowerCase();
  const hex = clean.startsWith('0x') ? clean.slice(2) : clean;
  const bytes = Buffer.from(hex, 'hex');  // 20 bytes
  return hashBuf(bytes);                  // Buffer
}

export function makeMerkle(addresses: string[]) {
  const unique = Array.from(new Set(addresses.map(a => a.trim().toLowerCase()))).filter(isAddress);
  const leaves = unique.map(leafFor);                 // Buffer[]
  const tree = new MerkleTree(leaves, hashBuf, { sortPairs: true });
  const root = tree.getHexRoot();                     // "0x..." hex
  return { root, tree, unique };
}
