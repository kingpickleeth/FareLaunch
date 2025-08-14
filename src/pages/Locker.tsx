import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { Address, PublicClient } from "viem";
import { erc20Abi, formatUnits, parseUnits } from "viem";
const GRAPH_API_KEY = "aa059b1e69ed478166441a056f80de5d"; // e.g. "gsk_abc123..."

/* =========================================================================================
   INLINE: DateTimePopover (same behavior as your presale picker)
   ========================================================================================= */
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtLocal(date: Date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}
function parseLocal(s?: string) {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : undefined;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23,59,0,0); return x; }
function addMonths(d: Date, m: number) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; }
function clampDate(d: Date, min: Date, max: Date) {
  if (d.getTime() < min.getTime()) return new Date(min);
  if (d.getTime() > max.getTime()) return new Date(max);
  return d;
}
function sameYMD(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function display(dt?: Date) {
  return dt
    ? dt.toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" })
    : "—";
}
type DTPProps = {
  value?: string;
  min?: string;
  max?: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
};
function DateTimePopover({ value, min, max, onChange, disabled, placeholder }: DTPProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const now = new Date();
  const valDate = parseLocal(value);
  const minDate = parseLocal(min) ?? now;
  const maxDate = parseLocal(max) ?? addMonths(now, 24);

  const justClosedRef = useRef(false);
  const closePopover = () => {
    setOpen(false);
    justClosedRef.current = true;
    requestAnimationFrame(() => { justClosedRef.current = false; });
  };

  function commit(next: Date) {
    next.setSeconds(0, 0);
    onChange(fmtLocal(clampDate(next, minDate, maxDate)));
  }

  const [viewMonth, setViewMonth] = useState<Date>(() => startOfDay(valDate ?? now));

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const grid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7; // Mon=0
    const start = new Date(first);
    start.setDate(first.getDate() - startWeekday);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [viewMonth]);

  function setDatePart(day: Date) {
    const base = valDate ?? new Date();
    const picked = new Date(day);
    picked.setHours(base.getHours(), base.getMinutes(), 0, 0);
    commit(picked);
  }

  const active = valDate ?? minDate;
  const hours = active.getHours();
  const minutes = active.getMinutes();

  const dtpInputStyle: React.CSSProperties = {
    background: "var(--fl-bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: 12,
    padding: "10px 12px",
    outline: "none",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    cursor: "pointer",
  };
  const dtpPopoverStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 20,
    top: "calc(100% + 8px)",
    right: 0,
    minWidth: 320,
    padding: 12,
    borderRadius: 14,
    border: "1px solid var(--card-border)",
    background: "var(--fl-surface, var(--surface, #1A1C23))",
    color: "var(--text)",
    boxShadow: "0 10px 30px rgba(0,0,0,.35)",
    animation: "dtpIn .12s ease-out",
  };
  const inputStyle: React.CSSProperties = {
    background: "var(--fl-bg)", border: "1px solid var(--border)", color: "var(--text)",
    borderRadius: 12, padding: "10px 12px", outline: "none", width: "100%",
  };
  const popHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px", marginBottom: 8 };
  const navBtnStyle: React.CSSProperties = { border: "1px solid var(--card-border)", background: "transparent", color: "var(--text)", borderRadius: 10, padding: "4px 10px", cursor: "pointer" };
  const weekdayRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: "4px 0" };
  const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 };
  const cellStyle: React.CSSProperties = { border: "1px solid transparent", borderRadius: 10, padding: "8px 0", background: "transparent", color: "var(--text)" };
  const timeRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--card-border)" };
  const selectStyle: React.CSSProperties = { ...inputStyle, height: 36, padding: "6px 8px", width: 80 };
  const popFooterStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 };

  const toggleOpen = () => {
    if (disabled) return;
    if (justClosedRef.current) return;
    setOpen((v) => !v);
  };

  useEffect(() => {
    const styleTagId = "dtp-keyframe-style";
    if (typeof document !== "undefined" && !document.getElementById(styleTagId)) {
      const style = document.createElement("style");
      style.id = styleTagId;
      style.innerHTML = `@keyframes dtpIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div ref={anchorRef} style={{ position: "relative", width: "100%", opacity: disabled ? 0.6 : 1 }}>
      <button type="button" onClick={toggleOpen} className="dtp-input" style={dtpInputStyle} disabled={disabled}>
        <span style={{ opacity: value ? 1 : 0.6 }}>
          {value ? display(parseLocal(value)) : (placeholder ?? "Select date & time")}
        </span>
        <span aria-hidden>📅</span>
      </button>

      {open && (
        <div
          ref={popRef}
          style={dtpPopoverStyle}
          className="dtp-popover"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={popHeaderStyle}>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} style={navBtnStyle} aria-label="Previous month">‹</button>
            <div style={{ fontWeight: 700 }}>{viewMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} style={navBtnStyle} aria-label="Next month">›</button>
          </div>

          {/* Weekdays */}
          <div style={weekdayRowStyle}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((w) => (
              <div key={w} style={{ opacity: 0.7, fontSize: 12 }}>{w}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={gridStyle}>
            {grid.map((d, i) => {
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const tooEarly = d.getTime() < startOfDay(minDate).getTime();
              const tooLate  = d.getTime() > endOfDay(maxDate).getTime();
              const disabledCell = tooEarly || tooLate;
              const isSelected = valDate ? sameYMD(d, valDate) : false;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => !disabledCell && setDatePart(d)}
                  disabled={disabledCell}
                  style={{
                    ...cellStyle,
                    opacity: disabledCell ? 0.25 : (inMonth ? 1 : 0.45),
                    color: disabledCell ? "var(--muted)" : "var(--text)",
                    borderColor: isSelected ? "var(--fl-gold)" : "transparent",
                    background: isSelected ? "rgba(255,184,46,0.12)" : "transparent",
                    cursor: disabledCell ? "not-allowed" : "pointer",
                  }}
                  title={disabledCell ? "Unavailable" : undefined}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time */}
          <div style={timeRowStyle}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 12, opacity: 0.8 }}>Time</label>
              <select value={hours} onChange={(e) => {
                const next = new Date(active); next.setHours(Number(e.target.value), minutes, 0, 0); commit(next);
              }} style={selectStyle}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{pad(h)}</option>
                ))}
              </select>
              <span>:</span>
              <select value={Math.floor(minutes / 5) * 5} onChange={(e) => {
                const next = new Date(active); next.setMinutes(Number(e.target.value), 0, 0); commit(next);
              }} style={selectStyle}>
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                  <option key={m} value={m}>{pad(m)}</option>
                ))}
              </select>
              <span style={{ opacity: 0.65, fontSize: 12 }}>
                ({parseLocal(value)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "--:--"})
              </span>
            </div>
          </div>

          <div style={popFooterStyle}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Local: <strong>{display(parseLocal(value))}</strong></div>
            <button
              type="button"
              className="button button-primary"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => {
                closePopover();
                (anchorRef.current?.querySelector(".dtp-input") as HTMLButtonElement | null)?.blur?.();
              }}
              style={{ padding: "8px 10px" }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================================
   Presentational bits (Fare theme)
   ========================================================================================= */
const Card: React.FC<{ title: string; children: React.ReactNode; mb?: number }> = ({
  title,
  children,
  mb = 16,
}) => (
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
      marginBottom: mb,
    }}
  >
    <div style={{ fontWeight: 800, color: "var(--fl-gold)" }}>{title}</div>
    {children}
  </div>
);

const Row: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 12 }) => (
  <div style={{ display: "grid", gap, gridTemplateColumns: "1fr 1fr" }}>{children}</div>
);

/* =========================================================================================
   Minimal ABIs
   ========================================================================================= */
const ERC20_ABI = erc20Abi;
const UNIV2_PAIR_ABI = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "getReserves", stateMutability: "view", inputs: [], outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const ERC165_ABI = [
  { type: "function", name: "supportsInterface", stateMutability: "view", inputs: [{ type: "bytes4" }], outputs: [{ type: "bool" }] },
] as const;
const ERC721_IID = "0x80ac58cd";
const LOCKER_ABI = [
  {
    type: "function",
    name: "lock",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "beneficiary", type: "address" },
      { name: "unlockAt", type: "uint64" },
    ],
    outputs: [{ name: "lockId", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "lockId", type: "uint256" }],
    outputs: [],
  },
] as const;

/* =========================================================================================
   Locker + Subgraph config & helpers
   ========================================================================================= */
const LOCKER_ADDRESS = "0x951309A0D91bea793192f5eFD528343F6F8AF39c" as Address;

// Graph key resolution (env → window → localStorage)
function getGraphApiKey(): string | undefined {
  return (GRAPH_API_KEY && GRAPH_API_KEY.trim()) || undefined;
}

const CAMELOT_V2_SUBGRAPH =
  "https://gateway.thegraph.com/api/subgraphs/id/BsottezgVfoMqJaSNKjHJKJZ4BZ8K8q1zQ4RYNADvgyF";

// GraphQL helper
async function gqlFetch<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const key = getGraphApiKey();
  if (!key) throw new Error("Missing Graph API key. Set VITE_GRAPH_API_KEY (or window.__GRAPH_API_KEY__ / localStorage GRAPH_API_KEY).");
  const res = await fetch(CAMELOT_V2_SUBGRAPH, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message || "Subgraph error");
  return json.data as T;
}
// Adjust fields if your schema differs (this matches your example)
const PAIRS_QUERY = `
  query Pairs($first: Int!, $skip: Int!) {
    pairs(first: $first, skip: $skip) {
      id
      token0 { id symbol decimals }
      token1 { id symbol decimals }
    }
  }
`;
type SubgraphToken = { id: string; symbol: string; decimals: string };
type SubgraphPair = { id: string; token0: SubgraphToken; token1: SubgraphToken };

async function fetchAllPairs(): Promise<SubgraphPair[]> {
  const all: SubgraphPair[] = [];
  const pageSize = 500;
  let skip = 0;
  for (;;) {
    const data = await gqlFetch<{ pairs: SubgraphPair[] }>(PAIRS_QUERY, { first: pageSize, skip });
    const page = data.pairs ?? [];
    all.push(...page);
    if (page.length < pageSize) break;
    skip += pageSize;
  }
  return all;
}

function fmt2(n: string | number) {
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
function fmtTimeLeft(nowMs: number, unlockTs: number) {
  const ms = Math.max(0, unlockTs * 1000 - nowMs);
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "unlocked";
}

type PairInfo = {
  type: "erc20-v2" | "erc721-v3";
  lpAddress: Address;
  lpSymbol?: string;
  lpDecimals?: number;
  token0?: Address;
  token1?: Address;
  symbol0?: string;
  symbol1?: string;
  decimals0?: number;
  decimals1?: number;
  reserve0?: bigint;
  reserve1?: bigint;
  totalSupply?: bigint;
};

type UserLpRow = {
  lpAddress: Address;
  token0: Address;
  token1: Address;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
};
type EnrichedLock = ChainLock & {
  id: number;
  pair?: PairInfo;
  lpDecimals?: number;
  amountHuman?: string;
  underlying0Human?: string;
  underlying1Human?: string;
};

function badge(address?: Address, label?: string) {
  const a = (address || "0x").slice(2);
  const seed = parseInt(a.slice(0, 6) || "0", 16);
  const hue = seed % 360;
  const short = label || (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—");
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: `linear-gradient(135deg, hsl(${hue} 60% 22%), hsl(${(hue+40)%360} 60% 18%))`,
        color: "white",
        fontSize: 12,
      }}
      title={address}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: `hsl(${(hue+20)%360} 70% 50%)`,
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,.25)",
        }}
      />
      <strong style={{ letterSpacing: 0.2 }}>{short}</strong>
    </span>
  );
}

/* Detect LP kind & read metadata (V2 reserves, ERC-721 check for V3) */
async function detectPair(pc: PublicClient, lp: Address): Promise<PairInfo | null> {
  try {
    const [decimals, symbol] = await Promise.all([
      pc.readContract({ address: lp, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
      pc.readContract({ address: lp, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
    ]);

    try {
      const [token0, token1, reserves, totalSupply] = await Promise.all([
        pc.readContract({ address: lp, abi: UNIV2_PAIR_ABI, functionName: "token0" }) as Promise<Address>,
        pc.readContract({ address: lp, abi: UNIV2_PAIR_ABI, functionName: "token1" }) as Promise<Address>,
        pc.readContract({ address: lp, abi: UNIV2_PAIR_ABI, functionName: "getReserves" }) as Promise<[bigint, bigint, number]>,
        pc.readContract({ address: lp, abi: UNIV2_PAIR_ABI, functionName: "totalSupply" }) as Promise<bigint>,
      ]);
      const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
        pc.readContract({ address: token0, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
        pc.readContract({ address: token1, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
        pc.readContract({ address: token0, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
        pc.readContract({ address: token1, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
      ]);
      return {
        type: "erc20-v2",
        lpAddress: lp,
        lpSymbol: symbol,
        lpDecimals: decimals,
        token0, token1,
        symbol0, symbol1,
        decimals0, decimals1,
        reserve0: reserves[0],
        reserve1: reserves[1],
        totalSupply,
      };
    } catch {
      return { type: "erc20-v2", lpAddress: lp, lpSymbol: symbol, lpDecimals: decimals };
    }
  } catch {
    try {
      const isNft = await pc.readContract({
        address: lp,
        abi: ERC165_ABI,
        functionName: "supportsInterface",
        args: [ERC721_IID],
      }) as boolean;
      if (isNft) return { type: "erc721-v3", lpAddress: lp };
    } catch {}
    return null;
  }
}
/* ============================== Manage Locks (read + withdraw) ============================== */
type ChainLock = {
  token: Address;
  beneficiary: Address;
  amount: bigint;
  unlockAt: bigint; // uint64
  withdrawn: boolean;
};
async function readLockCount(pc: PublicClient): Promise<number> {
  const count = await pc.readContract({
    address: LOCKER_ADDRESS,
    abi: [{ type: "function", name: "locksCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const,
    functionName: "locksCount",
  }) as bigint;
  return Number(count);
}
async function readLockAt(pc: PublicClient, index: number): Promise<ChainLock> {
  const raw = await pc.readContract({
    address: LOCKER_ADDRESS,
    abi: [{
      type: "function",
      name: "locks",
      stateMutability: "view",
      inputs: [{ type: "uint256" }],
      outputs: [
        { type: "address" }, // token
        { type: "address" }, // beneficiary
        { type: "uint256" }, // amount
        { type: "uint64"  }, // unlockAt
        { type: "bool"    }, // withdrawn
      ],
    }] as const,
    functionName: "locks",
    args: [BigInt(index)],
  }) as readonly [Address, Address, bigint, bigint, boolean];

  return {
    token: raw[0],
    beneficiary: raw[1],
    amount: raw[2],
    unlockAt: raw[3],
    withdrawn: raw[4],
  };
}
async function readMyLocks(pc: PublicClient, me: Address): Promise<(ChainLock & { id: number })[]> {
  const count = await readLockCount(pc);
  const indexes = Array.from({ length: count }, (_, i) => i);

  // Chunk to avoid provider limits
  const chunkSize = 200;
  const out: (ChainLock & { id: number })[] = [];
  for (let i = 0; i < indexes.length; i += chunkSize) {
    const slice = indexes.slice(i, i + chunkSize);
    // Try multicall; if chain doesn't support multicall3, fallback to serial
    try {
      const res = await pc.multicall({
        contracts: slice.map((id) => ({
          address: LOCKER_ADDRESS,
          abi: [{
            type: "function",
            name: "locks",
            stateMutability: "view",
            inputs: [{ type: "uint256" }],
            outputs: [
              { type: "address" },
              { type: "address" },
              { type: "uint256" },
              { type: "uint64" },
              { type: "bool" },
            ],
          }] as const,
          functionName: "locks",
          args: [BigInt(id)] as const,
        })),
        allowFailure: true,
      });

      res.forEach((r, idx) => {
        const id = slice[idx];
        if (r.status !== "success") return;
        const raw = r.result as readonly [Address, Address, bigint, bigint, boolean];
        if (raw[1].toLowerCase() !== me.toLowerCase()) return;
        out.push({
          id,
          token: raw[0],
          beneficiary: raw[1],
          amount: raw[2],
          unlockAt: raw[3],
          withdrawn: raw[4],
        });
      });
    } catch {
      // Fallback: serial reads
      for (const id of slice) {
        try {
          const one = await readLockAt(pc, id);
          if (one.beneficiary.toLowerCase() !== me.toLowerCase()) continue;
          out.push({ id, ...one });
        } catch {}
      }
    }
  }

  // Sort by unlock time soonest first
  out.sort((a, b) => Number(a.unlockAt - b.unlockAt));
  return out;
}

/* ===================================== Main component ===================================== */
export default function Locker() {
  const { address, isConnected } = useAccount();
  const pc = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  // Tabs: "lock" | "manage"
  const [tab, setTab] = useState<"lock" | "manage">("lock");

  // Steps (lock tab): 1) select LP  2) details  3) done
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // LP discovery/selection
  const [userLPs, setUserLPs] = useState<UserLpRow[]>([]);
  const [selectedLP, setSelectedLP] = useState<Address | "">("");

  // Pair info + balances/allowance
  const [pair, setPair] = useState<PairInfo | null>(null);
  const [lpBalance, setLpBalance] = useState<bigint>(0n);
  const [lpAllowance, setLpAllowance] = useState<bigint>(0n);

  // Lock form
  const [amountText, setAmountText] = useState("");
  const [beneficiary, setBeneficiary] = useState<Address | "">("");
  const [unlockAtISO, setUnlockAtISO] = useState<string>("");

  // Manage tab data
  const [myLocks, setMyLocks] = useState<EnrichedLock[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(false);

  // Theme CSS
  useEffect(() => {
    const css = `
      .muted { opacity: .8; font-size: 12px; }
      .btn { padding: 12px; border-radius: var(--radius); border: none; font-weight: 800; box-shadow: var(--shadow); transition: background 120ms ease, transform 120ms ease; }
      .btn:not([disabled]) { cursor: pointer; }
      .btn[disabled] { background: #777 !important; color: #fff !important; cursor: not-allowed !important; opacity: .8; }
      .btn-primary { background: var(--fl-gold); color: #000; }
      .btn-primary:not([disabled]):hover, .btn-primary:not([disabled]):focus-visible { background: #e6a800; transform: translateY(-1px); }
      .btn-secondary { border: 1px solid var(--border); background: transparent; color: var(--text); font-weight: 700; padding: 10px 12px; border-radius: 12px; cursor: pointer; }
      input, textarea, select { background: var(--fl-bg); border: 1px solid var(--border); color: var(--text); border-radius: 12px; padding: 10px 12px; outline: none; width: 100%; }
      .tool-title { margin: 0 0 12px; }
      @media (max-width: 560px) { .two-col { grid-template-columns: 1fr !important; } }
    `;
    const id = "locker-inline-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = css;
      document.head.appendChild(s);
    }
  }, []);

  // Helpers for env
  const [graphKey] = useState<string | undefined>(() => getGraphApiKey());
  /* ---------------- Derived values ---------------- */
  const amountWei = useMemo(() => {
    if (!pair || pair.type !== "erc20-v2" || !pair.lpDecimals) return 0n;
    const raw = (amountText || "").replace(/,/g, "").trim();
    try { return parseUnits(raw === "" ? "0" : raw, pair.lpDecimals); } catch { return 0n; }
  }, [amountText, pair]);

  const lpBalanceHuman = useMemo(() => {
    if (!pair || pair.type !== "erc20-v2" || !pair.lpDecimals) return "0.00";
    try { return fmt2(Number(formatUnits(lpBalance, pair.lpDecimals))); } catch { return "0.00"; }
  }, [lpBalance, pair]);

  const unlockAtTs = useMemo(() => {
    const d = unlockAtISO ? new Date(unlockAtISO) : null;
    return d ? Math.floor(d.getTime() / 1000) : 0;
  }, [unlockAtISO]);

  const canAdvanceStep1 = !!selectedLP && !!pair && pair.type === "erc20-v2";
  const isBeneficiaryValid = !!beneficiary && /^0x[a-fA-F0-9]{40}$/.test(String(beneficiary));
  const isUnlockFuture = unlockAtTs * 1000 > Date.now();
  const amountValid = amountWei > 0n && amountWei <= lpBalance;
  const needsApprove = pair?.type === "erc20-v2" && amountWei > lpAllowance;

  // Context-aware CTA label & disabled reason
  const cta = useMemo(() => {
    if (!pair || pair.type !== "erc20-v2") return { label: "Select a V2 LP", disabled: true };
    if (!amountValid) {
      if (amountWei === 0n) return { label: "Enter amount", disabled: true };
      if (lpBalance > 0n && amountWei > lpBalance) return { label: "Amount exceeds balance", disabled: true };
      return { label: "Invalid amount", disabled: true };
    }
    if (!isBeneficiaryValid) return { label: "Enter beneficiary", disabled: true };
    if (!isUnlockFuture) return { label: "Pick a future unlock", disabled: true };
    if (needsApprove) return { label: isPending ? "Approving..." : "Approve LP", disabled: isPending };
    return { label: isPending ? "Locking..." : "Lock LP", disabled: isPending };
  }, [pair, amountValid, amountWei, lpBalance, isBeneficiaryValid, isUnlockFuture, needsApprove, isPending]);


  /* ---------------- LP discovery via subgraph + multicall (with fallback) ---------------- */
  async function discoverMyLPs() {
    if (!pc || !address) return;
    const key = getGraphApiKey();
    if (!key) {
      console.warn("Set GRAPH_API_KEY to discover LPs.");
      return;
    }
    const pairs = await fetchAllPairs();

    const contracts = pairs.map((p) => ({
      address: p.id as Address,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: [address] as const,
    }));

    const results: bigint[] = [];
    // chunking for safety
    const chunkSize = 250;
    for (let i = 0; i < contracts.length; i += chunkSize) {
      const chunk = contracts.slice(i, i + chunkSize);
      try {
        const r = await pc.multicall({ contracts: chunk, allowFailure: true });
        for (const x of r) results.push(x.status === "success" ? (x.result as bigint) : 0n);
      } catch {
        // fallback: serial reads if multicall3 unsupported
        for (const c of chunk) {
          try {
            const bal = await pc.readContract(c);
            results.push(bal as bigint);
          } catch { results.push(0n); }
        }
      }
    }

    const have = pairs
      .map((p, i) => ({ p, bal: results[i] || 0n }))
      .filter((x) => x.bal > 0n)
      .map<UserLpRow>((x) => ({
        lpAddress: x.p.id as Address,
        token0: x.p.token0.id as Address,
        token1: x.p.token1.id as Address,
        symbol0: x.p.token0.symbol,
        symbol1: x.p.token1.symbol,
        decimals0: Number(x.p.token0.decimals),
        decimals1: Number(x.p.token1.decimals),
      }));

    setUserLPs(have);
    if (!selectedLP && have[0]) setSelectedLP(have[0].lpAddress);
  }

  // Auto discover when user connects (and API key exists)
  useEffect(() => {
    if (isConnected && graphKey) discoverMyLPs();
  }, [isConnected, address, graphKey]);

  /* ------------- When LP changes, detect pair + read balance/allowance ------------- */
  useEffect(() => {
    let alive = true;
    if (!pc || !address || !selectedLP) {
      setPair(null); setLpBalance(0n); setLpAllowance(0n);
      return;
    }
    (async () => {
      const info = await detectPair(pc, selectedLP as Address);
      if (!alive) return;
      setPair(info);

      if (info?.type === "erc20-v2") {
        const [bal, allowance] = await Promise.all([
          pc.readContract({ address: selectedLP as Address, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
          pc.readContract({ address: selectedLP as Address, abi: ERC20_ABI, functionName: "allowance", args: [address, LOCKER_ADDRESS] }) as Promise<bigint>,
        ]);
        if (!alive) return;
        setLpBalance(bal);
        setLpAllowance(allowance);
      } else {
        setLpBalance(0n);
        setLpAllowance(0n);
      }
    })();
    return () => { alive = false; };
  }, [pc, address, selectedLP]);

  /* ---------------- Approve & Lock ---------------- */
  async function approve() {
    if (pair?.type !== "erc20-v2" || !selectedLP) return;
    await writeContractAsync({
      address: selectedLP as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [LOCKER_ADDRESS, amountWei],
    });

    if (!pc || !address) return;
    const a = (await pc.readContract({
      address: selectedLP as Address,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address, LOCKER_ADDRESS],
    })) as bigint;
    setLpAllowance(a);
  }
  async function withdrawLock(lockId: number) {
    await writeContractAsync({
      address: LOCKER_ADDRESS,
      abi: LOCKER_ABI,
      functionName: "withdraw",
      args: [BigInt(lockId)],
    });
    // after withdraw, refresh the “My Locks” list if you have a loader for it
    // await loadMyLocks();
  }
  
  async function lock() {
    if (pair?.type !== "erc20-v2" || !selectedLP || !beneficiary || unlockAtTs <= 0) return;
    await writeContractAsync({
      address: LOCKER_ADDRESS,
      abi: [
        {
          type: "function",
          name: "lock",
          stateMutability: "nonpayable",
          inputs: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "beneficiary", type: "address" },
            { name: "unlockAt", type: "uint64" },
          ],
          outputs: [{ name: "lockId", type: "uint256" }],
        },
      ] as const,
      functionName: "lock",
      args: [selectedLP as Address, amountWei, beneficiary as Address, BigInt(unlockAtTs)],
    });
    setStep(3);
  }

  /* ---------------- Manage: load & withdraw ---------------- */
  async function loadMyLocks() {
    if (!pc || !address) return;
    setLoadingLocks(true);
    try {
      const base = await readMyLocks(pc, address);
  
      const enriched: EnrichedLock[] = [];
      for (const L of base) {
        let pair: PairInfo | null = null;
        try { pair = await detectPair(pc, L.token); } catch {}
  
        let lpDecimals: number | undefined;
        let amountHuman: string | undefined;
        let underlying0Human: string | undefined;
        let underlying1Human: string | undefined;
  
        if (pair?.type === "erc20-v2") {
          lpDecimals = pair.lpDecimals;
  
          // LP amount → 2 decimals
          if (lpDecimals != null) {
            amountHuman = fmt2(Number(formatUnits(L.amount, lpDecimals)));
          }
  
          // Underlying tokens (pro-rata) → 2 decimals
          if (
            pair.totalSupply != null &&
            pair.totalSupply > 0n &&
            pair.reserve0 != null &&
            pair.reserve1 != null &&
            pair.decimals0 != null &&
            pair.decimals1 != null
          ) {
            // (amount / totalSupply) * reserves
            const underlying0 = (L.amount * pair.reserve0) / pair.totalSupply;
            const underlying1 = (L.amount * pair.reserve1) / pair.totalSupply;
  
            underlying0Human = fmt2(Number(formatUnits(underlying0, pair.decimals0)));
            underlying1Human = fmt2(Number(formatUnits(underlying1, pair.decimals1)));
          }
        }
  
        enriched.push({
          ...L,
          pair: pair ?? undefined,
          lpDecimals,
          amountHuman,
          underlying0Human,
          underlying1Human,
        });
      }
  
      setMyLocks(enriched);
    } finally {
      setLoadingLocks(false);
    }
  }
  
  /* ========================================= UI ========================================= */
  return (
    <div className="tool-container fdl-pad" style={{ maxWidth: 820, margin: "0 auto" }}>
 {/* Tabs */}
<div className="tabs" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
  {(["lock", "manage"] as const).map((t) => {
    const active = tab === t;
    const base: React.CSSProperties = {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid var(--border)",
      background: active ? "rgba(255,184,46,0.12)" : "var(--fl-bg)",
      color: "var(--text)",
      fontWeight: 800,
      boxShadow: active ? "0 2px 10px rgba(0,0,0,.15)" : "none",
      cursor: "pointer",
      outline: "none",
    };
    return (
      <button
        key={t}
        type="button"
        onClick={() => {
          setTab(t);
          if (t === "manage") loadMyLocks();
        }}
        style={base}
      >
        {t === "lock" ? "Lock LP Tokens" : "My Locks"}
      </button>
    );
  })}
</div>

      {tab === "lock" && (
        <>
          <h1 className="tool-title" style={{ marginBottom: 12 }}>Lock LP Tokens</h1>

          {/* STEP 1: Pick LP */}
          <Card title="1) Select LP token">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" className="btn-secondary" onClick={discoverMyLPs}>
                  {userLPs.length ? "Refresh my LPs" : "Load my LPs"}
                </button>
              </div>

              <div>
                <select
                  value={selectedLP}
                  onChange={(e) => {
                    setSelectedLP(e.target.value as Address);
                    setStep(1); // ensure step reset if they choose a different LP
                  }}
                >
                  <option value="" disabled>
                    {userLPs.length ? "Select an LP" : "No LPs found"}
                  </option>
                  {userLPs.map((row) => (
                    <option key={row.lpAddress} value={row.lpAddress}>
                      {row.symbol0}/{row.symbol1} — {row.lpAddress.slice(0, 6)}…{row.lpAddress.slice(-4)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pair info + balance */}
              {pair && (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 12,
                    background: "var(--fl-bg)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {badge(pair.token0, pair.symbol0)}
                    <span style={{ opacity: 0.6 }}>/</span>
                    {badge(pair.token1, pair.symbol1)}
                    <span className="muted">LP: {pair.lpSymbol || "—"}</span>
                  </div>

                  {pair.type === "erc20-v2" && (
                    <>
                      <div className="muted"><b>Your LP Balance:</b> {lpBalanceHuman}</div>
                      {(pair.reserve0 != null && pair.reserve1 != null && pair.decimals0 != null && pair.decimals1 != null) && (
                        <div className="muted" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <span>
                            <b>Reserves:</b> {pair.symbol0 || "Token0"} ≈ {fmt2(Number(formatUnits(pair.reserve0!, pair.decimals0!)))}
                          </span>
                          <span>
                            {pair.symbol1 || "Token1"} ≈ {fmt2(Number(formatUnits(pair.reserve1!, pair.decimals1!)))}
                          </span>
                          {pair.totalSupply != null && pair.lpDecimals != null && (
                            <span>
                              <b>Total LP Supply:</b> {fmt2(Number(formatUnits(pair.totalSupply!, pair.lpDecimals!)))}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {pair.type === "erc721-v3" && (
                    <div style={{ color: "var(--fl-danger)" }}>
                      Detected NFT-style LP (Camelot/Uni V3). The current LiquidityLocker accepts ERC-20 LP tokens only.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Continue button disappears after proceeding */}
            {step === 1 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  className={`btn ${canAdvanceStep1 ? "btn-primary" : ""}`}
                  disabled={!canAdvanceStep1}
                  onClick={() => setStep(2)}
                >
                  {canAdvanceStep1 ? "Continue" : "Select an LP token"}
                </button>
              </div>
            )}
          </Card>

          {/* STEP 2: Amount, beneficiary, unlock time */}
          {step >= 2 && (
            <Card title="2) Lock details">
              {pair?.type === "erc721-v3" ? (
                <div style={{ color: "var(--fl-danger)" }}>
                  This LP is an ERC-721 position. To lock it, we’ll need an NFT-locker contract (or a wrapper that mints an ERC-20 against your position).
                </div>
              ) : (
                <>
                  <Row>
                    <div>
                      <div style={{ marginBottom: 6 }}>Amount to lock</div>
                      <input
                        inputMode="decimal"
                        placeholder={pair ? `0.00 (max ${lpBalanceHuman})` : "0.00"}
                        value={amountText}
                        onChange={(e) => setAmountText(e.target.value)}
                        style={{
                          borderColor:
                            pair && amountWei > lpBalance ? "var(--fl-danger)" : "var(--border)",
                        }}
                      />
                      <div className="muted" style={{ marginTop: 4 }}>
                        Balance: {lpBalanceHuman} {pair?.lpSymbol || ""}
                      </div>
                    </div>
                    <div>
                      <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Beneficiary</span>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => address && setBeneficiary(address as Address)}
                          title="Use your connected wallet address"
                          style={{ padding: "6px 10px" }}
                        >
                          Use my wallet
                        </button>
                      </div>
                      <input
                        placeholder="0x… address that can withdraw after unlock"
                        value={beneficiary}
                        onChange={(e) => setBeneficiary(e.target.value as Address)}
                        style={{
                          borderColor: beneficiary && !isBeneficiaryValid ? "var(--fl-danger)" : "var(--border)",
                        }}
                      />
                      <div className="muted" style={{ marginTop: 4 }}>Typically your team multi-sig.</div>
                    </div>
                  </Row>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ marginBottom: 6 }}>Unlock date & time</div>
                    <DateTimePopover
                      value={unlockAtISO}
                      min={fmtLocal(new Date())}
                      onChange={(next) => setUnlockAtISO(next)}
                      placeholder="Select unlock time"
                    />
                    <div className="muted" style={{ marginTop: 4 }}>
                      Must be in the future.
                    </div>
                  </div>

                  {/* Context-aware CTA */}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                    {needsApprove ? (
                      <button
                        type="button"
                        className={`btn ${!cta.disabled ? "btn-primary" : ""}`}
                        disabled={cta.disabled}
                        onClick={approve}
                        title={cta.label}
                      >
                        {cta.label}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`btn ${!cta.disabled ? "btn-primary" : ""}`}
                        disabled={cta.disabled}
                        onClick={lock}
                        title={cta.label}
                      >
                        {cta.label}
                      </button>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* STEP 3: Confirmation */}
          {step >= 3 && (
            <Card title="3) Done">
              <div className="muted">Your LP tokens are locked. You can manage them in “My Locks”.</div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setTab("manage")}>
                  Go to My Locks
                </button>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "manage" && (
        <>
          <h1 className="tool-title" style={{ marginBottom: 12 }}>My Locks</h1>
          <Card title="Your active & past locks">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="muted">
                View locks where you are the beneficiary. You can withdraw once they unlock.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={loadMyLocks}>
                  Refresh
                </button>
                <button type="button" className="btn-secondary" onClick={() => setTab("lock")}>
                  + New Lock
                </button>
              </div>
            </div>

            {loadingLocks ? (
              <div className="muted">Loading…</div>
            ) : myLocks.length === 0 ? (
              <div className="muted">No locks found.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {myLocks.map((L) => {
                  return (
                    <div
                    key={L.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 12,
                      background: "var(--fl-bg)",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>Lock #{L.id}</strong>
                  
                      {L.pair?.type === "erc20-v2" ? (
                        <>
                          <span className="muted">Pair:</span>
                          {badge(L.pair.token0, L.pair.symbol0)}
                          <span style={{ opacity: 0.6 }}>/</span>
                          {badge(L.pair.token1, L.pair.symbol1)}
                        </>
                      ) : (
                        <>
                          <span className="muted">Token:</span> {badge(L.token)}
                        </>
                      )}
                    </div>
                  
                    <div className="muted" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>
                        <b>LP Amount:</b>{" "}
                        {L.amountHuman ?? L.amount.toString()} {L.pair?.lpSymbol ?? ""}
                      </span>
                      <span>
                        <b>Unlocks:</b> {new Date(Number(L.unlockAt) * 1000).toLocaleString()}
                      </span>
                      <span>
                        <b>Status:</b>{" "}
                        {L.withdrawn
                          ? "Withdrawn"
                          : Date.now() >= Number(L.unlockAt) * 1000
                          ? "Unlocked"
                          : `Locked (${fmtTimeLeft(Date.now(), Number(L.unlockAt))})`}
                      </span>
                    </div>
                  
                    {L.underlying0Human != null && L.underlying1Human != null && (
                      <div className="muted" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span>
                          <b>Underlying:</b>{" "}
                          {L.underlying0Human} {L.pair?.symbol0 ?? "Token0"}{" "}
                          + {L.underlying1Human} {L.pair?.symbol1 ?? "Token1"}
                        </span>
                      </div>
                    )}
                  
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => withdrawLock(L.id)}
                        disabled={
                          L.withdrawn || Date.now() < Number(L.unlockAt) * 1000 || isPending
                        }
                        title={
                          L.withdrawn
                            ? "Already withdrawn"
                            : Date.now() >= Number(L.unlockAt) * 1000
                            ? "Withdraw tokens"
                            : "Still locked"
                        }
                      >
                        {L.withdrawn
                          ? "Withdrawn"
                          : Date.now() >= Number(L.unlockAt) * 1000
                          ? isPending ? "Withdrawing..." : "Withdraw"
                          : "Locked"}
                      </button>
                    </div>
                  </div>                  
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

  