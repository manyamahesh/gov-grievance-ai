import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/api";
import { CitizenAuthContext } from "../context/CitizenAuthContext";
import { getTranslation } from "../utils/translations";

const getStatusBadgeStyle = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "RESOLVED") return { backgroundColor: "#dcfce7", color: "#166534" };
  if (s === "IN_PROGRESS") return { backgroundColor: "#fef3c7", color: "#92400e" };
  if (s === "OPEN") return { backgroundColor: "#fee2e2", color: "#991b1b" };
  if (s === "ESCALATED") return { backgroundColor: "#f3e8ff", color: "#6b21a8" };
  if (s === "REJECTED") return { backgroundColor: "#f3f4f6", color: "#374151" };
  return { backgroundColor: "#eff6ff", color: "#1d4ed8" };
};

function Track() {
  const { citizenUser, loading: authLoading, selectedLanguage } = useContext(CitizenAuthContext);
  const t = (key) => getTranslation(key, selectedLanguage);
  const navigate = useNavigate();
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Feedback states keyed by ticket_id
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [submittedFeedback, setSubmittedFeedback] = useState({});

  const pollingRef = useRef(null);

  const fetchMyGrievances = async (isSilent = false) => {
    if (!citizenUser) {
      setLoading(false);
      return;
    }

    try {
      if (!isSilent) setLoading(true);
      const res = await API.get("/my-grievances");
      setGrievances(res.data.grievances || []);
      
      const submitted = {};
      (res.data.grievances || []).forEach((g) => {
        if (g.ticket_id && g.feedback) {
          submitted[g.ticket_id] = true;
        }
      });
      setSubmittedFeedback(submitted);

    } catch (err) {
      if (!isSilent) setError("Failed to load your grievances.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyGrievances(false);

    if (pollingRef.current) clearInterval(pollingRef.current);

    if (citizenUser) {
      // 5-second real-time polling loop for My Grievances
      pollingRef.current = setInterval(() => {
        fetchMyGrievances(true);
      }, 5000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citizenUser]);

  const handleContinueChat = async (sessionId) => {
    try {
      await API.post(`/conversation/${sessionId}/mark-read-citizen`);
    } catch {
      // Ignore background error
    }
    navigate("/", { state: { sessionId } });
  };

  const submitFeedback = async (ticketId) => {
    if (!ticketId) return;

    try {
      await API.post(`/ticket/${ticketId}/feedback`, {
        rating: Number(ratings[ticketId] || 5),
        comment: comments[ticketId] || ""
      });
      setSubmittedFeedback((prev) => ({ ...prev, [ticketId]: true }));
      alert("Thank you for your feedback!");
    } catch (err) {
      alert("Failed to submit feedback.");
    }
  };

  if (authLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={{ textAlign: "center", color: "#64748b" }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!citizenUser) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "20px" }}>
            <h2>🔒 Login Required</h2>
            <p style={{ color: "#64748b", marginBottom: "20px" }}>
              Please log in to view and track your submitted grievances.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <Link to="/login" style={styles.primaryBtn}>
                Citizen Login
              </Link>
              <Link to="/signup" style={styles.secondaryBtn}>
                Register Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.title}>📂 {t("myGrievances")}</h2>
            <p style={styles.subtitle}>
              Logged in as <strong>{citizenUser.username}</strong> ({grievanceListSubtitle(grievances.length)}) ● Real-time Live Sync (5s)
            </p>
          </div>

          <Link to="/" style={styles.primaryBtn}>
            {t("lodgeGrievance")}
          </Link>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", margin: "40px 0" }}>
            Loading your grievances...
          </p>
        ) : grievances.length === 0 ? (
          <div style={styles.emptyNotice}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>📋</div>
            <p style={{ fontWeight: "600", margin: "0 0 4px 0" }}>{t("noGrievancesTitle")}</p>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              {t("noGrievancesDesc")}
            </p>
          </div>
        ) : (
          grievances.map((item, index) => {
            const grievanceRef = item.grievance_ref || (item.grievance_id ? `GR-${item.grievance_id.slice(0, 8).toUpperCase()}` : "GR-REGISTERED");
            const isUnreadAgentReply = item.read_by_citizen === false;

            return (
              <div
                key={item.grievance_id || index}
                style={{
                  ...styles.grievanceItem,
                  backgroundColor: isUnreadAgentReply ? "#fefce8" : "#ffffff",
                  borderLeft: isUnreadAgentReply ? "6px solid #eab308" : "1px solid #e2e8f0",
                }}
              >
                <div style={styles.itemHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={styles.refTag}>
                      📌 {grievanceRef}
                    </span>

                    {isUnreadAgentReply && (
                      <span style={styles.unreadBadge}>
                        🔔 NEW AGENT REPLY
                      </span>
                    )}

                    <span
                      style={{
                        ...styles.badge,
                        ...getStatusBadgeStyle(item.status),
                      }}
                    >
                      {item.status || "RECEIVED — UNDER REVIEW"}
                    </span>

                    {item.agent_engaged && (
                      <span style={{ ...styles.badge, backgroundColor: "#dbeafe", color: "#1e40af" }}>
                        🛡️ Agent Active ({item.assigned_agent || "Support"})
                      </span>
                    )}
                    
                    {item.ticket_id && (
                      <span style={styles.ticketTag}>
                        🎫 Ticket #{item.ticket_id.slice(0, 8)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      onClick={() => handleContinueChat(item.session_id)}
                      style={styles.continueChatBtn}
                      title="Continue conversation thread"
                    >
                      {t("continueChat")}
                    </button>
                    <div style={styles.dateText}>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : "Recent"}
                    </div>
                  </div>
                </div>

                <div style={styles.metaRow}>
                  <div>
                    <strong>Department:</strong> {item.department}
                  </div>
                  <div>
                    <strong>Priority:</strong>{" "}
                    <span
                      style={{
                        color: item.priority === "HIGH" ? "#dc2626" : "#2563eb",
                        fontWeight: "bold",
                      }}
                    >
                      {item.priority}
                    </span>
                  </div>
                  <div>
                    <strong>Language:</strong> {item.detected_language || "English"}
                  </div>
                </div>

                {/* Message Thread Section */}
                <div style={styles.threadBox}>
                  {item.messages && item.messages.length > 0 ? (
                    item.messages.map((msg, mIdx) => {
                      if (msg.role === "system") {
                        return (
                          <div key={mIdx} style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                            <span style={{ fontSize: "11px", fontWeight: "600", backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "4px 10px", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
                              🤝 {msg.content}
                            </span>
                          </div>
                        );
                      }

                      const isUser = msg.role === "user";
                      const isAgent = msg.role === "agent";
                      const displayContent = isAgent ? (msg.translated_content || msg.content) : msg.content;

                      return (
                        <div
                          key={mIdx}
                          style={{
                            ...styles.msgRow,
                            justifyContent: isUser ? "flex-end" : "flex-start",
                          }}
                        >
                          <div
                            style={{
                              ...styles.msgBubble,
                              backgroundColor: isUser
                                ? "#2563eb"
                                : isAgent
                                ? "#1e1b4b"
                                : "#f1f5f9",
                              color: isUser || isAgent ? "white" : "#1e293b",
                            }}
                          >
                            <div style={{ fontSize: "11px", opacity: 0.85, marginBottom: "2px", fontWeight: "bold" }}>
                              {isUser ? "You" : isAgent ? `🛡️ Agent (${msg.sender_name || "Admin"})` : "AI Assistant"}
                            </div>
                            <div>{displayContent}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                      {item.translated_text || "No conversation thread recorded."}
                    </p>
                  )}
                </div>

                {/* Citizen Feedback Option */}
                {item.ticket_id && (
                  <div style={styles.feedbackBox}>
                    <strong>⭐ Resolution Feedback:</strong>
                    {submittedFeedback[item.ticket_id] ? (
                      <span style={{ color: "#166534", marginLeft: "10px", fontSize: "13px" }}>
                        ✅ Feedback Submitted
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: "10px", marginTop: "8px", alignItems: "center" }}>
                        <select
                          value={ratings[item.ticket_id] || 5}
                          onChange={(e) =>
                            setRatings((prev) => ({ ...prev, [item.ticket_id]: e.target.value }))
                          }
                          style={{ padding: "4px 8px", borderRadius: "4px" }}
                        >
                          <option value="5">5 - Excellent</option>
                          <option value="4">4 - Good</option>
                          <option value="3">3 - Satisfactory</option>
                          <option value="2">2 - Poor</option>
                          <option value="1">1 - Dissatisfied</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Optional comments..."
                          value={comments[item.ticket_id] || ""}
                          onChange={(e) =>
                            setComments((prev) => ({ ...prev, [item.ticket_id]: e.target.value }))
                          }
                          style={{ flex: 1, padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                        />

                        <button
                          onClick={() => submitFeedback(item.ticket_id)}
                          style={styles.smallFeedbackBtn}
                        >
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const grievanceListSubtitle = (count) => {
  return count === 1 ? "1 complaint logged" : `${count} complaints logged`;
};

const styles = {
  container: {
    padding: "30px 16px",
    backgroundColor: "#f8fafc",
    minHeight: "88vh",
    display: "flex",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: "800px",
    backgroundColor: "white",
    padding: "28px",
    borderRadius: "12px",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.05)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  title: {
    margin: "0 0 4px 0",
    fontSize: "22px",
    color: "#0f172a",
  },
  subtitle: {
    margin: 0,
    fontSize: "13px",
    color: "#64748b",
  },
  primaryBtn: {
    padding: "10px 16px",
    backgroundColor: "#2563eb",
    color: "white",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "13px",
  },
  secondaryBtn: {
    padding: "10px 16px",
    backgroundColor: "#16a34a",
    color: "white",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "13px",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    padding: "10px",
    borderRadius: "6px",
    marginBottom: "16px",
    fontSize: "13px",
  },
  emptyNotice: {
    textAlign: "center",
    padding: "40px 20px",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px dashed #cbd5e1",
  },
  grievanceItem: {
    backgroundColor: "#ffffff",
    borderRadius: "10px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
    transition: "all 0.2s ease",
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    flexWrap: "wrap",
    gap: "10px",
  },
  refTag: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "bold",
    backgroundColor: "#e0e7ff",
    color: "#3730a3",
    border: "1px solid #c7d2fe",
  },
  unreadBadge: {
    backgroundColor: "#ef4444",
    color: "white",
    fontSize: "11px",
    padding: "3px 8px",
    borderRadius: "4px",
    fontWeight: "bold",
  },
  badge: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "bold",
  },
  ticketTag: {
    fontSize: "12px",
    backgroundColor: "#f1f5f9",
    color: "#334155",
    padding: "3px 8px",
    borderRadius: "6px",
  },
  continueChatBtn: {
    padding: "5px 12px",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    transition: "all 0.2s ease",
  },
  dateText: {
    fontSize: "12px",
    color: "#64748b",
  },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
    fontSize: "13px",
    backgroundColor: "#f8fafc",
    padding: "10px 14px",
    borderRadius: "6px",
    marginBottom: "12px",
  },
  threadBox: {
    backgroundColor: "#ffffff",
    border: "1px solid #f1f5f9",
    borderRadius: "6px",
    padding: "12px",
    maxHeight: "220px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "12px",
  },
  msgRow: {
    display: "flex",
    width: "100%",
  },
  msgBubble: {
    maxWidth: "80%",
    padding: "8px 12px",
    fontSize: "13px",
    borderRadius: "8px",
  },
  feedbackBox: {
    fontSize: "13px",
    backgroundColor: "#fefce8",
    border: "1px solid #fef08a",
    padding: "10px 14px",
    borderRadius: "6px",
  },
  smallFeedbackBtn: {
    padding: "4px 12px",
    backgroundColor: "#ca8a04",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
  },
};

export default Track;