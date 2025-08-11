import { useState } from "react";
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
  const [distributionType, setDistributionType] = useState<"single" | "multi" | null>(null);

  const [recipients, setRecipients] = useState<{ address: string; amount: string }[]>([
    { address: "", amount: "" }
  ]);

  const [status, setStatus] = useState<string | null>(null);

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

  const isSupplyValid = Number(totalSupply.replace(/,/g, "")) > 1;
  const allAddressesValid =
    distributionType === "single" ||
    recipients.every(r => isAddress(r.address));
  const allAmountsValid =
    distributionType === "single" ||
    recipients.every(r => Number(r.amount.replace(/,/g, "")) > 0);

  const formReady =
    name.trim() &&
    symbol.trim() &&
    isSupplyValid &&
    distributionType &&
    allAddressesValid &&
    allAmountsValid &&
    isConnected;

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
        args: [name, symbol, decimals, website, finalRecipients, finalAmounts],
      });

      setStatus(`Transaction sent: ${txHash}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    }
  }

  return (
    <div className="tool-container">
      <h1 className="tool-title">Launch Your ERC20 Token</h1>

      <form onSubmit={handleLaunch} className="tool-form">
        <label>Token Name</label>
        <input value={name} onChange={e => setName(e.target.value)} required />

        <label>Token Symbol</label>
        <input value={symbol} onChange={e => setSymbol(e.target.value)} required />

        <label>Total Supply</label>
        <input
          value={totalSupply}
          onChange={e => setTotalSupply(formatWithCommas(e.target.value))}
          placeholder="1,000,000"
          required
        />

        <label>Website (optional)</label>
        <input value={website} onChange={e => setWebsite(e.target.value)} />

        {/* Distribution Type - only if supply is valid */}
        {isSupplyValid && (
          <>
            <label>Distribution</label>
            <div style={{ display: "flex", gap: 12 }}>
              <div
                onClick={() => setDistributionType("single")}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: distributionType === "single" ? "2px solid var(--fl-gold)" : "1px solid var(--border)",
                  background: distributionType === "single" ? "rgba(255,184,46,0.1)" : "transparent"
                }}
              >
                <strong>Mint to Myself</strong>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {address || "Connect wallet"}
                </div>
              </div>
              <div
                onClick={() => setDistributionType("multi")}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: distributionType === "multi" ? "2px solid var(--fl-gold)" : "1px solid var(--border)",
                  background: distributionType === "multi" ? "rgba(255,184,46,0.1)" : "transparent"
                }}
              >
                <strong>Multiple Wallets</strong>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Split supply across recipients
                </div>
              </div>
            </div>
          </>
        )}

        {distributionType === "multi" && (
          <div style={{ marginTop: 12 }}>
            {recipients.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <input
                    placeholder="Recipient address"
                    value={r.address}
                    onChange={e => handleRecipientChange(i, "address", e.target.value)}
                    style={{
                      borderColor: r.address && !isAddress(r.address) ? "var(--fl-danger)" : undefined
                    }}
                  />
                  {r.address && !isAddress(r.address) && (
                    <div style={{ color: "var(--fl-danger)", fontSize: 12 }}>
                      Invalid address format
                    </div>
                  )}
                </div>
                <input
                  style={{ width: 160 }}
                  placeholder={`Amount${symbol ? ` of $${symbol}` : ""}`}
                  value={r.amount}
                  onChange={e => handleRecipientChange(i, "amount", e.target.value)}
                />
              </div>
            ))}
            <button type="button" onClick={addRecipientRow} style={{ marginTop: 8 }}>
              + Add Recipient
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={!formReady || isPending}
          style={{
            marginTop: 20,
            background: formReady ? "var(--fl-gold)" : "#777",
            cursor: formReady ? "pointer" : "not-allowed"
          }}
        >
          {formReady ? (isPending ? "Launching..." : "Create Token") : "Complete all fields to create"}
        </button>
      </form>

      {status && <p className="status">{status}</p>}
    </div>
  );
}
