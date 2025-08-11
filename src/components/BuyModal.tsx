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
import { makeMerkle} from '../utils/merkle';

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
  const [, setIsPublic] = useState<boolean>(true);
  const [, setOnchainRoot] = useState<Hex | null>(null);
  const [alreadyContributed, setAlreadyContributed] = useState<bigint>(0n);
  const [hardCap, setHardCap] = useState<bigint>(0n);
  const [totalRaised, setTotalRaised] = useState<bigint>(0n);
  const [activeFlag, setActiveFlag] = useState<boolean>(true);
  const [quoteTokenAddr, setQuoteTokenAddr] = useState<`0x${string}`>(QUOTE_TOKEN);
const [quoteDecimals, setQuoteDecimals] = useState<number>(QUOTE_DECIMALS);

  // Load balances/limits + pool flags when opened
  useEffect(() => {
    if (!open || !address) return;
    (async () => {
      try {
        // 1) Read the pool’s actual quote token
        const qt = await publicClient!.readContract({
          address: poolAddress,
          abi: presalePoolAbi,
          functionName: 'quoteToken',
        }) as `0x${string}`;
    
        setQuoteTokenAddr(qt);
    
        // 2) Read decimals from that token (fallback to constant if it throws)
        let qd = QUOTE_DECIMALS;
        try {
          const d = await publicClient!.readContract({
            address: qt, abi: erc20Abi, functionName: 'decimals'
          });
          qd = Number(d);
        } catch {}
        setQuoteDecimals(qd);
    
        // 3) Now read everything that depends on the token/pool
        const [
          bal, allw, minB, maxB, pub, contribByUser, hc, tr, active
        ] = await Promise.all([
          publicClient!.readContract({ address: qt, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
          publicClient!.readContract({ address: qt, abi: erc20Abi, functionName: 'allowance', args: [address, poolAddress] }),
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'minBuy' }),
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'maxBuy' }),
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'isPublic' }),
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'contributed', args: [address] }),
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'hardCap' }),
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'totalRaised' }),
          publicClient!.readContract({ address: poolAddress, abi: presalePoolAbi, functionName: 'isActive' }),
        ]);
    
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
        setHardCap(hc as bigint);
        setTotalRaised(tr as bigint);
        setActiveFlag(active as boolean);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || String(e));
      }
    })();
    
  }, [open, address, poolAddress, publicClient]);

  const amountWei = useMemo(() => {
    try { return parseUnits((amount || '0').trim(), quoteDecimals); }
    catch { return 0n; }
  }, [amount, quoteDecimals]);
  
  // replace every formatUnits(..., QUOTE_DECIMALS) with quoteDecimals
  
  const remainingAllowed = useMemo(() => {
    if (!maxBuy || maxBuy === 0n) return null; // no max
    const rem = maxBuy - alreadyContributed;
    return rem > 0n ? rem : 0n;
  }, [maxBuy, alreadyContributed]);
// How much more you MUST add to reach minBuy, considering what you already contributed.
const requiredMinForThisTx = useMemo(() => {
  if (!minBuy) return 0n;
  if (alreadyContributed >= minBuy) return 0n;
  return minBuy - alreadyContributed;
}, [minBuy, alreadyContributed]);

// Remaining headroom from per-wallet MAX (if any)
const remainingPerWallet = useMemo(() => {
  if (!maxBuy || maxBuy === 0n) return null; // no max
  const rem = maxBuy - alreadyContributed;
  return rem > 0n ? rem : 0n;
}, [maxBuy, alreadyContributed]);

// Remaining room before HARD CAP is hit
const remainingToHardCap = useMemo(() => {
  if (hardCap === 0n) return null; // defensive
  const rem = hardCap - totalRaised;
  return rem > 0n ? rem : 0n;
}, [hardCap, totalRaised]);

// Your true effective max = min(remainingPerWallet, remainingToHardCap) ignoring nulls
const effectiveMax = useMemo(() => {
  const cands = [remainingPerWallet ?? undefined, remainingToHardCap ?? undefined].filter(
    (x): x is bigint => typeof x === 'bigint'
  );
  if (!cands.length) return null;
  return cands.reduce((m, v) => (v < m ? v : m));
}, [remainingPerWallet, remainingToHardCap]);

// Validate input against the CUMULATIVE min and both caps
const withinMinMax = useMemo(() => {
  if (amountWei <= 0n) return false;
  if (amountWei < requiredMinForThisTx) return false;
  if (effectiveMax !== null && amountWei > effectiveMax) return false;
  return true;
}, [amountWei, requiredMinForThisTx, effectiveMax]);
async function getProofForWallet(saleId: string, walletAddress: string) {
  // Normalize address
  const cleanAddr = walletAddress.trim().toLowerCase();

  // 1) Fetch allowlist addresses from Supabase
  const { data, error } = await supabase
    .from('allowlists')
    .select('address')
    .eq('sale_id', saleId);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  if (!data?.length) throw new Error('No allowlist found for this sale ID');

  // 2) Normalize and dedupe addresses
  const addresses = Array.from(
    new Set(data.map(r => String(r.address).trim().toLowerCase()))
  );

  // 3) Build Merkle tree
  const { root, getProof, verify } = makeMerkle(addresses);

  console.log('🪵 Computed Root:', root);
  console.log('🪵 My Address:', cleanAddr);

  // 4) Get proof for this wallet
  const proof = getProof(cleanAddr);
  console.log('🪵 Generated Proof:', proof);

  // 5) Verify locally before sending to chain
  const isValid = verify(cleanAddr, proof);
  console.log('🪵 Local Verify Result:', isValid);

  if (!isValid) {
    throw new Error('Your wallet is not on the allowlist.');
  }

  return proof as readonly `0x${string}`[];
}
  async function onConfirm() {
    try {
      setError('');
      setSubmitting(true);
      if (!address) throw new Error('Connect your wallet');
      if (!activeFlag) throw new Error('Sale is not active right now.');
      if (amountWei <= 0n) throw new Error('Enter an amount > 0');
      if (amountWei > balance) throw new Error('Insufficient WAPE');
      
      // Explain exactly WHY the input fails
      if (amountWei < requiredMinForThisTx) {
        throw new Error(
          `Minimum for this transaction is ${formatUnits(requiredMinForThisTx, QUOTE_DECIMALS)} WAPE ` +
          `(your total must reach at least ${formatUnits(minBuy ?? 0n, QUOTE_DECIMALS)} WAPE).`
        );
      }
      if (effectiveMax !== null && amountWei > effectiveMax) {
        const parts: string[] = [];
        if (remainingPerWallet !== null) parts.push(`per-wallet remaining ${formatUnits(remainingPerWallet, QUOTE_DECIMALS)}`);
        if (remainingToHardCap !== null) parts.push(`hard-cap remaining ${formatUnits(remainingToHardCap, QUOTE_DECIMALS)}`);
        throw new Error(`Amount exceeds ${parts.join(' and ')}.`);
      }
      
      // Approve if needed
      if (allowance < amountWei) {
        const approveHash = await writeContractAsync({
          address: quoteTokenAddr,          // <— dynamic
          abi: erc20Abi,
          functionName: 'approve',
          args: [poolAddress, amountWei],
        });
        await publicClient!.waitForTransactionReceipt({ hash: approveHash });
        setAllowance(amountWei);
      }
      

      // Contribute(amount, proof)
      const proof = await getProofForWallet(saleId, address);
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
