import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Money, Countdown, Address, LoadingRows, ErrorPane, Empty } from "../components/Alden.js";

export default function TaskDetail() {
  const { taskId } = useParams();
  const { connected } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api<any>(`/v1/events/${taskId}?eventName=TaskCreated`),
      api<any[]>(`/v1/events/${taskId}`),
    ])
      .then(([taskEvent, allEvents]) => {
        if (cancelled) return;
        setTask(taskEvent?.payload ?? taskEvent);
        setEvents(allEvents);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) return <div className="zl-section"><div className="zl-container"><LoadingRows count={4} /></div></div>;
  if (error) return <div className="zl-section"><div className="zl-container"><ErrorPane message={error} /></div></div>;
  if (!task) return <div className="zl-section"><div className="zl-container"><Empty title="Task not found" description="This task may not exist or has been removed." /></div></div>;

  return (
    <div className="zl-section">
      <div className="zl-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 className="zl-text-heading" style={{ margin: 0, lineHeight: "var(--leading-heading)", letterSpacing: "var(--tracking-heading)" }}>
              Task #{taskId}
            </h1>
            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <Pill>{task.status ?? "Open"}</Pill>
              {task.category && <Pill variant="accent">{task.category}</Pill>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, fontWeight: 600 }}><Money value={String(task.reward ?? 0)} token="USDC" /></div>
            {Number(task.deadline) > 0 && <div style={{ color: "var(--color-graphite)", marginTop: 4, fontSize: 14 }}>Ends <Countdown to={task.deadline} /></div>}
          </div>
        </div>

        <div className="zl-grid zl-grid--2" style={{ marginTop: 40 }}>
          <div className="zl-card">
            <h3 className="zl-text-heading-sm" style={{ margin: "0 0 16px" }}>Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
              <div><span style={{ color: "var(--color-graphite)" }}>Client:</span> <Address value={task.client} /></div>
              <div><span style={{ color: "var(--color-graphite)" }}>Freelancer:</span> {task.freelancer ? <Address value={task.freelancer} /> : <span style={{ color: "var(--color-graphite)" }}>Unassigned</span>}</div>
              <div><span style={{ color: "var(--color-graphite)" }}>Repo:</span> {task.repoUrl ? <a href={task.repoUrl} target="_blank" rel="noreferrer">{task.repoUrl}</a> : "—"}</div>
              <div><span style={{ color: "var(--color-graphite)" }}>Coverage gate:</span> {task.coverageGateBps ? `${Number(task.coverageGateBps) / 100}%` : "80%"}</div>
            </div>
          </div>
          <div className="zl-card">
            <h3 className="zl-text-heading-sm" style={{ margin: "0 0 16px" }}>Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {connected && task.client?.toLowerCase() === (task.client?.toLowerCase?.() ?? "") && (
                <Link to={`/tasks/${taskId}/fund`}><Button style={{ width: "100%" }}>Fund Escrow</Button></Link>
              )}
              {connected && task.status === "Open" && (
                <Link to={`/tasks/${taskId}/assign`}><Button variant="ghost" style={{ width: "100%" }}>Assign Freelancer</Button></Link>
              )}
              <Link to={`/tasks/${taskId}`}><Button variant="ghost" style={{ width: "100%" }}>Open Workspace</Button></Link>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 40 }}>
          <h3 className="zl-text-heading-sm" style={{ margin: "0 0 16px" }}>Activity</h3>
          {events.length === 0 ? (
            <p style={{ color: "var(--color-graphite)", fontSize: 14 }}>No events yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {events.slice(0, 20).map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 14, padding: "12px 0", borderBottom: "1px solid var(--color-fog-border)" }}>
                  <Pill variant="accent" style={{ minWidth: 100 }}>{ev.eventName}</Pill>
                  <span style={{ color: "var(--color-graphite)" }}>{new Date(ev.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
