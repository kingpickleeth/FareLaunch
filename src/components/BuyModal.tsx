import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import {
  formatUnits, parseUnits, keccak256, encodePacked, type Hex, getAddress
} from 'viem';
import { QUOTE_DECIMALS, QUOTE_TOKEN, erc20Abi, presalePoolAbi } from '../lib/contracts';
import { supabase } from '../lib/supabase';

type Props = {
  open: boolean;
  onClose: () => void;
  poolAddress: `0x${string}`;
  saleId: string;
  allowlistRoot?: Hex | null; // pass row.allowlist_root
};

function leafFor(addr: string): Hex {
  // keccak256(abi.encodePacked(address)) – address is checksummed by getAddress
  return keccak256(encodePacked(['address'], [getAddress(addr)]));
}
function buildSortedLayer(nodes: Hex[]): Hex[] {
  const next: Hex[] = [];
  for (let i = 0; i < nodes.length; i += 2) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (!b) { next.push(a); continue; }
    next.push(a.toLowerCase() < b.toLowerCase()
      ? keccak256(encodePacked(['bytes32','bytes32'], [a, b]))
      : keccak256(encodePacked(['bytes32','bytes32'], [b, a]))
    );
  }
  return next;
}
function buildProofForAddress(addresses: string[], target: string): { proof: Hex[]; root: Hex } {
  // unique + checksum
  const list = Array.from(new Set(addresses.map(a => getAddress(a))));
  let layer: Hex[] = list.map(leafFor).sort();
  const targetLeaf = leafFor(target);
  let idx = layer.indexOf(targetLeaf);
  if (idx === -1) return { proof: [], root: '0x'.padEnd(66, '0') as Hex };

  const proof: Hex[] = [];
  let current = layer.slice();
  while (current.length > 1) {
    const isRight = idx % 2 === 1;
    const pairIdx = isRight ? idx - 1 : idx + 1;
    if (pairIdx < current.length) proof.push(current[pairIdx]);
    current = buildSortedLayer(current);
    idx = Math.floor(idx / 2);
  }
  return { proof, root: current[0] };
}

export default function BuyModal({
  open, onClose, poolAddress, saleId, allowlistRoot
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

  useEffect(() => {
    if (!open || !address) return;
    (async () => {
      try {
        const [bal, allw, minB, maxB, pub] = await Promise.all([
          publicClient!.readContract({ address: QUOTE_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
          publicClient!.readContract({ address: QUOTE_TOKEN, abi: erc20Abi, functionName: 'allowance', args: [address, poolAddress] }) as Promise<bigint>,
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'minBuy' }) as Promise<bigint>,
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'maxBuy' }) as Promise<bigint>,
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'isPublic' }) as Promise<boolean>,
        ]);
        setBalance(bal);
        setAllowance(allw);
        setMinBuy(minB);
        setMaxBuy(maxB);
        setIsPublic(pub);
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

  const withinMinMax = useMemo(() => {
    if (minBuy && amountWei < minBuy) return false;
    if (maxBuy && maxBuy > 0n && amountWei > maxBuy) return false;
    return true;
  }, [amountWei, minBuy, maxBuy]);

  async function getProof(): Promise<Hex[]> {
    if (isPublic || !address) return [];
    // fetch allowlist rows for this sale
    const { data, error } = await supabase
      .from('allowlists')
      .select('address')
      .eq('sale_id', saleId);
    if (error) throw error;
    const addrs = (data || []).map(r => String(r.address).toLowerCase().trim());

    // Build proof locally and verify root matches the DB (defensive)
    const { proof, root } = buildProofForAddress(addrs, address);
    if (allowlistRoot && root.toLowerCase() !== allowlistRoot.toLowerCase()) {
      // If your StepReview computed the root differently, we’ll surface a clear error
      throw new Error('Allowlist Merkle root mismatch; please refresh allowlist.');
    }
    if (!proof.length) throw new Error('Your wallet is not on the allowlist.');
    return proof;
  }

  async function onConfirm() {
    try {
      setError('');
      setSubmitting(true);
      if (!address) throw new Error('Connect your wallet');
      if (amountWei <= 0n) throw new Error('Enter an amount > 0');
      if (amountWei > balance) throw new Error('Insufficient WAPE');
      if (!withinMinMax) throw new Error('Amount is outside min/max limits');

      // 1) Approve if needed
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

      // 2) Contribute(amount, proof)
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
