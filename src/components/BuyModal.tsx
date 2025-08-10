// src/components/BuyModal.tsx
import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { formatUnits, parseUnits, type Hex } from 'viem';
import {
  QUOTE_DECIMALS,
  QUOTE_TOKEN,
  erc20Abi,
  presalePoolAbi,
} from '../lib/contracts';
import { supabase } from '../lib/supabase';
import { makeMerkle, isAddress } from '../utils/merkle';

type Props = {
  open: boolean;
  onClose: () => void;
  poolAddress: `0x${string}`;
  saleId: string;
  allowlistRoot?: Hex | null;
};

export default function BuyModal({
  open,
  onClose,
  poolAddress,
  saleId,
  allowlistRoot,
}: Props) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const [balance, setBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);

  const [minBuy, setMinBuy] = useState<bigint | null>(null);
  const [maxBuy, setMaxBuy] = useState<bigint | null>(null);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [onchainRoot, setOnchainRoot] = useState<Hex | null>(null);
  const [alreadyContributed, setAlreadyContributed] = useState<bigint>(0n);

  // Load balances/limits + pool flags when opened
  useEffect(() => {
    if (!open || !address) return;
    (async () => {
      try {
        const [
          bal,
          allw,
          minB,
          maxB,
          pub,
          contribByUser,
        ] = await Promise.all([
          publicClient!.readContract({
            address: QUOTE_TOKEN, abi: erc20Abi,
            functionName: 'balanceOf', args: [address],
          }),
          publicClient!.readContract({
            address: QUOTE_TOKEN, abi: erc20Abi,
            functionName: 'allowance', args: [address, poolAddress],
          }),
          publicClient!.readContract({
            address: poolAddress, abi: presalePoolAbi,
            functionName: 'minBuy',
          }),
          publicClient!.readContract({
            address: poolAddress, abi: presalePoolAbi,
            functionName: 'maxBuy',
          }),
          publicClient!.readContract({
            address: poolAddress, abi: presalePoolAbi,
            functionName: 'isPublic',
          }),
          publicClient!.readContract({
            address: poolAddress, abi: presalePoolAbi,
            functionName: 'contributed', args: [address],
          }),
        ]);

        // Read merkleRoot separately to keep typing clean
        const root = await publicClient!.readContract({
          address: poolAddress, abi: presalePoolAbi, functionName: 'merkleRoot',
        });

        setBalance(bal as bigint);
        setAllowance(allw as bigint);
        setMinBuy(minB as bigint);
        setMaxBuy(maxB as bigint);
        setIsPublic(pub as boolean);
        setAlreadyContributed(contribByUser as bigint);
        setOnchainRoot(root as `0x${string}`);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || String(e));
      }
    })();
  }, [open, address, poolAddress, publicClient]);

  const amountWei = useMemo(() => {
    try { return parseUnits((amount || '0').trim(), QUOTE_DECIMALS); }
    catch { return 0n; }
  }, [amount]);

  const remainingAllowed = useMemo(() => {
    if (!maxBuy || maxBuy === 0n) return null; // no max
    const rem = maxBuy - alreadyContributed;
    return rem > 0n ? rem : 0n;
  }, [maxBuy, alreadyContributed]);

  const withinMinMax = useMemo(() => {
    if (minBuy && amountWei < minBuy) return false;
    if (remainingAllowed !== null && amountWei > remainingAllowed) return false;
    return true;
  }, [amountWei, minBuy, remainingAllowed]);

  async function getProof(): Promise<Hex[]> {
    // Public sale → empty proof
    if (isPublic || !address) return [];

    // Load the allowlist snapshot we stored
    const { data, error } = await supabase
      .from('allowlists')
      .select('address')
      .eq('sale_id', saleId);
    if (error) throw error;

    // Mirror utils/merkle.ts normalization exactly
    const addrs = Array.from(
      new Set((data || []).map(r => String(r.address).trim().toLowerCase()))
    ).filter(isAddress);

    const { root, getProof } = makeMerkle(addrs);

    // Verify against on-chain root first (source of truth), else DB root
    const expectedRoot = onchainRoot ?? allowlistRoot ?? null;
    if (expectedRoot && root.toLowerCase() !== expectedRoot.toLowerCase()) {
      throw new Error(
        `Allowlist is stale: computed root ${root} != on-chain root ${expectedRoot}. Please refresh the allowlist.`
      );
    }

    const proof = getProof(address); // string[]
    if (!proof.length) throw new Error('Your wallet is not on the allowlist.');
    return proof as unknown as Hex[];
  }

  async function onConfirm() {
    try {
      setError('');
      setSubmitting(true);
      if (!address) throw new Error('Connect your wallet');
      if (amountWei <= 0n) throw new Error('Enter an amount > 0');
      if (amountWei > balance) throw new Error('Insufficient WAPE');
      if (!withinMinMax) {
        if (minBuy && amountWei < minBuy) throw new Error('Below minimum contribution.');
        if (remainingAllowed !== null && amountWei > remainingAllowed)
          throw new Error('Exceeds your per-wallet max for this sale.');
      }

      // Approve if needed
      if (allowance < amountWei) {
        const approveHash = await writeContractAsync({
          address: QUOTE_TOKEN,
          abi: erc20Abi,
          functionName: 'approve',
          args: [poolAddress, amountWei],
        });
        await publicClient!.waitForTransactionReceipt({ hash: approveHash });
        setAllowance(amountWei);
      }

      // Contribute(amount, proof)
      const proof = await getProof(); // [] if public
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: presalePoolAbi,
        functionName: 'contribute',
        args: [amountWei, proof],
      });
      await publicClient!.waitForTransactionReceipt({ hash });

      onClose();
      setAmount('');
      alert('Contribution submitted!');
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="buy-overlay"
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'grid', placeItems:'center', zIndex:1000 }}
      onClick={onClose}
    >
      <div
        className="buy-modal card"
        style={{ width:'min(440px,94vw)', padding:18, borderRadius:16, border:'1px solid var(--card-border)', background:'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontWeight:800, fontSize:18, color:'var(--fl-purple)' }}>Contribute</div>
          <button className="button" onClick={onClose} style={{ padding:'6px 10px' }}>✕</button>
        </div>

        <div style={{ fontSize:13, opacity:.8, marginBottom:12 }}>
          Balance: <b>{formatUnits(balance, QUOTE_DECIMALS)} WAPE</b>
        </div>

        <label style={{ display:'grid', gap:6 }}>
          <span style={{ fontWeight:700 }}>Amount (WAPE)</span>
          <input
            type="number" min="0" step="0.0001" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0.0"
            style={{ padding:'10px 12px', borderRadius:12, border:'1px solid var(--card-border)', background:'var(--table-row)', color:'var(--text)' }}
          />
        </label>

        {(minBuy || maxBuy) && (
          <div style={{ marginTop:8, fontSize:12, opacity:.8 }}>
            {minBuy ? <>Min: <b>{formatUnits(minBuy, QUOTE_DECIMALS)}</b>&nbsp;</> : null}
            {maxBuy && maxBuy > 0n ? <>Max: <b>{formatUnits(maxBuy, QUOTE_DECIMALS)}</b></> : null}
          </div>
        )}

        {maxBuy && maxBuy > 0n ? (
          <div style={{ marginTop:4, fontSize:12, opacity:.8 }}>
            You’ve contributed: <b>{formatUnits(alreadyContributed, QUOTE_DECIMALS)} WAPE</b>
            {remainingAllowed !== null ? <> • Remaining: <b>{formatUnits(remainingAllowed, QUOTE_DECIMALS)} WAPE</b></> : null}
          </div>
        ) : null}

        {error && <div style={{ marginTop:10, color:'var(--fl-danger)', fontSize:13 }}>{error}</div>}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
          <button className="button button-secondary" disabled={submitting || !withinMinMax} onClick={onConfirm}>
            {submitting ? 'Submitting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
