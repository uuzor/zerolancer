import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useSendTransaction } from "wagmi";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export default function AssignFreelancer() {
  const { taskId } = useParams<{ taskId: string }>();
  const { connected } = useAuth();
  const [freelancer, setFreelancer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { sendTransaction } = useSendTransaction();

  const handleAssign = async () => {
    if (!taskId || !freelancer) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ calldata: string; to: string }>("/v1/tasks/assign", {
        method: "POST",
        body: JSON.stringify({ taskId, freelancer }),
      });
      await sendTransaction({ to: res.to as `0x${string}`, data: res.calldata as `0x${string}` });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!taskId) return <ErrorPane message="Missing task id" />;

  return (
    <div className="zl-container" style={{ padding: "40px 32px" }}>
      <h1 style={{ fontSize: "var(--text-heading-sm)", margin: "0 0 24px" }}>Assign Freelancer</h1>

      <div className="zl-card" style={{ maxWidth: 640 }}>
        {done ? (
          <div>
            <Pill variant="success">Assigned</Pill>
            <p style={{ color: "var(--color-graphite)", marginTop: 12 }}>Freelancer assigned successfully.</p>
            <Link to={`/tasks/${taskId}`}><Button variant="primary">Go to Workspace</Button></Link>
          </div>
        ) : (
          <>
            <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
              Enter the wallet address of the freelancer to assign this task.
            </p>
            {error && <ErrorPane message={error} />}
            <div style={{ marginTop: 16 }}>
              <label className="zl-label">Freelancer address</label>
              <input
                className="zl-input"
                value={freelancer}
                onChange={(e) => setFreelancer(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <div style={{ marginTop: 24 }}>
              <Button onClick={handleAssign} disabled={busy || !freelancer || !connected}>
                {busy ? "Assigning…" : "Assign Freelancer"}
              </Button>
              {!connected && <p className="zl-hint" style={{ marginTop: 8 }}>Connect wallet to assign.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
