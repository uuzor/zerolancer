import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { ZEROLANCE_WAVE_ISSUE_ABI } from "../abis.js";
import { useReadContract, useWriteContract } from "wagmi";
import { Button, Pill, Address, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";
import type { IssueState } from "../lib/types.js";

type Tab = "description" | "points" | "activity";

const STATE_LABEL: Record<IssueState, string> = {
  Created: "Created",
  Claimed: "Claimed",
  PrSubmitted: "PR Submitted",
  Awarded: "Awarded",
  Closed: "Closed",
};

const STATE_VARIANT: Record<IssueState, "default" | "accent" | "success" | "warning" | "danger"> = {
  Created: "default",
  Claimed: "accent",
  PrSubmitted: "warning",
  Awarded: "success",
  Closed: "default",
};

export default function IssueDetail() {
  const { issueId } = useParams();
  const config = useConfig();
  const { address, connected } = useAuth();
  const [tab, setTab] = useState<Tab>("description");
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const issueAddress = config.addresses.waveIssue;

  const { data: issueData } = useReadContract({
    address: issueAddress as `0x${string}` | undefined,
    abi: ZEROLANCE_WAVE_ISSUE_ABI,
    functionName: "issue",
    args: issueId ? [BigInt(issueId)] : undefined,
    query: { enabled: !!issueAddress && !!issueId },
  });

  const { writeContract } = useWriteContract();

  useEffect(() => {
    if (!issueId) return;
    let cancelled = false;
    setLoading(true);
    api<any>(`/v1/wave/issue/${issueId}`)
      .then((res) => {
        if (!cancelled) setIssue(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [issueId]);

  const resolved = issueData || issue;
  const state = resolved?.state as IssueState | undefined;

  const isBuilder = connected && address && resolved?.builder && address.toLowerCase() === resolved.builder.toLowerCase();
  const isMaintainer = connected && address && resolved?.maintainer && address.toLowerCase() === resolved.maintainer.toLowerCase();

  const handleClaim = () => {
    if (!issueId || !issueAddress) return;
    setActing(true);
    writeContract({
      address: issueAddress as `0x${string}`,
      abi: ZEROLANCE_WAVE_ISSUE_ABI,
      functionName: "claimIssue",
      args: [BigInt(issueId)],
    });
    setActing(false);
  };

  const handleSubmitPr = () => {
    if (!issueId || !issueAddress) return;
    const deliverableHash = prompt("Deliverable hash (bytes32):");
    const prNumber = prompt("PR number:");
    if (!deliverableHash || !prNumber) return;
    setActing(true);
    writeContract({
      address: issueAddress as `0x${string}`,
      abi: ZEROLANCE_WAVE_ISSUE_ABI,
      functionName: "submitPr",
      args: [BigInt(issueId), deliverableHash as `0x${string}`, BigInt(prNumber)],
    });
    setActing(false);
  };

  const handleConfirmMerge = () => {
    if (!issueId || !issueAddress) return;
    setActing(true);
    writeContract({
      address: issueAddress as `0x${string}`,
      abi: ZEROLANCE_WAVE_ISSUE_ABI,
      functionName: "confirmMerge",
      args: [BigInt(issueId)],
    });
    setActing(false);
  };

  const handleAddCompliment = () => {
    if (!issueId || !issueAddress) return;
    const points = prompt("Compliment points:");
    if (!points) return;
    setActing(true);
    writeContract({
      address: issueAddress as `0x${string}`,
      abi: ZEROLANCE_WAVE_ISSUE_ABI,
      functionName: "addCompliment",
      args: [BigInt(issueId), BigInt(points)],
    });
    setActing(false);
  };

  if (!issueAddress) {
    return (
      <div className="zl-container" style={{ padding: "80px 32px" }}>
        <Empty title="Issues not configured" description="Wave issue contracts are not deployed on this network." />
      </div>
    );
  }

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;
  if (!resolved) return <div className="zl-container" style={{ padding: "40px 32px" }}><p>Issue not found.</p></div>;

  return (
    <div className="zl-section">
      <div className="zl-container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link to="/issues" style={{ color: "var(--color-graphite)" }}>← Issues</Link>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Issue #{resolved.issueId}</h1>
          <Pill variant={STATE_VARIANT[state ?? "Created"]}>{STATE_LABEL[state ?? "Created"]}</Pill>
        </div>

        <div className="zl-tabs" style={{ marginBottom: 32 }}>
          {(["description", "points", "activity"] as Tab[]).map((t) => (
            <button key={t} className={`zl-tab${tab === t ? " zl-tab--active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "description" && (
          <div className="zl-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Program</span>
                <span>#{resolved.programId}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Maintainer</span>
                <Address value={resolved.maintainer} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Builder</span>
                <Address value={resolved.builder || "Unassigned"} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Base Points</span>
                <span>{resolved.basePoints}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Complexity</span>
                <span>{resolved.complexity}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Delivered PR</span>
                <span>#{resolved.deliveredPr || "—"}</span>
              </div>
            </div>
            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {state === "Created" && isBuilder && (
                <Button onClick={handleClaim} disabled={acting || !connected}>{acting ? "Signing..." : "Claim"}</Button>
              )}
              {state === "Claimed" && isBuilder && (
                <Button onClick={handleSubmitPr} disabled={acting || !connected}>{acting ? "Signing..." : "Submit PR"}</Button>
              )}
              {state === "PrSubmitted" && isMaintainer && (
                <Button onClick={handleConfirmMerge} disabled={acting || !connected}>{acting ? "Signing..." : "Confirm Merge"}</Button>
              )}
              {state === "Awarded" && isMaintainer && (
                <Button onClick={handleAddCompliment} disabled={acting || !connected}>{acting ? "Signing..." : "Add Compliment"}</Button>
              )}
            </div>
          </div>
        )}

        {tab === "points" && (
          <div className="zl-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Base Points</span>
                <span>{resolved.basePoints}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Bonus Points</span>
                <span>{resolved.bonusPoints}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Points Awarded</span>
                <Pill variant={resolved.pointsAwarded ? "success" : "default"}>{resolved.pointsAwarded ? "Yes" : "No"}</Pill>
              </div>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="zl-card">
            <Empty title="Activity" description="Event history will appear here." />
          </div>
        )}
      </div>
    </div>
  );
}
