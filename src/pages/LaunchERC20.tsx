// src/pages/LaunchERC20.tsx
import { useMemo, useState } from "react";
import { useAccount, useWriteContract, useChainId, useSwitchChain } from "wagmi";
import { parseUnits, isAddress, formatUnits } from "viem";
import { FACTORY_ABI } from "../lib/factoryAbi";

const APECHAIN_ID = Number(import.meta.env.VITE_APECHAIN_ID || 0);
const ABSTRACT_ID = Number(import.meta.env.VITE_ABSTRACT_ID || 2741);

const FACTORY_ADDRESS_APECHAIN =
  (import.meta.env.VITE_FACTORY_ADDRESS_APECHAIN as `0x${string}`) ||
  ("0x072700cCF5177b30BCB5fac3B6c652a0c8b9460a" as `0x${string}`);

const FACTORY_ADDRESS_ABSTRACT =
  (import.meta.env.VITE_FACTORY_ADDRESS_ABSTRACT as `0x${string}`) ||
  ("0x20b51F79FE88845B4c338fEa0b960494dc36D00a" as `0x${string}`);

type TargetChain = typeof APECHAIN_ID | typeof ABSTRACT_ID;
function factoryFor(chainId: TargetChain): `0x${string}` {
  return chainId === ABSTRACT_ID ? FACTORY_ADDRESS_ABSTRACT : FACTORY_ADDRESS_APECHAIN;
}

const APECHAIN_LOGO =
  import.meta.env.VITE_APECHAIN_LOGO ||
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='48' height='48' rx='10' fill='%23282c34'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='18' fill='%23FFB82E'>APE</text></svg>";

const ABSTRACT_LOGO =
  import.meta.env.VITE_ABSTRACT_LOGO ||
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='48' height='48' rx='10' fill='%23282c34'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='18' fill='%23A7C7FF'>ABS</text></svg>";

const CHAIN_META: Record<number, { label: string; labelShort: string; logo: string }> = {
  [APECHAIN_ID]: { label: "ApeChain", labelShort: "ApeChain", logo: APECHAIN_LOGO },
  [ABSTRACT_ID]: { label: "Abstract", labelShort: "Abstract", logo: ABSTRACT_LOGO },
};

type DistType = "single" | "multi" | null;

// Replace your Card with this version (adds optional `step` prop)
// EXACT FareDrop-style header inside Card
const Card: React.FC<{
  title: string;
  children: React.ReactNode;
  mb?: number;
  step?: number;            // <-- new
}> = ({ title, children, mb = 16, step }) => (
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
    {/* Header matches FareDrop */}
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {typeof step === "number" && (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "color-mix(in srgb, var(--fl-gold) 18%, transparent)",
            border: "1px solid var(--fl-gold)",
            color: "var(--fl-gold)",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          {step}
        </span>
      )}
      <span style={{ fontWeight: 800, color: "var(--text)" }}>{title}</span>
    </div>

    {children}
  </div>
);

const DistCard: React.FC<{
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: React.ReactNode;
}> = ({ active, onClick, title, subtitle }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
    className="dist-card"
    style={{
      padding: 12,
      borderRadius: 12,
      cursor: "pointer",
      border: active ? "2px solid var(--fl-gold)" : "1px solid var(--border)",
      background: active ? "rgba(255,184,46,0.12)" : "transparent",
    }}
  >
    <strong style={{ display: "block", marginBottom: 4 }}>{title}</strong>
    <div className="muted">{subtitle}</div>
  </div>
);

