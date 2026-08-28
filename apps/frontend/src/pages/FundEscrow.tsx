import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useSendTransaction } from "wagmi";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Money, Countdown, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

type Step = "approve" | "deposit" | "done";

export default function FundEscrow() {
  const { taskId } = useParams<{ taskId: string }>();
  const { connected } = useAuth();
  const [step, setStep] = useState<Step>("approve");
  const [reward, setReward] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { sendTransaction } = useSendTransaction();

  const loadReward = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await api<{ events: any[] }>(`/v1/events/${taskId}?eventName=TaskCreated`);
      const ev = res.events?.[0];
      if (ev?.payload?.reward) setReward(ev.payload.reward);
    } catch {}
  }, [taskId]);

  useEffect(() => {
    void loadReward();
  }, [loadReward]);

  const handleApprove = async () => {
    if (!taskId || !reward) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ calldata: string; to: string }>("/v1/escrow/approve", {
        method: "POST",
        body: JSON.stringify({ amount: reward }),
      });
      await sendTransaction({ to: res.to as `0x${string}`, data: res.calldata as `0x${string}` });
      setStep("deposit");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeposit = async () => {
    if (!taskId || !reward) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ calldata: string; to: string }>("/v1/escrow/deposit", {
        method: "POST",
        body: JSON.stringify({ amount: reward, taskId }),
      });
      await sendTransaction({ to: res.to as `0x${string}`, data: res.calldata as `0x${string}` });
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!taskId) return <ErrorPane message="Missing task id" />;

  return (
    <div className="zl-container" style={{ padding: "40px 32px" }}>
      <h1 style={{ fontSize: "var(--text-heading-sm)", margin: "0 0 24px" }}>Fund Escrow</h1>

      <div className="zl-card" style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: step === "approve" ? "var(--color-sage-action)" : "var(--color-fog-border)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontWeight: 600
            }}>1</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Approve</div>
          </div>
          <div style={{ width: 40, borderTop: `2px solid ${step === "deposit" || step === "done" ? "var(--color-ink-black)" : "var(--color-fog-border)"}`, marginTop: 20 }} />
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: step === "deposit" || step === "done" ? "var(--color-sage-action)" : "var(--color-fog-border)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontWeight: 600
            }}>2</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Deposit</div>
          </div>
        </div>

        {error && <ErrorPane message={error} retry={() => setError(null)} />}

        {step === "approve" && (
          <div>
            <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
              Approve the escrow vault to pull <Money value={reward} token="USDC" /> from your wallet.
            </p>
            {!connected ? (
              <p style={{ color: "var(--color-graphite)" }}>Connect wallet to continue.</p>
            ) : (
              <Button onClick={handleApprove} disabled={busy || !reward}>
                {busy ? "Approving…" : "Approve USDC"}
              </Button>
            )}
          </div>
        )}

        {step === "deposit" && (
          <div>
            <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
              Deposit <Money value={reward} token="USDC" /> into escrow for task {taskId}.
            </p>
            {!connected ? (
              <p style={{ color: "var(--color-graphite)" }}>Connect wallet to continue.</p>
            ) : (
              <Button onClick={handleDeposit} disabled={busy}>
                {busy ? "Depositing…" : "Deposit to Escrow"}
              </Button>
            )}
          </div>
        )}

        {step === "done" && (
          <div>
            <Pill variant="success">Escrow funded</Pill>
            {txHash && <p style={{ fontSize: 13, color: "var(--color-graphite)", marginTop: 8 }}>Tx: {txHash.slice(0, 18)}…</p>}
            <div style={{ marginTop: 16 }}>
              <a href={`/tasks/${taskId}`} style={{ textDecoration: "none" }}><Button variant="primary">Go to Workspace</Button></a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
