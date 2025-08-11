import { useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, isAddress } from "viem";
import { FACTORY_ABI } from "../lib/factoryAbi";

const FACTORY_ADDRESS = "0x072700cCF5177b30BCB5fac3B6c652a0c8b9460a" as `0x${string}`;

export default function LaunchERC20() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const decimals = 18;
  const [website, setWebsite] = useState("");

  const [totalSupply, setTotalSupply] = useState("");
  const [distributionType, setDistributionType] =
    useState<"single" | "multi" | null>(null);

  const [recipients, setRecipients] = useState<{ address: string; amount: string }[]>([
    { address: "", amount: "" }
  ]);

  const [status, setStatus] = useState<string | null>(null);

  // ---------- formatting ----------
  function formatWithCommas(value: string) {
    const clean = value.replace(/,/g, "").replace(/\D/g, "");
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function handleRecipientChange(index: number, field: "address" | "amount", value: string) {
    const updated = [...recipients];
    updated[index][field] = field === "amount" ? formatWithCommas(value) : value;
    setRecipients(updated);
  }
  function addRecipientRow() {
    setRecipients([...recipients, { address: "", amount: "" }]);
  }
  function removeRecipient(index: number) {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  }

  // ---------- helpers / validation ----------
  const symbolOk = /^[A-Z0-9]{1,6}$/.test(symbol.trim());
  const nameOk = name.trim().length >= 2;

  const numericSupply = Number(totalSupply.replace(/,/g, ""));
  const supplyOk = Number.isFinite(numericSupply) && numericSupply > 1;

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
    return null; // http or https both OK
  }
  const webHelp = websiteHint(website); // shown, but NOT gating

  const allAddressesValid =
    distributionType === "single" || recipients.every(r => r.address && isAddress(r.address));

  const allAmountsValid =
    distributionType === "single" || recipients.every(r => Number(r.amount.replace(/,/g, "")) > 0);

  // Dynamic next step message (order ignores website)
  const nextIssue = useMemo(() => {
    if (!nameOk) return "Enter a token name";
    if (!symbolOk) return "Enter a Token Symbol";
    if (!supplyOk) return "Enter a total supply";
    if (!distributionType) return "Choose a distribution option";
    if (distributionType === "multi" && !allAddressesValid) return "Fix recipient addresses";
    if (distributionType === "multi" && !allAmountsValid) return "Enter recipient amounts (> 0)";
    if (!isConnected) return "Connect your wallet";
    return null;
  }, [nameOk, symbolOk, supplyOk, distributionType, allAddressesValid, allAmountsValid, isConnected]);

  const formReady = nextIssue === null;

  // ---------- submit ----------
  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    if (!formReady) return;
    setStatus(null);

    let finalRecipients: `0x${string}`[] = [];
    let finalAmounts: bigint[] = [];

    if (distributionType === "single" && address) {
      finalRecipients = [address as `0x${string}`];
      finalAmounts = [parseUnits(totalSupply.replace(/,/g, ""), decimals)];
    } else {
      for (const r of recipients) {
        finalRecipients.push(r.address as `0x${string}`);
        finalAmounts.push(parseUnits(r.amount.replace(/,/g, ""), decimals));
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
      setStatus(`Error: ${err.message}`);
    }
  }
  return (
    <div className="tool-container">
      <style>{`
        .tool-title { margin: 0 0 12px; }
        .tool-form { display: grid; gap: 8px; max-width: 640px; margin: 0 auto; }
        .dist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .dist-card { padding: 12px; border-radius: 12px; cursor: pointer; }
        .dist-card strong { display: block; margin-bottom: 4px; }
        .muted { opacity: 0.8; font-size: 12px; }
        .addr { word-break: break-all; }
        .rec-list { display: grid; gap: 8px; }
        .rec-row { display: grid; grid-template-columns: 1fr 160px; gap: 8px; }
        .rec-row .amt { width: 100%; }
        @media (max-width: 560px) {
          .dist-grid { grid-template-columns: 1fr; }
          .rec-row { grid-template-columns: 1fr; }
        }
          /* Always grey-out disabled buttons */
button:disabled,
.btn-primary:disabled,
.btn-disabled {
  background: #777 !important;
  color: #fff !important;
  cursor: not-allowed !important;
  opacity: 0.65;
}
  :root {
  --fl-blue: #3B82F6;      /* your blue */
  --fl-blue-hover: #2563EB; /* a slightly darker blue */
}
/* FORCE hover to your blue (beats any global .button:hover) */
button.btn-primary:not(:disabled):hover,
button.btn-primary:not(:disabled):focus-visible {
  background: var(--fl-blue-hover) !important;
  color: #fff !important;
  filter: none !important;
  transition: background 120ms ease;
}
  .btn-secondary {
  margin-top: 4px !important;
  border: 1px solid var(--fl-blue);
  color: var(--fl-blue);
  background: transparent;
  border-radius: 12px;
  padding: 8px 12px;
}

.btn-secondary:hover,
.btn-secondary:focus-visible {
  background: var(--fl-blue-hover) !important;
  border-color: var(--fl-blue-hover) !important;
  color: #fff !important;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}
  label {
  margin-top: 4px !important;
  }
        .btn-primary {
          border-radius: 12px;
          padding: 12px 16px;
          border: none;
          color: #000;
          background: var(--fl-gold);
        }
        .btn-disabled {
          margin-top: 4px !important;
          border-radius: 12px;
          padding: 12px 16px;
          border: none;
          color: #fff;
          background: #777;
          cursor: not-allowed;
        }
        .error { color: var(--fl-danger, #c62828); font-size: 12px; margin-top: 4px !important; }
        input, textarea {
          background: var(--input-bg);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 12px;
          outline: none;
        }
      `}</style>

      <h1 className="tool-title">Launch Your ERC20 Token</h1>

      <form onSubmit={handleLaunch} className="tool-form">
        <label>Token Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My Token"
          required
        />

        <label>Token Symbol</label>
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="MTK"
          required
        />

        <label>Total Supply</label>
        <input
          value={totalSupply}
          onChange={e => setTotalSupply(formatWithCommas(e.target.value))}
          placeholder="1,000,000"
          inputMode="numeric"
          required
        />

        <label>Website (optional)</label>
        <input
          value={website}
          onChange={e => setWebsite(e.target.value)}
          placeholder="https://example.com"
        />
        {website && webHelp && <div className="error">{webHelp}</div>}

        {/* Distribution Type - only if supply is valid */}
        {supplyOk && (
          <>
            <label>Distribution</label>
            <div className="dist-grid">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDistributionType("single")}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setDistributionType("single")}
                className="dist-card"
                style={{
                  border: distributionType === "single" ? "2px solid var(--fl-gold)" : "1px solid var(--border)",
                  background: distributionType === "single" ? "rgba(255,184,46,0.12)" : "transparent"
                }}
              >
                <strong>Mint to Myself</strong>
                <div className="muted addr">{address || "Connect wallet"}</div>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDistributionType("multi")}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setDistributionType("multi")}
                className="dist-card"
                style={{
                  border: distributionType === "multi" ? "2px solid var(--fl-gold)" : "1px solid var(--border)",
                  background: distributionType === "multi" ? "rgba(255,184,46,0.12)" : "transparent"
                }}
              >
                <strong>Multiple Wallets</strong>
                <div className="muted">Split supply across recipients</div>
              </div>
            </div>
          </>
        )}

        {distributionType === "multi" && (
          <div className="rec-list">
            {recipients.map((r, i) => (
              <div key={i} className="rec-row">
                <div>
                  <input
                    placeholder="Recipient address"
                    value={r.address}
                    onChange={e => handleRecipientChange(i, "address", e.target.value)}
                    style={{
                      borderColor: r.address && !isAddress(r.address) ? "var(--fl-danger)" : undefined
                    }}
                  />
                  {r.address && !isAddress(r.address) && (
                    <div className="error">Invalid address format</div>
                  )}
                </div>
                <input
                  className="amt"
                  placeholder={`Amount${symbol ? ` of $${symbol}` : ""}`}
                  value={r.amount}
                  onChange={e => handleRecipientChange(i, "amount", e.target.value)}
                  inputMode="decimal"
                />
              </div>
            ))}
         <button type="button" onClick={addRecipientRow} className="btn-secondary">
  + Add Recipient
</button>
          </div>
        )}

        <button
          type="submit"
          disabled={!formReady || isPending}
          className={formReady && !isPending ? "btn-primary" : "btn-disabled"}
          title={formReady ? "All set" : nextIssue || undefined}
        >
          {formReady ? (isPending ? "Launching..." : "Create Token") : (nextIssue || "Complete all fields to create")}
        </button>
      </form>

      {status && <p className="status">{status}</p>}
    </div>
  );
}
