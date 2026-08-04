import React, { useEffect, useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { AdminAuthContext } from "../context/AdminAuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

function AdminDashboard() {
  const { logoutAdmin } = useContext(AdminAuthContext);
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Expandable chat thread states
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [adminReplyText, setAdminReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [targetDetectedLang, setTargetDetectedLang] = useState("English");

  const pollingRef = useRef(null);
  const queuePollingRef = useRef(null);

  const fetchUserProfile = async () => {
    try {
      const res = await API.get("/admin/me");
      setCurrentUser(res.data);
    } catch (e) {
      console.error("Failed to fetch profile", e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await API.get("/analytics/overview");
      setAnalytics(res.data);
    } catch (e) {
      console.error("Failed to fetch analytics", e);
    }
  };

  const fetchTickets = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      let url = "/tickets?skip=0&limit=50";
      if (filterStatus) url += `&status=${filterStatus}`;
      if (filterDepartment) url += `&department=${filterDepartment}`;

      const res = await API.get(url);
      setTickets(res.data.tickets || []);
    } catch (error) {
      if (!isSilent) alert("Error fetching tickets");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchAnalytics();
    fetchTickets(false);

    if (queuePollingRef.current) clearInterval(queuePollingRef.current);
    queuePollingRef.current = setInterval(() => {
      fetchTickets(true);
      fetchAnalytics();
    }, 5000);

    return () => {
      if (queuePollingRef.current) clearInterval(queuePollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDepartment, filterStatus]);

  // Mark conversation read by admin when opened
  const markReadAdmin = async (sessionId) => {
    try {
      await API.post(`/conversation/${sessionId}/mark-read-admin`);
    } catch {
      // Ignore mark-read background error
    }
  };

  // Load conversation thread for a session
  const fetchThread = async (sessionId, isSilent = false) => {
    if (!sessionId) return;
    try {
      if (!isSilent) setThreadLoading(true);
      const res = await API.get(`/conversation/${sessionId}`);
      setThreadMessages(res.data.messages || []);
      setTargetDetectedLang(res.data.detected_language || "English");

      // Clear admin unread badge
      markReadAdmin(sessionId);
    } catch (err) {
      console.error("Failed to fetch conversation thread", err);
    } finally {
      if (!isSilent) setThreadLoading(false);
    }
  };

  const toggleThread = (sessionId) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setThreadMessages([]);
      if (pollingRef.current) clearInterval(pollingRef.current);
    } else {
      setExpandedSessionId(sessionId);
      fetchThread(sessionId);
    }
  };

  // 5-second polling for open thread
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (expandedSessionId) {
      pollingRef.current = setInterval(() => {
        fetchThread(expandedSessionId, true);
      }, 5000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedSessionId]);

  const handleSendAdminReply = async (sessionId, e) => {
    e?.preventDefault();
    if (!adminReplyText.trim() || sendingReply) return;

    setSendingReply(true);
    try {
      await API.post("/admin/reply", {
        session_id: sessionId,
        message: adminReplyText.trim(),
      });
      setAdminReplyText("");
      fetchThread(sessionId, true);
      fetchTickets(true);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to send reply to citizen.");
    } finally {
      setSendingReply(false);
    }
  };

  const updateStatus = async (ticketId, status) => {
    try {
      await API.put(`/ticket/${ticketId}/status`, { status });
      fetchTickets(true);
      fetchAnalytics();
    } catch {
      alert("Failed to update status");
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    navigate("/admin");
  };

  const getPriorityColor = (priority) => {
    if (priority === "HIGH") return "#dc2626";
    if (priority === "MEDIUM") return "#f59e0b";
    return "#16a34a";
  };

  const getStatusColor = (status) => {
    if (status === "OPEN") return "#dc2626";
    if (status === "IN_PROGRESS") return "#f59e0b";
    if (status === "RESOLVED") return "#16a34a";
    if (status === "ESCALATED") return "#7c3aed";
    return "#6b7280";
  };

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  const deptChartData =
    analytics?.complaints_by_department?.map((item) => ({
      name: item._id,
      count: item.count,
    })) || [];

  const priorityChartData =
    analytics?.complaints_by_priority?.map((item) => ({
      name: item._id,
      count: item.count,
    })) || [];

  const statusChartData =
    analytics?.tickets_by_status?.map((item) => ({
      name: item._id || "OPEN",
      count: item.count,
    })) || [];

  return (
    <div style={styles.container}>
      {/* Top Header Bar */}
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.dashboardTitle}>🏛️ Grievance Admin Operations Center</h2>
          {currentUser && (
            <div style={styles.roleTag}>
              User: <strong>{currentUser.username}</strong> | Role:{" "}
              <span style={styles.roleBadge}>{currentUser.role}</span> | Scope:{" "}
              <strong>{currentUser.department}</strong>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a
            href="/admin/users"
            style={{
              padding: "8px 14px",
              backgroundColor: "#f1f5f9",
              color: "#334155",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "13px",
              border: "1px solid #cbd5e1",
            }}
          >
            👥 Registered Citizens
          </a>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      {analytics && (
        <div style={styles.metricsGrid}>
          <div style={{ ...styles.metricCard, borderLeft: "4px solid #2563eb" }}>
            <div style={styles.metricTitle}>Total Complaints</div>
            <div style={styles.metricVal}>{analytics.total_complaints}</div>
          </div>

          <div style={{ ...styles.metricCard, borderLeft: "4px solid #dc2626" }}>
            <div style={styles.metricTitle}>High Priority</div>
            <div style={styles.metricVal}>{analytics.high_priority_complaints}</div>
          </div>

          <div style={{ ...styles.metricCard, borderLeft: "4px solid #7c3aed" }}>
            <div style={styles.metricTitle}>Departmental Breakdown</div>
            <div style={{ fontSize: "14px", fontWeight: "600", marginTop: "4px" }}>
              {analytics.complaints_by_department?.length || 0} active departments
            </div>
          </div>
        </div>
      )}

      {/* Visual Analytics Charts Section */}
      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <h4 style={styles.chartTitle}>📊 Complaints by Department</h4>
          <div style={{ height: 260 }}>
            {deptChartData.length === 0 ? (
              <div style={styles.emptyChartNotice}>
                ℹ️ No departmental data recorded yet. Submit a grievance on the Home page!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={styles.chartCard}>
          <h4 style={styles.chartTitle}>🎯 Priority Distribution</h4>
          <div style={{ height: 260 }}>
            {priorityChartData.length === 0 ? (
              <div style={styles.emptyChartNotice}>
                ℹ️ No priority distribution data recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {priorityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={styles.chartCard}>
          <h4 style={styles.chartTitle}>📋 Ticket Status Breakdown</h4>
          <div style={{ height: 260 }}>
            {statusChartData.length === 0 ? (
              <div style={styles.emptyChartNotice}>
                ℹ️ No generated tickets recorded yet. (High priority grievances automatically generate tickets).
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Ticket List Header & Filters */}
      <div style={styles.filterSection}>
        <h3 style={{ margin: 0 }}>🎫 Assigned Tickets Queue ({tickets.length}) ● Live Sync (5s)</h3>

        <div style={{ display: "flex", gap: "10px" }}>
          {currentUser?.role === "super_admin" && (
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">All Departments</option>
              <option value="Water Supply Department">Water Supply Department</option>
              <option value="Electricity Board">Electricity Board</option>
              <option value="Public Works Department">Public Works Department</option>
              <option value="Sanitation Department">Sanitation Department</option>
              <option value="General Administration">General Administration</option>
            </select>
          )}

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#64748b" }}>Loading tickets...</p>
      ) : tickets.length === 0 ? (
        <div style={styles.emptyCard}>No tickets found matching current filters.</div>
      ) : (
        tickets.map((ticket) => {
          const isEscalated =
            ticket.status === "ESCALATED" || ticket.is_escalated;
          const isUnread = ticket.read_by_admin === false;
          const needsAttention = ticket.needs_agent_attention === true;
          const slaTime = ticket.sla_deadline
            ? new Date(ticket.sla_deadline).toLocaleString()
            : "N/A";
          const isExpanded = expandedSessionId === ticket.session_id;

          return (
            <div
              key={ticket.ticket_id}
              style={{
                ...styles.card,
                backgroundColor: isUnread || needsAttention ? "#fefce8" : "white",
                borderLeft: isUnread || needsAttention
                  ? "6px solid #eab308"
                  : isEscalated
                  ? "6px solid #7c3aed"
                  : `6px solid ${getPriorityColor(ticket.priority)}`,
              }}
            >
              <div style={styles.ticketHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong>Ticket #{ticket.ticket_id}</strong>

                  {isUnread && (
                    <span style={styles.unreadBadge}>
                      🔔 UNREAD CITIZEN MSG
                    </span>
                  )}

                  {needsAttention && (
                    <span style={styles.attentionBadge}>
                      ⚠️ NEEDS ATTENTION
                    </span>
                  )}

                  {ticket.agent_engaged && (
                    <span style={styles.agentTag}>
                      🛡️ Agent Engaged ({ticket.assigned_agent || "Admin"})
                    </span>
                  )}
                  
                  {isEscalated && (
                    <span style={styles.escalatedBadge}>⚠️ ESCALATED SLA OVERDUE</span>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  Created: {new Date(ticket.created_at).toLocaleString()}
                </div>
              </div>

              <div style={styles.gridDetails}>
                <div>
                  <strong>Department:</strong> {ticket.department}
                </div>
                <div>
                  <strong>Detected Language:</strong> {ticket.language || "English"}
                </div>
                <div>
                  <strong>Priority:</strong>{" "}
                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor: getPriorityColor(ticket.priority),
                    }}
                  >
                    {ticket.priority}
                  </span>
                </div>
                <div>
                  <strong>Status:</strong>{" "}
                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor: getStatusColor(ticket.status),
                    }}
                  >
                    {ticket.status}
                  </span>
                </div>
              </div>

              <div style={styles.msgSection}>
                <strong>Original Grievance Summary:</strong>
                <p style={styles.msgText}>{ticket.message}</p>
              </div>

              <div style={styles.slaBanner}>
                ⏱️ <strong>SLA Deadline:</strong> {slaTime}
              </div>

              {ticket.feedback && (
                <div style={styles.feedbackBanner}>
                  ⭐ <strong>Citizen Rating:</strong> {ticket.feedback.rating}/5 — "{ticket.feedback.comment || "No comment"}"
                </div>
              )}

              <div style={styles.actionsRow}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600" }}>
                    Update Status:
                  </label>
                  <select
                    style={styles.dropdown}
                    onChange={(e) => updateStatus(ticket.ticket_id, e.target.value)}
                    defaultValue={ticket.status}
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="ESCALATED">ESCALATED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                {ticket.session_id && (
                  <button
                    onClick={() => toggleThread(ticket.session_id)}
                    style={isExpanded ? styles.activeThreadBtn : styles.threadBtn}
                  >
                    {isExpanded ? "✕ Close Chat Thread" : "💬 Direct Citizen Handoff & Reply"}
                  </button>
                )}
              </div>

              {/* Expandable Chat Thread & Direct Handoff Reply Box */}
              {isExpanded && (
                <div style={styles.threadSection}>
                  <div style={styles.threadHeader}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", color: "#1e293b" }}>
                        💬 Live Conversation Thread
                      </h4>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Citizen Language: <strong>{targetDetectedLang}</strong> | Admin Replies are auto-translated before showing to citizen.
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "600" }}>
                      ● Auto-polling (5s)
                    </span>
                  </div>

                  <div style={styles.threadMessagesBox}>
                    {threadLoading ? (
                      <p style={{ textAlign: "center", color: "#64748b" }}>Loading messages...</p>
                    ) : threadMessages.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#64748b" }}>No messages in thread.</p>
                    ) : (
                      threadMessages.map((msg, mIdx) => {
                        if (msg.role === "system") {
                          return (
                            <div key={mIdx} style={styles.systemMessageRow}>
                              <span style={styles.systemBadge}>
                                🤝 {msg.content}
                              </span>
                            </div>
                          );
                        }

                        const isAdmin = msg.role === "agent";
                        const isAssistant = msg.role === "assistant";
                        const isUser = msg.role === "user";

                        return (
                          <div
                            key={mIdx}
                            style={{
                              ...styles.threadMsgRow,
                              justifyContent: isAdmin ? "flex-end" : "flex-start",
                            }}
                          >
                            <div
                              style={{
                                ...styles.threadMsgBubble,
                                backgroundColor: isAdmin
                                  ? "#1e3a8a"
                                  : isAssistant
                                  ? "#f1f5f9"
                                  : "#eff6ff",
                                color: isAdmin ? "white" : "#1e293b",
                                border: isAdmin
                                  ? "1px solid #1e40af"
                                  : "1px solid #cbd5e1",
                              }}
                            >
                              <div style={styles.msgSenderLabel}>
                                {isAdmin
                                  ? `🛡️ Admin (${msg.sender_name || "Agent"})`
                                  : isAssistant
                                  ? "🤖 AI Assistant"
                                  : "👤 Citizen"}
                              </div>
                              
                              {/* Display English translation for citizen messages if written in non-English */}
                              <div>
                                {isUser && msg.translated_content ? (
                                  <>
                                    <div>{msg.translated_content}</div>
                                    <div style={styles.originalSubtext}>
                                      Original ({msg.language || targetDetectedLang}): "{msg.content}"
                                    </div>
                                  </>
                                ) : (
                                  <div>{msg.content}</div>
                                )}
                              </div>

                              {msg.evidence_url && (
                                <div style={{ marginTop: "8px" }}>
                                  <a href={msg.evidence_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                                    <img
                                      src={msg.evidence_url}
                                      alt="Evidence"
                                      style={{
                                        maxWidth: "100%",
                                        maxHeight: "220px",
                                        borderRadius: "8px",
                                        objectFit: "cover",
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        display: "block",
                                        marginTop: "6px"
                                      }}
                                    />
                                  </a>
                                </div>
                              )}

                              {isAdmin && (
                                msg.translation_status === "failed" ? (
                                  <div style={{ ...styles.originalSubtext, color: "#f87171" }}>
                                    ⚠️ Translation unavailable — Sent to citizen in English
                                  </div>
                                ) : (msg.translated_content && msg.translated_content !== msg.content) ? (
                                  <div style={styles.originalSubtext}>
                                    Translated for citizen ({targetDetectedLang}): "{msg.translated_content}"
                                  </div>
                                ) : null
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Direct Admin Reply Form */}
                  <form
                    onSubmit={(e) => handleSendAdminReply(ticket.session_id, e)}
                    style={styles.replyForm}
                  >
                    <textarea
                      rows={2}
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      placeholder={`Type direct reply in English (will be auto-translated to ${targetDetectedLang} for citizen)...`}
                      style={styles.replyTextarea}
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !adminReplyText.trim()}
                      style={{
                        ...styles.sendReplyBtn,
                        opacity: sendingReply || !adminReplyText.trim() ? 0.6 : 1,
                      }}
                    >
                      {sendingReply ? "Translating & Sending..." : "Send Reply to Citizen"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1100px",
    margin: "30px auto",
    padding: "0 20px",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    padding: "20px",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },
  dashboardTitle: {
    margin: 0,
    fontSize: "22px",
    color: "#0f172a",
  },
  roleTag: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "4px",
  },
  roleBadge: {
    backgroundColor: "#e2e8f0",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "11px",
  },
  logoutBtn: {
    padding: "8px 16px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  metricCard: {
    backgroundColor: "white",
    padding: "16px",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  metricTitle: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metricVal: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: "4px",
  },
  chartsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
    marginBottom: "28px",
  },
  chartCard: {
    backgroundColor: "white",
    padding: "18px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },
  chartTitle: {
    margin: "0 0 12px 0",
    fontSize: "15px",
    color: "#334155",
  },
  emptyChartNotice: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#64748b",
    fontSize: "13px",
    textAlign: "center",
    padding: "20px",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px stroke #e2e8f0",
  },
  filterSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  filterSelect: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
  },
  card: {
    background: "white",
    padding: "20px",
    marginBottom: "16px",
    borderRadius: "10px",
    boxShadow: "0px 4px 15px rgba(0,0,0,0.05)",
    transition: "all 0.2s ease",
  },
  emptyCard: {
    padding: "30px",
    backgroundColor: "white",
    borderRadius: "10px",
    textAlign: "center",
    color: "#64748b",
  },
  ticketHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  unreadBadge: {
    backgroundColor: "#ef4444",
    color: "white",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "4px",
    fontWeight: "bold",
  },
  attentionBadge: {
    backgroundColor: "#eab308",
    color: "#713f12",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "4px",
    fontWeight: "bold",
  },
  agentTag: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "4px",
    fontWeight: "bold",
  },
  escalatedBadge: {
    backgroundColor: "#7c3aed",
    color: "white",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "4px",
    fontWeight: "bold",
  },
  gridDetails: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
    fontSize: "13px",
    marginBottom: "12px",
  },
  badge: {
    color: "white",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "bold",
  },
  msgSection: {
    fontSize: "14px",
    marginBottom: "12px",
  },
  msgText: {
    margin: "4px 0 0 0",
    backgroundColor: "#f8fafc",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
  },
  slaBanner: {
    fontSize: "12px",
    color: "#475569",
    backgroundColor: "#f1f5f9",
    padding: "6px 12px",
    borderRadius: "6px",
    marginBottom: "10px",
    display: "inline-block",
  },
  feedbackBanner: {
    fontSize: "12px",
    color: "#854d0e",
    backgroundColor: "#fef9c3",
    padding: "6px 12px",
    borderRadius: "6px",
    marginBottom: "10px",
  },
  actionsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "12px",
    flexWrap: "wrap",
    gap: "10px",
  },
  dropdown: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
  },
  threadBtn: {
    padding: "8px 14px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  activeThreadBtn: {
    padding: "8px 14px",
    backgroundColor: "#475569",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  threadSection: {
    marginTop: "16px",
    padding: "16px",
    backgroundColor: "#f8fafc",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
  },
  threadHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  threadMessagesBox: {
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "14px",
    maxHeight: "280px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "12px",
  },
  systemMessageRow: {
    display: "flex",
    justifyContent: "center",
    margin: "6px 0",
  },
  systemBadge: {
    fontSize: "12px",
    fontWeight: "600",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 14px",
    borderRadius: "20px",
    border: "1px solid #bfdbfe",
  },
  threadMsgRow: {
    display: "flex",
    width: "100%",
  },
  threadMsgBubble: {
    maxWidth: "80%",
    padding: "10px 14px",
    fontSize: "13px",
    borderRadius: "10px",
    lineHeight: "1.4",
  },
  msgSenderLabel: {
    fontSize: "11px",
    fontWeight: "700",
    marginBottom: "4px",
    opacity: 0.85,
  },
  originalSubtext: {
    fontSize: "11px",
    fontStyle: "italic",
    marginTop: "4px",
    opacity: 0.75,
  },
  replyForm: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  replyTextarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  },
  sendReplyBtn: {
    alignSelf: "flex-end",
    padding: "10px 18px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
};

export default AdminDashboard;
