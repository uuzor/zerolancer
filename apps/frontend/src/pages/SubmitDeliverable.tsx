import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useSendTransaction } from "wagmi";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Empty, ErrorPane } from "../components/Alden.js";

export default function SubmitDeliverable() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { connected } = useAuth();
  const [prUrl, setPrUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { sendTransaction } = useSendTransaction();

  const derivePrNumber = (url: string): number | undefined => {
    const m = url.match(/\/(?:pull|pulls)\/(\d+)/);
    return m ? Number(m[1]) : undefined;
  };

  const handleSubmit = async () => {
    if (!taskId || !prUrl) return;
    setError(null);
    const prNumber = derivePrNumber(prUrl);
    try {
      const res = await api<{ calldata: string; to: string }>("/v1/tasks/submit", {
        method: "POST",
        body: JSON.stringify({ taskId, deliverableRef: prUrl, prNumber }),
      });
      await sendTransaction({ to: res.to as `0x${string}`, data: res.calldata as `0x${string}` });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!taskId) return <ErrorPane message="Missing task id" />;

  return (
    <div className="zl-container" style={{ padding: "40px 32px" }}>
      <h1 style={{ fontSize: "var(--text-heading-sm)", margin: "0 0 24px" }}>Submit Deliverable</h1>

      <div className="zl-card" style={{ maxWidth: 640 }}>
        {error && <ErrorPane message={error} retry={() => setError(null)} />}

        {done ? (
          <div>
            <Empty
              title="Deliverable submitted"
              description="The freelancer has submitted the deliverable. Verification will run automatically."
              action={<Button onClick={() => navigate(`/tasks/${taskId}`)} variant="primary">Go to Workspace</Button>}
            />
          </div>
        ) : (
          <div>
            <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
              Link the GitHub pull request that contains your work.
            </p>

            <label className="zl-label" htmlFor="prUrl">Pull request URL</label>
            <input
              id="prUrl"
              className="zl-input"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
            />
            <p className="zl-hint">The PR number will be auto-detected from the URL.</p>

            <div style={{ marginTop: 16 }}>
              {!connected ? (
                <p style={{ color: "var(--color-graphite)" }}>Connect wallet to submit.</p>
              ) : (
                <Button onClick={handleSubmit} disabled={!prUrl}>
                  Submit Deliverable
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
