import { useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, isAddress, formatUnits } from "viem";
import { FACTORY_ABI } from "../lib/factoryAbi";

const FACTORY_ADDRESS = "0x072700cCF5177b30BCB5fac3B6c652a0c8b9460a" as `0x${string}`;

type DistType = "single" | "multi" | null;

/* -----------------------------
   Stable presentational components
   ----------------------------- */
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

/* -----------------------------
   Main component
   ----------------------------- */
export default function LaunchERC20() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  // ---- state ----
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

  // ---- formatting helpers (match FareDrop vibe) ----
  const withCommas = (s: string) => {
    const [w, f] = s.split(".");
    const whole = (w || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return f ? `${whole}.${f}` : whole;
  };
  function formatWithCommas(value: string) {
    const clean = value.replace(/,/g, "").replace(/[^\d.]/g, "");
    if ((clean.match(/\./g) || []).length > 1) return totalSupply; // keep prior if user typed 2nd dot
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

  // ---- validation primitives ----
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
  const webHelp = websiteHint(website); // NOT gating

  const validRecipientRows = useMemo(
    () =>
      recipients.filter(
        (r) => r.address && isAddress(r.address) && Number((r.amount || "0").replace(/,/g, "")) > 0
      ),
    [recipients]
  );

  // ---- totals (human + wei) ----
  const distributedHuman = useMemo(
    () =>
      validRecipientRows.reduce(
        (acc, r) => acc + Number((r.amount || "0").replace(/,/g, "")),
        0
      ),
    [validRecipientRows]
  );

  // For correctness, do comparisons in wei using parseUnits (avoids JS float issues)
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
  const remainingWei = distributionType === "multi" && supplyWei > distributedWei ? (supplyWei - distributedWei) : 0n;
  const remainingHuman = useMemo(() => {
    try {
      return withCommas(formatUnits(remainingWei, decimals).replace(/\.0+$/, ""));
    } catch {
      return "0";
    }
  }, [remainingWei]);

  // ---- progressive gating ----

  // ---- CTA message / readiness ----
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

  // ---- submit ----
  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    if (!formReady) return;
    setStatus(null);

    const finalRecipients: `0x${string}`[] = [];
    const finalAmounts: bigint[] = [];

    if (distributionType === "single" && address) {
      // 100% to connected wallet
      finalRecipients.push(address as `0x${string}`);
      finalAmounts.push(parseUnits(cleanSupplyText, decimals));
    } else {
      // multiple wallets
      for (const r of validRecipientRows) {
        finalRecipients.push(r.address as `0x${string}`);
        finalAmounts.push(parseUnits((r.amount || "0").replace(/,/g, ""), decimals));
      }
      // If under-allocated, mint remainder to connected wallet
      if (remainingWei > 0n && address) {
        finalRecipients.push(address as `0x${string}`);
        finalAmounts.push(remainingWei);
      }
    }

    try {
      const txHash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createToken",
        args: [name.trim(), symbol.trim(), decimals, website.trim(), finalRecipients, finalAmounts],
      });
      setStatus(`Transaction sent: ${txHash}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err?.shortMessage || err?.message || "Failed to launch"}`);
    }
  }

  // ---- UI ----
  return (
    <div className="tool-container fdl-pad" style={{ maxWidth: 640, margin: "0 auto" }}>
      <style>{`
        .tool-title { margin: 0 0 12px; }
        .muted { opacity: .8; font-size: 12px; }
        input, textarea, select {
          background: var(--fl-bg);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 12px;
          outline: none;
          width: 100%;
        }
        .error { color: var(--fl-danger, #c62828); font-size: 12px; margin-top: 4px; }
        .btn {
          padding: 12px;
          border-radius: var(--radius);
          border: none;
          font-weight: 800;
          box-shadow: var(--shadow);
          transition: background 120ms ease, transform 120ms ease;
        }
        .btn:not([disabled]) { cursor: pointer; }
        .btn[disabled] {
          background: #777 !important;
          color: #fff !important;
          cursor: not-allowed !important;
          opacity: .8;
        }
        .btn-primary { background: var(--fl-gold); color: #000; }
        .btn-primary:not([disabled]):hover,
        .btn-primary:not([disabled]):focus-visible {
          background: #e6a800;
          transform: translateY(-1px);
        }
        .btn-secondary {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text);
          font-weight: 700;
          padding: 10px 12px;
          border-radius: 12px;
          cursor: pointer;
        }
        .rec-row { display: grid; grid-template-columns: 1fr 160px; gap: 8px; }
        @media (max-width: 560px) { .rec-row { grid-template-columns: 1fr; } }
      `}</style>

      <h1 className="tool-title">Launch Your ERC-20 Token</h1>

      {/* SINGLE FORM WRAPS EVERYTHING to prevent focus loss */}
      <form onSubmit={handleLaunch}>
        {/* STEP 1: Name */}
        <Card title="1) Token name">
          <input
            placeholder="My Token"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ borderColor: name && !nameOk ? "var(--fl-danger)" : "var(--border)" }}
          />
          {name && !nameOk && <div className="error">Name must be at least 2 characters.</div>}
        </Card>

        {/* STEP 2: Symbol */}
        {nameOk && (
          <Card title="2) Token symbol">
            <input
              placeholder="MTK"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 6))}
              style={{ borderColor: symbol && !symbolOk ? "var(--fl-danger)" : "var(--border)" }}
            />
            <div className="muted">This is your "ticker". It must be 1–6 letters/numbers, e.g., MTK</div>
            {symbol && !symbolOk && <div className="error">Only A–Z and 0–9, max 6 chars.</div>}
          </Card>
        )}

        {/* STEP 3: Total supply */}
        {nameOk && symbolOk && (
          <Card title="3) Total supply">
            <input
              placeholder="1,000,000"
              inputMode="decimal"
              value={totalSupply}
              onChange={(e) => setTotalSupply(formatWithCommas(e.target.value))}
              style={{ borderColor: totalSupply && !supplyOk ? "var(--fl-danger)" : "var(--border)" }}
            />
            <div className="muted">No more than {decimals} decimals.</div>
            {totalSupply && !supplyOk && <div className="error">Enter a number greater than 1.</div>}
          </Card>
        )}

        {/* OPTIONAL: Website */}
        {nameOk && symbolOk && supplyOk && (
          <Card title="Website (optional):">
            <input
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
            {website && webHelp && <div className="error">{webHelp}</div>}
          </Card>
        )}

        {/* STEP 4: Distribution */}
        {nameOk && symbolOk && supplyOk && (
          <Card title="4) Distribution">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <DistCard
                active={distributionType === "single"}
                onClick={() => setDistributionType("single")}
                title="Mint to myself"
                subtitle={<span className="muted">{address || "Connect wallet"}</span>}
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

        {/* STEP 5: Recipients */}
        {distributionType === "multi" && (
          <Card title="5) Recipients">
            <div style={{ display: "grid", gap: 8 }}>
              {recipients.map((r, i) => {
                const addrBad = r.address && !isAddress(r.address);
                const amtBad = r.amount && !(Number(r.amount.replace(/,/g, "")) > 0);
                return (
                  <div key={i} className="rec-row">
                    <div>
                      <input
                        placeholder="Recipient address"
                        value={r.address}
                        onChange={(e) => handleRecipientChange(i, "address", e.target.value)}
                        style={{ borderColor: addrBad ? "var(--fl-danger)" : "var(--border)" }}
                      />
                      {addrBad && <div className="error">Invalid address format</div>}
                    </div>
                    <div>
                      <input
                        className="amt"
                        placeholder={symbol ? `Amount of $${symbol}` : "Amount"}
                        inputMode="decimal"
                        value={r.amount}
                        onChange={(e) => handleRecipientChange(i, "amount", e.target.value)}
                        style={{ borderColor: amtBad ? "var(--fl-danger)" : "var(--border)" }}
                      />
                    </div>
                  </div>
                );
              })}
              <div>
                <button type="button" className="btn-secondary" onClick={addRecipientRow}>
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
              <div className="muted">
                <b>Wallets/Addresses:</b> {validRecipientRows.length}
              </div>
              <div className="muted">
                <b>Total distributed:</b> {withCommas(String(distributedHuman))} ${symbol || "TOKENS"}
              </div>
              {!overAllocated && (
                <div className="muted">
                  <b>Remaining minted to you:</b> {remainingHuman} ${symbol || "TOKENS"}
                </div>
              )}
              {overAllocated && (
                <div style={{ color: "var(--fl-danger)" }}>
                  <b>Over by:</b>{" "}
                  {withCommas(
                    formatUnits(distributedWei - supplyWei, decimals).replace(/\.0+$/, "")
                  )}{" "}
                  {symbol || "TOKENS"} — reduce amounts.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* CTA */}
        <button
          type="submit"
          className={`btn ${formReady && !isPending ? "btn-primary" : ""}`}
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
