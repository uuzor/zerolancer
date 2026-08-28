import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useConfig } from "../context/ConfigContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Money } from "../components/Alden.js";

type Step = "spec" | "payment" | "review";

export default function TaskCreate() {
  const { address } = useAuth();
  const config = useConfig();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("spec");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Code");
  const [repoUrl, setRepoUrl] = useState("");
  const [reward, setReward] = useState("100000000");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toUnix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000).toString();

  const canNext = () => {
    if (step === "spec") return title.trim().length > 0;
    if (step === "payment") return reward.length > 0 && Number(reward) > 0 && deadline.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const deadlineUnix = toUnix(deadline);
      const res = await api<{ calldata: any; to: string; nextTaskId: string }>("/v1/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          specHash: `0x${"0".repeat(64)}`,
          category,
          paymentToken: config.addresses.mockUsdc,
          reward,
          deadline: deadlineUnix,
          repoUrl,
          issueNumber: 0,
          coverageGateBps: 8000,
        }),
      });
      // MVP: show calldata for manual signing; replace with wagmi useSendTransaction
      alert(`Task created! ID: ${res.nextTaskId}\n\nSign this transaction in your wallet:\nTo: ${res.to}\nData: ${res.calldata}`);
      navigate(`/tasks/${res.nextTaskId}`);
    } catch (e: any) {
      setError(e.message ?? "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="zl-section">
      <div className="zl-container" style={{ maxWidth: 720 }}>
        <h1 className="zl-text-heading" style={{ margin: 0, lineHeight: "var(--leading-heading)", letterSpacing: "var(--tracking-heading)" }}>
          Create a Task
        </h1>
        <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Post paid work to the marketplace. Funds are held in escrow until verified delivery.</p>

        <div className="zl-tabs" style={{ marginTop: 32 }}>
          {(["spec", "payment", "review"] as Step[]).map((s) => (
            <button key={s} className={`zl-tab ${step === s ? "zl-tab--active" : ""}`} onClick={() => canNext() && setStep(s)}>
              {s === "spec" ? "1. Spec" : s === "payment" ? "2. Payment" : "3. Review"}
            </button>
          ))}
        </div>

        <div className="zl-card" style={{ marginTop: 24 }}>
          {step === "spec" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="zl-label">Title</label>
                <input className="zl-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a React component library" />
              </div>
              <div>
                <label className="zl-label">Description</label>
                <textarea className="zl-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the deliverable, acceptance criteria, and any constraints…" />
              </div>
              <div>
                <label className="zl-label">Category</label>
                <select className="zl-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Code</option>
                  <option>Design</option>
                  <option>Content</option>
                  <option>Community</option>
                </select>
              </div>
              <div>
                <label className="zl-label">GitHub repo URL</label>
                <input className="zl-input" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" />
              </div>
            </div>
          )}

          {step === "payment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="zl-label">Reward (USDC, 6 decimals)</label>
                <input className="zl-input" value={reward} onChange={(e) => setReward(e.target.value)} placeholder="100000000 = 100 USDC" />
                <p className="zl-hint">Enter the raw USDC amount. 1 USDC = 1,000,000 units.</p>
              </div>
              <div>
                <label className="zl-label">Deadline</label>
                <input className="zl-input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </div>
          )}

          {step === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                <div><strong>Title:</strong> {title}</div>
                <div><strong>Category:</strong> {category}</div>
                <div><strong>Reward:</strong> <Money value={reward} token="USDC" /></div>
                <div><strong>Deadline:</strong> {deadline ? new Date(deadline).toLocaleString() : "—"}</div>
                <div><strong>Repo:</strong> {repoUrl || "—"}</div>
              </div>
              <p style={{ color: "var(--color-graphite)", fontSize: 13 }}>
                Creating a task will deploy an on-chain task registry entry. You will need to approve and deposit USDC to fund escrow.
              </p>
            </div>
          )}

          {error && <p className="zl-error">{error}</p>}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
            <Button variant="ghost" disabled={step === "spec"} onClick={() => setStep(step === "spec" ? "spec" : step === "payment" ? "spec" : "payment")}>Back</Button>
            {step !== "review" ? (
              <Button disabled={!canNext()} onClick={() => setStep(step === "spec" ? "payment" : "review")}>Next</Button>
            ) : (
              <Button disabled={submitting} onClick={handleSubmit}>{submitting ? "Creating…" : "Sign & Create"}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