export default function LaunchERC20() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const walletChainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  const initialTarget =
    walletChainId === ABSTRACT_ID || walletChainId === APECHAIN_ID ? walletChainId : APECHAIN_ID;
  const [targetChainId, setTargetChainId] = useState<TargetChain>(initialTarget);

  const mismatch =
    isConnected &&
    (walletChainId === 0 || (walletChainId !== 0 && walletChainId !== targetChainId));

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const decimals = 18;
  const [totalSupply, setTotalSupply] = useState("");
  const [website, setWebsite] = useState("");
  const [distributionType, setDistributionType] = useState<DistType>(null);
  const [recipients, setRecipients] = useState<{ address: string; amount: string }[]>([
    { address: "", amount: "" },
  ]);
  const [status, setStatus] = useState<string | null>(null);

  function shortAddr(a?: string) {
    return a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "";
  }
  const withCommas = (s: string) => {
    const [w, f] = s.split(".");
    const whole = (w || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return f ? `${whole}.${f}` : whole;
  };
  function formatWithCommas(value: string) {
    const clean = value.replace(/,/g, "").replace(/[^\d.]/g, "");
    if ((clean.match(/\./g) || []).length > 1) return totalSupply;
    const [w, f = ""] = clean.split(".");
    return withCommas(w) + (f ? `.${f}` : "");
  }
  function handleRecipientChange(index: number, field: "address" | "amount", value: string) {
    const updated = [...recipients];
    updated[index][field] = field === "amount" ? formatWithCommas(value) : value;
    setRecipients(updated);
  }
  function addRecipientRow() {
    setRecipients((prev) => [...prev, { address: "", amount: "" }]);
  }

  const nameOk = name.trim().length >= 2;
  const symbolOk = /^[A-Z0-9]{1,6}$/.test(symbol.trim());
  const cleanSupplyText = (totalSupply || "0").replace(/,/g, "").trim();
  const supplyOk = (() => {
    const n = Number(cleanSupplyText);
    return Number.isFinite(n) && n > 1;
  })();

  function websiteHint(input?: string): string | null {
    if (!input) return null;
    const v = input.trim();
    if (!v) return null;
    if (/\s/.test(v)) return "Remove spaces from the URL.";
    const hasProtocol = /^https?:\/\//i.test(v);
    const rest = v.replace(/^https?:\/\//i, "");
    const hasDot = /\.[a-z]{2,}$/i.test(rest);
    if (!hasDot) return `Add a domain like ".com" — e.g., https://${rest || "example.com"}`;
    if (!hasProtocol) return `Add https:// to make it https://${rest}`;
    return null;
  }
  const webHelp = websiteHint(website);

  const validRecipientRows = useMemo(
    () =>
      recipients.filter(
        (r) => r.address && isAddress(r.address) && Number((r.amount || "0").replace(/,/g, "")) > 0
      ),
    [recipients]
  );

  const distributedHuman = useMemo(
    () =>
      validRecipientRows.reduce(
        (acc, r) => acc + Number((r.amount || "0").replace(/,/g, "")),
        0
      ),
    [validRecipientRows]
  );

  const supplyWei = useMemo(() => {
    try {
      return parseUnits(cleanSupplyText || "0", decimals);
    } catch {
      return 0n;
    }
  }, [cleanSupplyText]);

  const distributedWei = useMemo(() => {
    try {
      return validRecipientRows.reduce<bigint>(
        (acc, r) => acc + parseUnits((r.amount || "0").replace(/,/g, "") || "0", decimals),
        0n
      );
    } catch {
      return 0n;
    }
  }, [validRecipientRows]);

  const overAllocated = distributionType === "multi" && distributedWei > supplyWei;
  const remainingWei =
    distributionType === "multi" && supplyWei > distributedWei ? supplyWei - distributedWei : 0n;
  const remainingHuman = useMemo(() => {
    try {
      return withCommas(formatUnits(remainingWei, decimals).replace(/\.0+$/, ""));
    } catch {
      return "0";
    }
  }, [remainingWei]);

  const nextIssue = useMemo(() => {
    if (!nameOk) return "Enter a token name";
    if (!symbolOk) return "Enter a Token Symbol";
    if (!supplyOk) return "Enter a total supply";
    if (!distributionType) return "Choose a distribution option";
    if (distributionType === "multi" && validRecipientRows.length === 0)
      return "Add at least one valid recipient";
    if (distributionType === "multi" && overAllocated)
      return "Distributed amount exceeds total supply";
    if (!isConnected) return "Connect your wallet";
    return null;
  }, [nameOk, symbolOk, supplyOk, distributionType, validRecipientRows.length, overAllocated, isConnected]);

  const formReady = nextIssue === null;

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    if (!formReady) return;
    setStatus(null);

    const finalRecipients: `0x${string}`[] = [];
    const finalAmounts: bigint[] = [];

    if (distributionType === "single" && address) {
      finalRecipients.push(address as `0x${string}`);
      finalAmounts.push(parseUnits(cleanSupplyText, decimals));
    } else {
      for (const r of validRecipientRows) {
        finalRecipients.push(r.address as `0x${string}`);
        finalAmounts.push(parseUnits((r.amount || "0").replace(/,/g, ""), decimals));
      }
      if (remainingWei > 0n && address) {
        finalRecipients.push(address as `0x${string}`);
        finalAmounts.push(remainingWei);
      }
    }

    try {
      const txHash = await writeContractAsync({
        address: factoryFor(targetChainId),
        abi: FACTORY_ABI,
        functionName: "createToken",
        args: [name.trim(), symbol.trim(), decimals, website.trim(), finalRecipients, finalAmounts],
        chainId: targetChainId,
      });
      setStatus(`Transaction sent: ${txHash}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err?.shortMessage || err?.message || "Failed to launch"}`);
    }
  }

  return (
    <div className="tool-container fdl-pad" style={{ maxWidth: 640, margin: "0 auto" }}>
      <style>{`
        .tool-title { margin: 0 0 12px; }
        .muted { opacity: .8; font-size: 12px; }

        /* Chain picker */
        .chain-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
        }
        .chain-opt {
          display: grid;
          grid-template-columns: 44px 1fr auto;
          grid-template-areas: "logo meta cta";
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--fl-surface);
          box-shadow: var(--shadow);
          cursor: pointer;
          transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease, background .12s ease;
          min-width: 0;
        }
        .chain-opt:hover { transform: translateY(-1px); }
        .chain-opt.active {
          border-color: var(--fl-gold);
          background:
            radial-gradient(120px 60px at 20% 0%, rgba(255,184,46,.12), transparent),
            var(--fl-surface);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--fl-gold) 30%, transparent), var(--shadow);
        }
        .chain-opt .logo { grid-area: logo; width: 44px; height: 44px; border-radius: 12px; overflow: hidden; display: grid; place-items: center; background: var(--fl-bg); border: 1px solid var(--border); }
        .chain-opt .logo img { width: 100%; height: 100%; object-fit: cover; }
        .chain-opt .meta { grid-area: meta; display: grid; gap: 2px; min-width: 0; }
        .chain-opt .meta .title { font-weight: 800; color: var(--text); }
        .chain-opt .meta .sub { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chain-opt .cta { grid-area: cta; justify-self: end; }
        .chain-opt input[type="radio"] { display: none; }

        @media (max-width: 520px) {
          .chain-opt { grid-template-columns: 36px 1fr; grid-template-areas: "logo meta" "cta cta"; gap: 10px; }
          .chain-opt .logo { width: 36px; height: 36px; border-radius: 10px; }
          .chain-opt .cta { justify-self: end; }
        }

        .dist-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 560px) { .dist-grid { grid-template-columns: 1fr; } }
        .dist-card { min-width: 0; box-sizing: border-box; }
        .dist-card .muted { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }

        .rec-row { display: grid; grid-template-columns: 1fr 160px; gap: 8px; }
        @media (max-width: 560px) { .rec-row { grid-template-columns: 1fr; } }

        .error { color: var(--fl-danger); font-size: 12px; margin-top: 4px; }
      `}</style>

      <h1 className="tool-title">Launch An ERC-20 Token</h1>

      <form onSubmit={handleLaunch}>
        {/* Target chain */}
        <Card title="Which chain do you want to launch a token on?">
          <div className="chain-grid">
            {/* ApeChain */}
            <label
              className={`chain-opt ${targetChainId === APECHAIN_ID ? "active" : ""}`}
              onClick={() => setTargetChainId(APECHAIN_ID)}
            >
              <input type="radio" name="targetChain" checked={targetChainId === APECHAIN_ID} readOnly />
              <div className="logo">
                <img src={CHAIN_META[APECHAIN_ID].logo} alt="ApeChain" width={44} height={44} />
              </div>
              <div className="meta">
                <div className="title">ApeChain</div>
                <div className="sub">Deploy your ERC-20 to ApeChain</div>
              </div>
              {isConnected && walletChainId !== APECHAIN_ID && (
                <div className="cta">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={async (e) => {
                      e.preventDefault();
                      try { await switchChainAsync({ chainId: APECHAIN_ID }); } catch {}
                    }}
                    disabled={switching}
                    title="Switch wallet network to ApeChain"
                    style={{ padding: "6px 10px", fontSize: 12, borderRadius: 10 }}
                  >
                    {switching && targetChainId === APECHAIN_ID ? "Switching…" : "Switch"}
                  </button>
                </div>
              )}
            </label>

            {/* Abstract */}
            <label
              className={`chain-opt ${targetChainId === ABSTRACT_ID ? "active" : ""}`}
              onClick={() => setTargetChainId(ABSTRACT_ID)}
            >
              <input type="radio" name="targetChain" checked={targetChainId === ABSTRACT_ID} readOnly />
              <div className="logo">
                <img src={CHAIN_META[ABSTRACT_ID].logo} alt="Abstract" width={44} height={44} />
              </div>
              <div className="meta">
                <div className="title">Abstract</div>
                <div className="sub">Deploy your ERC-20 to Abstract</div>
              </div>
              {isConnected && walletChainId !== ABSTRACT_ID && (
                <div className="cta">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={async (e) => {
                      e.preventDefault();
                      try { await switchChainAsync({ chainId: ABSTRACT_ID }); } catch {}
                    }}
                    disabled={switching}
                    title="Switch wallet network to Abstract"
                    style={{ padding: "6px 10px", fontSize: 12, borderRadius: 10 }}
                  >
                    {switching && targetChainId === ABSTRACT_ID ? "Switching…" : "Switch"}
                  </button>
                </div>
              )}
            </label>
          </div>

          {mismatch && (
            <div className="error" role="alert" style={{ marginTop: 10 }}>
              Your wallet is on a different network. Click <b>Switch</b> above or use your wallet’s network switcher.
            </div>
          )}
        </Card>

        {/* 1) Name */}
        <Card step={1} title="Token name">
          <input
            className="fdl-input"
            placeholder="My Token"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ borderColor: name && !nameOk ? "var(--fl-danger)" : "var(--input-border, var(--border))" }}
          />
          {name && !nameOk && <div className="error">Name must be at least 2 characters.</div>}
        </Card>

        {/* 2) Symbol */}
        {nameOk && (
          <Card step={2} title="Token symbol">
            <input
              className="fdl-input"
              placeholder="MTK"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 6))}
              style={{ borderColor: symbol && !symbolOk ? "var(--fl-danger)" : "var(--input-border, var(--border))" }}
            />
            <div className="muted">This is your “ticker”. It must be 1–6 letters/numbers, e.g., MTK.</div>
            {symbol && !symbolOk && <div className="error">Only A–Z and 0–9, max 6 chars.</div>}
          </Card>
        )}

        {/* 3) Total supply */}
        {nameOk && symbolOk && (
          <Card step={3} title="Total supply">
            <input
              className="fdl-input"
              placeholder="1,000,000"
              inputMode="decimal"
              value={totalSupply}
              onChange={(e) => setTotalSupply(formatWithCommas(e.target.value))}
              style={{ borderColor: totalSupply && !supplyOk ? "var(--fl-danger)" : "var(--input-border, var(--border))" }}
            />
            <div className="muted">Uses {decimals} decimals.</div>
            {totalSupply && !supplyOk && <div className="error">Enter a number greater than 1.</div>}
          </Card>
        )}

        {/* Website (optional) */}
        {nameOk && symbolOk && supplyOk && (
          <Card title="Website (optional):">
            <input
              className="fdl-input"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
            {website && webHelp && <div className="error">{webHelp}</div>}
          </Card>
        )}

        {/* 4) Distribution */}
        {nameOk && symbolOk && supplyOk && (
          <Card step={4} title="Distribution">
            <div className="dist-grid">
              <DistCard
                active={distributionType === "single"}
                onClick={() => setDistributionType("single")}
                title="Mint to myself"
                subtitle={<span className="muted" title={address || "Connect wallet"}>{address ? shortAddr(address) : "Connect wallet"}</span>}
              />
              <DistCard
                active={distributionType === "multi"}
                onClick={() => setDistributionType("multi")}
                title="Multiple wallets"
                subtitle="Split supply across recipients"
              />
            </div>
          </Card>
        )}

        {/* 5) Recipients */}
        {distributionType === "multi" && (
          <Card step={5} title="Recipients">
            <div style={{ display: "grid", gap: 8 }}>
              {recipients.map((r, i) => {
                const addrBad = r.address && !isAddress(r.address);
                const amtBad = r.amount && !(Number(r.amount.replace(/,/g, "")) > 0);
                return (
                  <div key={i} className="rec-row">
                    <div>
                      <input
                        className="fdl-input"
                        placeholder="Recipient address"
                        value={r.address}
                        onChange={(e) => handleRecipientChange(i, "address", e.target.value)}
                        style={{ borderColor: addrBad ? "var(--fl-danger)" : "var(--input-border, var(--border))" }}
                      />
                      {addrBad && <div className="error">Invalid address format</div>}
                    </div>
                    <div>
                      <input
                        className="fdl-input"
                        placeholder={symbol ? `Amount of ${symbol}` : "Amount"}
                        inputMode="decimal"
                        value={r.amount}
                        onChange={(e) => handleRecipientChange(i, "amount", e.target.value)}
                        style={{ borderColor: amtBad ? "var(--fl-danger)" : "var(--input-border, var(--border))" }}
                      />
                    </div>
                  </div>
                );
              })}
              <div>
                <button type="button" className="button button-secondary" onClick={addRecipientRow}>
                  + Add recipient
                </button>
              </div>
            </div>

            {/* Summary */}
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                fontSize: 12,
                background: "var(--fl-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 10,
                marginTop: 6,
                alignItems: "baseline",
              }}
            >
              <div className="muted"><b>Wallets/Addresses:</b> {validRecipientRows.length}</div>
              <div className="muted"><b>Total distributed:</b> {withCommas(String(distributedHuman))} ${symbol || "TOKENS"}</div>
              {!overAllocated && (
                <div className="muted"><b>Remaining minted to you:</b> {remainingHuman} ${symbol || "TOKENS"}</div>
              )}
              {overAllocated && (
                <div style={{ color: "var(--fl-danger)" }}>
                  <b>Over by:</b>{" "}
                  {withCommas(formatUnits(distributedWei - supplyWei, decimals).replace(/\.0+$/, ""))} {symbol || "TOKENS"} — reduce amounts.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* CTA */}
        <button
          type="submit"
          className="button button-primary"
          disabled={!formReady || isPending}
          title={formReady ? "All set" : nextIssue || undefined}
          style={{ width: "100%" }}
        >
          {formReady ? (isPending ? "Launching..." : "Create Token") : (nextIssue || "Complete all fields to create")}
        </button>
      </form>

      {status && <div style={{ marginTop: 12, color: "var(--text)" }}>{status}</div>}
    </div>
  );
}
