// src/utils/merkle.ts
import { Buffer } from 'buffer';
import { keccak256 } from 'ethers';
import { MerkleTree } from 'merkletreejs';

export const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v.trim());

function hashBuf(data: Uint8Array): Buffer {
  const hex = keccak256(data);
  return Buffer.from(hex.slice(2), 'hex');
}

export function leafFor(addr: string): Buffer {
  const clean = addr.trim().toLowerCase();
  const hex = clean.startsWith('0x') ? clean.slice(2) : clean;
  const bytes = Buffer.from(hex, 'hex'); // 20 bytes
  return hashBuf(bytes);
}

export function makeMerkle(addresses: string[]) {
  const unique = Array.from(new Set(addresses.map(a => a.trim().toLowerCase()))).filter(isAddress);
  const leaves = unique.map(leafFor);
  const tree = new MerkleTree(leaves, hashBuf, { sortPairs: true });
  const root = tree.getHexRoot(); // 0x...

  // NEW: helpers
  const getProof = (addr: string) => tree.getHexProof(leafFor(addr));
  const verify = (addr: string, proof: string[], rootHex = root) =>
    tree.verify(proof, leafFor(addr), Buffer.from(rootHex.slice(2), 'hex'));

  return { root, tree, unique, getProof, verify };
}
