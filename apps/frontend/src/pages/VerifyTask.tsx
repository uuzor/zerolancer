import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useSendTransaction } from "wagmi";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Empty, ErrorPane } from "../components/Alden.js";

type VerificationResult = {
  verdict: { passed: boolean; score: string; signature: string };
  verification: { score: string; reason: string; artifacts?: Record<string, any> };
  signer: string;
};

export default function VerifyTask() {
  const { taskId } = useParams<{ taskId: string }>();
  const { connected } = useAuth();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [submitHash, setSubmitHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { sendTransaction } = useSendTransaction();

  const handleVerify = async () => {
    if (!taskId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<VerificationResult>("/v1/verification/verify", {
        method: "POST",
        body: JSON.stringify({ taskId }),
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitVerdict = async () => {
    if (!taskId || !result) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ txHash: string }>("/v1/verification/submit", {
        method: "POST",
        body: JSON.stringify({ verdict: result.verdict }),
      });
      setSubmitHash(res.txHash);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!taskId) return <ErrorPane message="Missing task id" />;

  return (
    <div className="zl-container" style={{ padding: "40px 32px" }}>
      <h1 style={{ fontSize: "var(--text-heading-sm)", margin: "0 0 24px" }}>Verification</h1>

      <div className="zl-card" style={{ maxWidth: 640 }}>
        {error && <ErrorPane message={error} retry={() => setError(null)} />}

        {!result && (
          <div>
            <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
              Trigger the AI + CI verification pipeline for this task.
            </p>
            {!connected ? (
              <p style={{ color: "var(--color-graphite)" }}>Connect wallet to verify.</p>
            ) : (
              <Button onClick={handleVerify} disabled={busy}>
                {busy ? "Running…" : "Run Verification"}
              </Button>
            )}
          </div>
        )}

        {result && (
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <Pill variant={result.verdict.passed ? "success" : "danger"}>
                {result.verdict.passed ? "Passed" : "Failed"}
              </Pill>
              <span style={{ fontSize: 14, color: "var(--color-graphite)" }}>
                Score: {result.verification.score}
              </span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span className="zl-label">Reason</span>
              <p style={{ margin: "4px 0 0", fontSize: 14 }}>{result.verification.reason}</p>
            </div>

            {result.verification.artifacts && (
              <div style={{ marginBottom: 16 }}>
                <span className="zl-label">Artifacts</span>
                <pre style={{ background: "var(--surface-parchment)", padding: 12, borderRadius: "var(--radius-smallui)", fontSize: 12, overflow: "auto" }}>
                  {JSON.stringify(result.verification.artifacts, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <span className="zl-label">Signer</span>
              <p style={{ margin: "4px 0 0", fontSize: 14 }}>{result.signer}</p>
            </div>

            {!submitHash && result.verdict.passed && (
              <Button onClick={handleSubmitVerdict} disabled={busy}>
                {busy ? "Submitting…" : "Submit to Chain"}
              </Button>
            )}

            {submitHash && (
              <div>
                <Pill variant="success">Submitted</Pill>
                <p style={{ fontSize: 13, color: "var(--color-graphite)", marginTop: 8 }}>Tx: {submitHash.slice(0, 18)}…</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
