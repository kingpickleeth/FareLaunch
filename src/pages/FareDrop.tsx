import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useWriteContract,
  useSendTransaction,
} from "wagmi";
import { isAddress, parseUnits, formatUnits } from "viem";

// Minimal ERC20 ABI for transfer & reads
const MIN_ERC20_ABI = [
  { type: "function", stateMutability: "view", name: "decimals", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", stateMutability: "view", name: "symbol",   inputs: [], outputs: [{ type: "string" }] },
  { type: "function", stateMutability: "view", name: "name",     inputs: [], outputs: [{ type: "string" }] },
  { type: "function", stateMutability: "view", name: "balanceOf",inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", stateMutability: "nonpayable", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

type Entry = { address: string; amount: string; validAddr?: boolean; validAmt?: boolean };
type TokenMeta = {
  mode: "native" | "erc20";
  address: "native" | `0x${string}`;
  symbol: string;
  name?: string;
  decimals: number;
  balance: bigint; // raw units
};

export default function FareDrop() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync, isPending: erc20Pending } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const tokenKey = (t: TokenMeta) => `${t.mode}:${t.address}`;
  const ModeButton = ({
    active, onClick, children,
  }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: active ? "2px solid var(--fl-gold)" : "1px solid var(--border)",
        background: active ? "rgba(255,184,46,.10)" : "transparent",
        color: "var(--text)",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
  // STEP 1: token discovery + selection
  const [detected, setDetected] = useState<TokenMeta[]>([]);
  const [loadingDetect, setLoadingDetect] = useState(false);
  const [detectErr, setDetectErr] = useState<string>("");
  const [selected, setSelected] = useState<TokenMeta | null>(null);

  // STEP 2: recipients input
  const [inputMode, setInputMode] = useState<"line" | "paste" | "csv" | null>(null);
  const [entries, setEntries] = useState<Entry[]>([{ address: "", amount: "" }]);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState("");

  // ---------------------------
  // helpers
  // ---------------------------
 
  const pretty = (n: bigint, decimals: number) => {
    try { return formatUnits(n, decimals); } catch { return "0"; }
  };
  const toCleanNumberText = (s: string) => s.replace(/,/g, "").trim();
  const withCommas = (s: string) => {
    const [whole, frac] = s.split(".");
    const w = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return frac ? `${w}.${frac}` : w;
  };

  // live validation
  const validatedEntries = useMemo(
    () =>
      entries.map((e) => ({
        ...e,
        validAddr: isAddress(e.address),
        validAmt: !!e.amount && Number(toCleanNumberText(e.amount)) > 0,
      })),
    [entries]
  );
  const anyInvalidAddr = validatedEntries.some((e) => e.address && !e.validAddr);
  const anyInvalidAmt = validatedEntries.some((e) => e.amount && !e.validAmt);
  const filteredValid = validatedEntries.filter((e) => e.validAddr && e.validAmt);

  const totalAmountHuman = filteredValid.reduce(
    (acc, e) => acc + Number(toCleanNumberText(e.amount) || "0"),
    0
  );
  const totalAmountWei = useMemo(() => {
    if (!selected) return 0n;
    try {
      return parseUnits(String(totalAmountHuman), selected.decimals);
    } catch {
      return 0n;
    }
  }, [totalAmountHuman, selected]);

  // ---------------------------
  // Fetch ALL tokens via backend proxy to Sim by Dune Balances API
  // GET /api/sim/balances?address=0x...&chain_ids=33139
  // ---------------------------
  useEffect(() => {
    (async () => {
      setDetected([]);
      setDetectErr("");
      if (!isConnected || !address) return;
  
      setLoadingDetect(true);
      try {
        const res = await fetch(`/api/sim/balances?address=${address}&chain_ids=33139`);
        const ct = res.headers.get('content-type') || '';
        const rawText = await res.text();
  
        if (!ct.includes('application/json')) {
          // Surface what we actually got (helps if routing is off and we got TS source or HTML)
          throw new Error(`non-JSON from /api/sim/balances: ${rawText.slice(0, 140)}`);
        }
        const data = JSON.parse(rawText);
  
        type SimBalance = {
          chain: string;
          chain_id: number;
          address: string | "native" | null;
          amount: string;
          symbol?: string;
          name?: string;
          decimals?: number;
        };
  
        const raw: SimBalance[] = Array.isArray(data?.balances) ? (data.balances as SimBalance[]) : [];
  
        const items: TokenMeta[] = raw
          .filter((b: SimBalance) => b?.amount && b.decimals !== undefined)
          .map((b: SimBalance): TokenMeta => {
            const amtRaw = BigInt(b.amount);
            const isNative = b.address === "native" || b.address === null;
            return {
              mode: isNative ? "native" : "erc20",
              address: isNative ? "native" : (b.address as `0x${string}`),
              symbol: b.symbol || (isNative ? "APE" : "TOKEN"),
              name: b.name || (isNative ? "ApeChain" : undefined),
              decimals: typeof b.decimals === "number" ? b.decimals : 18,
              balance: amtRaw,
            };
          })
          .filter((t: TokenMeta) => t.balance > 0n)
          .sort((a: TokenMeta, b: TokenMeta) => {
            if (a.mode !== b.mode) return a.mode === "native" ? -1 : 1;
            return Number(b.balance - a.balance);
          });
  
        setDetected(items);
        // Optional: auto-select native first or the first item
        if (!selected && items.length) {
          const native = items.find(i => i.mode === 'native');
          setSelected(native ?? items[0]);
        }
      } catch (e: any) {
        console.error(e);
        setDetectErr(e?.message || "Failed to fetch wallet tokens.");
      } finally {
        setLoadingDetect(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);
  
  

  // ---------------------------
  // editing helpers
  // ---------------------------
  function setEntry(i: number, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function onAmountChange(i: number, value: string) {
    const clean = value.replace(/[^\d.]/g, "");
    if ((clean.match(/\./g) || []).length > 1) return;
    const [w, f = ""] = clean.split(".");
    const formatted = withCommas(w) + (f ? `.${f}` : "");
    setEntry(i, { amount: formatted });
  }
  function addRow() {
    setEntries((prev) => [...prev, { address: "", amount: "" }]);
  }
  function parseLines(lines: string[]): Entry[] {
    const out: Entry[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/[, \t]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const [addr, amt] = parts;
        out.push({ address: addr, amount: withCommas(toCleanNumberText(amt)) });
      } else if (parts.length === 1) {
        out.push({ address: parts[0], amount: "" });
      }
    }
    return out.length ? out : [{ address: "", amount: "" }];
  }
  function handlePasteApply() {
    const lines = pasteText.split(/\r?\n/);
    setEntries(parseLines(lines));
  }
  async function handleCSV(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const rows = lines.map((l) => l.split(",").map((s) => s.trim()));
    const parsed: Entry[] = rows.map((cols) => ({
      address: cols[0] || "",
      amount: withCommas(toCleanNumberText(cols[1] || "")),
    }));
    setEntries(parsed.length ? parsed : [{ address: "", amount: "" }]);
  }

  // ---------------------------
  // submit (v1: one tx per row)
  // ---------------------------
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!isConnected || !walletClient || !publicClient || !address || !selected) {
      setStatus("Connect your wallet and select a token.");
      return;
    }
    const rows = validatedEntries.filter((r) => r.validAddr && r.validAmt);
    if (!rows.length) {
      setStatus("Add at least one valid recipient.");
      return;
    }

    try {
      // Balance check refresh
      if (selected.mode === "native") {
        const bal = await publicClient.getBalance({ address });
        if (bal < totalAmountWei) {
          setStatus("Insufficient APE balance for total airdrop.");
          return;
        }
      } else {
        const bal = await publicClient.readContract({
          address: selected.address as `0x${string}`,
          abi: MIN_ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }) as bigint;
        if (bal < totalAmountWei) {
          setStatus(`Insufficient ${selected.symbol} balance for total airdrop.`);
          return;
        }
      }

      // Send transfers sequentially (simple v1)
      for (const row of rows) {
        const to = row.address as `0x${string}`;
        const amt = parseUnits(toCleanNumberText(row.amount), selected.decimals);
        if (selected.mode === "native") {
          await sendTransactionAsync({ to, value: amt });
        } else {
          await writeContractAsync({
            address: selected.address as `0x${string}`,
            abi: MIN_ERC20_ABI,
            functionName: "transfer",
            args: [to, amt],
          });
        }
      }

      setStatus(`Success! Sent ${rows.length} transfer${rows.length > 1 ? "s" : ""}.`);
    } catch (err: any) {
      setStatus(err?.shortMessage || err?.message || "Airdrop failed.");
    }
  }

  // ---------------------------
  // CTA label / disabled
  // ---------------------------
  const canProceedStep2 =
    !!inputMode && filteredValid.length > 0 && !anyInvalidAddr && !anyInvalidAmt && totalAmountWei > 0n;

  const buttonLabel = (() => {
    if (!isConnected) return "Connect wallet to continue";
    if (!selected) return loadingDetect ? "Detecting tokens…" : "Select a token";
    if (!inputMode) return "Choose recipient input method";
    if (validatedEntries.length === 0) return "Add at least one recipient";
    if (anyInvalidAddr) return "Fix invalid addresses";
    if (anyInvalidAmt) return "Fix invalid amounts";
    if (totalAmountWei === 0n) return "Enter total > 0";
    return "Send Airdrop";
  })();


  // ---------------------------
  // UI (theme-matched)
  // ---------------------------
  return (
    <div className="tool-container" style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 className="tool-title">FareDrop — Airdrop Tool</h1>

{/* STEP 1: token picker */}
<div
  className="card"
  style={{
    background: "var(--fl-surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow)",
    padding: 16,
    display: "grid",
    gap: 12,
    marginBottom: 16,
  }}
>
  <div style={{ fontWeight: 800, color: "var(--fl-gold)" }}>1) Select a token from your wallet</div>

  {detectErr && <div style={{ color: "var(--fl-danger)" }}>{detectErr}</div>}
  {loadingDetect && <div style={{ opacity: .8 }}>Detecting balances…</div>}

  {/* Minimal dropdown: only show symbol · name in the popup */}
  <select
    value={selected ? tokenKey(selected) : ""}
    onChange={(e) => {
      const val = e.target.value;
      setSelected(detected.find(t => tokenKey(t) === val) ?? null);
    }}
    disabled={!detected.length}
    style={{
      appearance: "none",
      width: "100%",
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid var(--border)",
      background: "var(--fl-bg)",
      color: "var(--text)",
      fontWeight: 700,
      outline: "none",
      cursor: detected.length ? "pointer" : "not-allowed",
      backgroundImage:
        "linear-gradient(45deg, transparent 50%, var(--text) 50%), linear-gradient(135deg, var(--text) 50%, transparent 50%)",
      backgroundPosition: "calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px)",
      backgroundSize: "6px 6px, 6px 6px",
      backgroundRepeat: "no-repeat",
    }}
  >
    {!selected && <option value="">— Select a token —</option>}
    {detected.map((t) => (
      <option key={tokenKey(t)} value={tokenKey(t)}>
        {t.symbol}{t.name ? ` · ${t.name}` : ""}
      </option>
    ))}
  </select>

  {/* Clean details row below */}
  {selected && (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: 12,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--fl-bg)",
      }}
    >
      <div style={{ fontWeight: 800, color: "var(--text)" }}>
        {selected.symbol} {selected.name ? <span style={{ opacity: .75 }}>· {selected.name}</span> : null}
      </div>
      <div style={{ fontSize: 12, opacity: .9 }}>
        Balance: <b>{pretty(selected.balance, selected.decimals)}</b> · Decimals: <b>{selected.decimals}</b>
      </div>
      <div style={{ fontSize: 12, opacity: .7 }}>
        {selected.mode === "native" ? "Native coin" : (selected.address as string)}
      </div>
    </div>
  )}
</div>
{/* STEP 2: recipients */}
{selected && (
  <div
    className="card"
    style={{
      background: "var(--fl-surface)",
      borderRadius: "var(--radius)",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow)",
      padding: 16,
      display: "grid",
      gap: 14,
      marginBottom: 16,
    }}
  >
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontWeight: 800, color: "var(--fl-gold)" }}>2) Add recipients</div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>Token: <b>{selected.symbol}</b></div>
    </div>

    {/* Segmented control */}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <ModeButton active={inputMode === "line"} onClick={() => setInputMode("line")}>Line by line</ModeButton>
      <ModeButton active={inputMode === "paste"} onClick={() => setInputMode("paste")}>Paste list</ModeButton>
      <ModeButton active={inputMode === "csv"} onClick={() => setInputMode("csv")}>Upload CSV</ModeButton>
    </div>

    {/* LINE BY LINE */}
    {inputMode === "line" && (
      <div style={{ display: "grid", gap: 10 }}>
        {validatedEntries.map((r, i) => (
          <div key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px",
              gap: 10,
            }}
          >
            <div>
              <label style={{ fontSize: 12, opacity: .8 }}>Recipient (0x…)</label>
              <input
                placeholder="0xabc…"
                value={r.address}
                onChange={(e) => setEntry(i, { address: e.target.value })}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--fl-bg)",
                  color: "var(--text)",
                  outline: "none",
                  borderColor: r.address && !r.validAddr ? "var(--fl-danger)" : "var(--border)",
                }}
              />
              {r.address && !r.validAddr && (
                <div style={{ color: "var(--fl-danger)", fontSize: 12, marginTop: 4 }}>
                  Invalid address format
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, opacity: .8 }}>Amount</label>
              <input
                placeholder={`Amount${selected?.symbol ? ` of $${selected.symbol}` : ""}`}
                value={r.amount}
                onChange={(e) => onAmountChange(i, e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--fl-bg)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
            </div>
          </div>
        ))}

        <div>
          <button
            type="button"
            onClick={addRow}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Add recipient
          </button>
        </div>
      </div>
    )}

    {/* PASTE MODE */}
    {inputMode === "paste" && (
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ fontSize: 12, opacity: .8 }}>Paste one per line (address, amount)</label>
        <textarea
          rows={6}
          placeholder={`0xAddress1, 100\n0xAddress2, 250\n0xAddress3, 400`}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--fl-bg)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        <div>
          <button
            type="button"
            onClick={handlePasteApply}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "none",
              background: "var(--fl-gold)",
              color: "#000",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "var(--shadow)",
            }}
          >
            Apply
          </button>
        </div>
        {validatedEntries.length > 0 && (
          <div style={{ fontSize: 12, opacity: .8 }}>
            Parsed {validatedEntries.length} row(s). You can switch to “Line by line” to edit.
          </div>
        )}
      </div>
    )}

    {/* CSV MODE */}
    {inputMode === "csv" && (
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontSize: 12, opacity: .8 }}>Upload CSV (address,amount)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await handleCSV(f);
          }}
          style={{ color: "var(--text)" }}
        />
        <div style={{ fontSize: 12, opacity: .7 }}>
          Example: <code>0xabc...,100</code>
        </div>
      </div>
    )}

    {/* Totals */}
    {canProceedStep2 && selected && (
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          fontSize: 12,
          background: "var(--fl-bg)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 10,
        }}
      >
        <div>Total: <b>{withCommas(String(totalAmountHuman))} {selected.symbol}</b></div>
        <div style={{ opacity: .8 }}>Your balance: <b>{pretty(selected.balance, selected.decimals)} {selected.symbol}</b></div>
      </div>
    )}
  </div>
)}
      {/* STEP 3: submit */}
      <form onSubmit={onSubmit}>
        <button
          type="submit"
          disabled={
            !isConnected ||
            !selected ||
            !inputMode ||
            anyInvalidAddr ||
            anyInvalidAmt ||
            totalAmountWei === 0n ||
            erc20Pending
          }
          title={buttonLabel}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: "var(--radius)",
            border: "none",
            background: (!isConnected || !selected || !inputMode || anyInvalidAddr || anyInvalidAmt || totalAmountWei === 0n)
              ? "#777"
              : "var(--fl-gold)",
            color: "#000",
            fontWeight: 800,
            cursor: (!isConnected || !selected || !inputMode || anyInvalidAddr || anyInvalidAmt || totalAmountWei === 0n)
              ? "not-allowed"
              : "pointer",
            boxShadow: "var(--shadow)",
          }}
        >
          {buttonLabel}
        </button>
      </form>

      {status && <div style={{ marginTop: 12, color: "var(--text)" }}>{status}</div>}

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        Note: v1 sends one transaction per recipient. Next, we can add a batch airdrop smart contract (FareDrop.sol) to do it in a single tx.
      </div>
    </div>
  );
}
