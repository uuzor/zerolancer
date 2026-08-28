import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Countdown, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "fund", label: "Fund" },
  { key: "assign", label: "Assign" },
  { key: "deliverable", label: "Deliverable" },
  { key: "verify", label: "Verify" },
  { key: "dispute", label: "Dispute" },
  { key: "reputation", label: "Reputation" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function TaskWorkspace() {
  const { taskId } = useParams<{ taskId: string }>();
  const { address, connected } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ events: any[] }>(`/v1/events/${taskId}`);
      setEvents(res.events ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const taskEvent = events.find((e) => e.eventName === "TaskCreated");
  const statusEvent = events.find((e) => ["Assigned", "DeliverableSubmitted", "Deposited", "VerdictSubmitted", "Released", "DisputeOpened", "DisputeResolved"].includes(e.eventName));
  const taskStatus = statusEvent?.eventName ?? "Open";
  const payload = taskEvent?.payload ?? {};

  const statusVariant = (() => {
    switch (taskStatus) {
      case "Open": return "default";
      case "Assigned": return "accent";
      case "InReview": return "warning";
      case "Passed": case "Released": return "success";
      case "Disputed": case "DisputeOpened": return "danger";
      case "Resolved": return "success";
      default: return "default";
    }
  })();

  if (!taskId) return <ErrorPane message="Missing task id" />;

  const NavLink = ({ to, children, variant }: { to: string; children: React.ReactNode; variant?: "primary" | "ghost" }) => (
    <a href={to} style={{ textDecoration: "none" }}><Button variant={variant ?? "primary"}>{children}</Button></a>
  );

  return (
    <div>
      <div className="zl-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Pill variant={statusVariant}>{taskStatus}</Pill>
          <h1 style={{ fontSize: "var(--text-heading-sm)", margin: 0, flex: 1 }}>
            {payload.title ?? `Task ${taskId}`}
          </h1>
          {payload.reward && <Money value={payload.reward} token="USDC" />}
          {payload.deadline && <Countdown to={Number(payload.deadline)} label="Deadline" />}
        </div>
        {payload.repoUrl && (
          <div style={{ marginTop: 12 }}>
            <a href={payload.repoUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-graphite)" }}>
              {payload.repoUrl}
            </a>
          </div>
        )}
      </div>

      <div className="zl-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`zl-tab${tab === t.key ? " zl-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="zl-card" style={{ marginTop: 0, borderRadius: "0 var(--radius-cards) var(--radius-cards) var(--radius-cards)" }}>
        {loading && <LoadingRows count={3} />}
        {error && <ErrorPane message={error} retry={loadEvents} />}
        {!loading && !error && (
          <>
            {tab === "overview" && (
              <div>
                <p style={{ color: "var(--color-graphite)" }}>
                  {payload.description ?? "No description available. Spec is anchored on 0G Storage."}
                </p>
                {payload.client && (
                  <div style={{ marginTop: 16 }}>
                    <span className="zl-label">Client</span>
                    <Address value={payload.client} />
                  </div>
                )}
                {payload.freelancer && (
                  <div style={{ marginTop: 12 }}>
                    <span className="zl-label">Freelancer</span>
                    <Address value={payload.freelancer} />
                  </div>
                )}
              </div>
            )}

            {tab === "fund" && (
              <div>
                <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
                  Fund escrow to secure this task.
                </p>
                {connected ? (
                  <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <NavLink to={`/tasks/${taskId}/fund`} variant="primary">Open Fund Flow</NavLink>
                  </div>
                ) : (
                  <p style={{ color: "var(--color-graphite)" }}>Connect wallet to fund escrow.</p>
                )}
              </div>
            )}

            {tab === "assign" && (
              <div>
                <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
                  Assign a freelancer to start the work.
                </p>
                {connected ? (
                  <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <NavLink to={`/tasks/${taskId}/assign`} variant="primary">Open Assign Flow</NavLink>
                  </div>
                ) : (
                  <p style={{ color: "var(--color-graphite)" }}>Connect wallet to assign.</p>
                )}
              </div>
            )}

            {tab === "deliverable" && (
              <div>
                <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
                  Submit a GitHub PR as the deliverable.
                </p>
                {connected ? (
                  <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <NavLink to={`/tasks/${taskId}/submit`} variant="primary">Open Submit Flow</NavLink>
                  </div>
                ) : (
                  <p style={{ color: "var(--color-graphite)" }}>Connect wallet to submit.</p>
                )}
              </div>
            )}

            {tab === "verify" && (
              <div>
                <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
                  Run the AI + CI verification pipeline.
                </p>
                {connected ? (
                  <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <NavLink to={`/tasks/${taskId}/verify`} variant="primary">Open Verify Flow</NavLink>
                  </div>
                ) : (
                  <p style={{ color: "var(--color-graphite)" }}>Connect wallet to verify.</p>
                )}
              </div>
            )}

            {tab === "dispute" && (
              <div>
                <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
                  View or escalate disputes.
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <NavLink to={`/tasks/${taskId}/dispute`} variant="ghost">Open Dispute Flow</NavLink>
                </div>
              </div>
            )}

            {tab === "reputation" && (
              <div>
                <p style={{ color: "var(--color-graphite)", marginTop: 0 }}>
                  View or mint reputation NFT.
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <NavLink to={`/tasks/${taskId}/reputation`} variant="ghost">Open Reputation Flow</NavLink>
                </div>
              </div>
            )}

            {tab === "activity" && (
              <div>
                {events.length === 0 ? (
                  <Empty title="No activity yet" description="Events will appear here as the task progresses." />
                ) : (
                  <table className="zl-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Time</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev, i) => (
                        <tr key={i}>
                          <td><Pill variant="default">{ev.eventName}</Pill></td>
                          <td style={{ fontSize: 13, color: "var(--color-graphite)" }}>
                            {new Date(Number(ev.createdAt) * 1000).toLocaleString()}
                          </td>
                          <td style={{ fontSize: 13 }}>
                            {Object.entries(ev.payload ?? {}).map(([k, v]) => (
                              <div key={k}><span className="zl-label">{k}:</span> {String(v)}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
