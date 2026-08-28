import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Address, Empty, LoadingRows, ErrorPane, Pill, Money, Countdown } from "../components/Alden.js";
import type { Task, EventMessage } from "../lib/types.js";
import { Link } from "react-router-dom";

type Tab = "posted" | "assigned" | "watching";

export default function MyTasks() {
  const { address, connected } = useAuth();
  const [tab, setTab] = useState<Tab>("posted");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<EventMessage[]>("/v1/events?limit=100&eventName=TaskCreated")
      .then((events) => {
        if (cancelled) return;
        const mapped: Task[] = events.map((e) => ({
          taskId: String(e.payload?.taskId ?? e.id),
          client: String(e.payload?.client ?? ""),
          freelancer: String(e.payload?.freelancer ?? ""),
          status: "Open",
          category: "Code",
          specHash: String(e.payload?.specHash ?? ""),
          deliverableHash: "",
          paymentToken: "",
          reward: String(e.payload?.reward ?? "0"),
          deadline: String(e.payload?.deadline ?? "0"),
          createdAt: e.createdAt,
          retryDeadline: "0",
          repoUrl: String(e.payload?.repoUrl ?? ""),
          issueNumber: String(e.payload?.issueNumber ?? "0"),
          prNumber: "0",
          coverageGateBps: "8000",
        }));
        setTasks(mapped);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = tasks.filter((t) => {
    if (!address) return false;
    if (tab === "posted") return t.client.toLowerCase() === address.toLowerCase();
    if (tab === "assigned") return t.freelancer.toLowerCase() === address.toLowerCase();
    return t.client.toLowerCase() === address.toLowerCase() || t.freelancer.toLowerCase() === address.toLowerCase();
  });

  return (
    <div className="zl-section">
      <div className="zl-container">
        <h1 className="zl-text-heading" style={{ margin: 0, lineHeight: "var(--leading-heading)", letterSpacing: "var(--tracking-heading)" }}>
          My Tasks
        </h1>

        <div className="zl-tabs" style={{ marginTop: 32 }}>
          {(["posted", "assigned", "watching"] as Tab[]).map((t) => (
            <button key={t} className={`zl-tab ${tab === t ? "zl-tab--active" : ""}`} onClick={() => setTab(t)}>
              {t === "posted" ? "Posted" : t === "assigned" ? "Assigned" : "Watching"}
            </button>
          ))}
        </div>

        {!connected && (
          <p style={{ marginTop: 16, color: "var(--color-graphite)", fontSize: 14 }}>Connect your wallet to view your tasks.</p>
        )}

        {loading && <div style={{ marginTop: 32 }}><LoadingRows count={4} /></div>}
        {error && <div style={{ marginTop: 32 }}><ErrorPane message={error} /></div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ marginTop: 32 }}>
            <Empty
              title="No tasks yet"
              description={tab === "posted" ? "Post your first task to get started." : "Browse the marketplace to find work."}
              action={tab === "posted" && connected ? <Link to="/tasks/new"><Button>Create Task</Button></Link> : <Link to="/marketplace"><Button variant="ghost">Browse Marketplace</Button></Link>}
            />
          </div>
        )}

        <div className="zl-grid" style={{ marginTop: 32 }}>
          {filtered.map((t) => (
            <Link key={t.taskId} to={`/tasks/${t.taskId}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="zl-card" style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>Task #{t.taskId}</div>
                    <div style={{ color: "var(--color-graphite)", fontSize: 14, marginTop: 4 }}>
                      {t.repoUrl ? <a href={t.repoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{t.repoUrl}</a> : "No repo linked"}
                    </div>
                  </div>
                  <Pill>{t.status}</Pill>
                </div>
                <div style={{ display: "flex", gap: 24, marginTop: 16, fontSize: 14, color: "var(--color-graphite)", flexWrap: "wrap" }}>
                  <span><Money value={t.reward} token="USDC" /></span>
                  <span>Client <Address value={t.client} /></span>
                  {Number(t.deadline) > 0 && <span>Ends <Countdown to={t.deadline} /></span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
