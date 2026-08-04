import React, { useState, useRef, useEffect, useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import API from "../api/api";
import { CitizenAuthContext } from "../context/CitizenAuthContext";
import { getTranslation, SUPPORTED_LANGUAGES } from "../utils/translations";

function Home() {
  const { citizenUser, loading: authLoading, selectedLanguage, setSelectedLanguage } = useContext(CitizenAuthContext);
  const t = (key) => getTranslation(key, selectedLanguage);
  const navigate = useNavigate();
  const location = useLocation();

  const mapLanguageNameToCode = (langName) => {
    if (!langName) return null;
    const found = SUPPORTED_LANGUAGES.find(
      (l) => l.label.toLowerCase() === langName.toLowerCase() || l.code.toLowerCase() === langName.toLowerCase()
    );
    return found ? found.code : null;
  };


  const [inputMessage, setInputMessage] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [agentEngaged, setAgentEngaged] = useState(false);
  
  const chatEndRef = useRef(null);
  const pollingRef = useRef(null);
  // Tracks when a POST /chat is in-flight — poll skips during this window
  // to prevent a stale DB read from overwriting state mid-write.
  const sendingRef = useRef(false);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load existing session thread if passed via navigation state
  useEffect(() => {
    const targetSessionId = location.state?.sessionId;
    if (targetSessionId && citizenUser) {
      loadExistingSession(targetSessionId, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, citizenUser]);

  // 5-second polling while an active session exists.
  // Skips the fetch if a POST /chat is currently in-flight (sendingRef.current)
  // so a concurrent poll can't overwrite state with a stale DB snapshot mid-write.
  const startPolling = (sId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (!sId || !citizenUser) return;
    pollingRef.current = setInterval(() => {
      if (!sendingRef.current) {
        loadExistingSession(sId, true);
      }
    }, 5000);
  };

  useEffect(() => {
    startPolling(sessionId);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, citizenUser]);

  // Live Thread Re-translation Effect when Language Selector Changes
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;

    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage);
    const targetLabel = langObj ? langObj.label : "English";

    const syncThreadTranslation = async () => {
      try {
        const res = await API.post(`/conversation/${sessionId}/translate-thread`, {
          target_language: targetLabel
        });
        if (res.data && res.data.messages) {
          setMessages(res.data.messages);
        }
      } catch {
        // Ignore background translation switch error
      }
    };

    syncThreadTranslation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage, sessionId]);

  const getMessageDisplayContent = (msg) => {
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage);
    const targetLabel = langObj ? langObj.label : "English";
    const isEnglish = targetLabel.toLowerCase() === "english";

    if (msg.translations && msg.translations[targetLabel]) {
      return msg.translations[targetLabel];
    }

    if (isEnglish) {
      if (msg.role === "user") {
        return msg.translated_content || msg.content;
      }
      if (msg.role === "assistant") {
        return msg.original_english_content || msg.content;
      }
      if (msg.role === "agent") {
        return msg.content;
      }
      if (msg.role === "system") {
        const sender = msg.sender_name || "Admin";
        return `You are now connected with support agent (${sender}).`;
      }
      return msg.content;
    }

    return msg.translated_content || msg.content;
  };


  const markReadCitizen = async (sId) => {
    try {
      await API.post(`/conversation/${sId}/mark-read-citizen`);
    } catch {
      // Ignore background mark read error
    }
  };

  const loadExistingSession = async (sId, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await API.get(`/conversation/${sId}`);
      const data = res.data;

      setSessionId(sId);
      setMessages(data.messages || []);
      setAgentEngaged(data.agent_engaged || false);
      setAnalysis({
        detected_language: data.detected_language,
        translated_text: data.translated_text,
        sentiment: data.sentiment,
        priority: data.priority,
        department: data.department,
        ticket_id: data.ticket_id,
        grievance_ref: data.grievance_ref,
        needs_followup: data.needs_followup
      });
      setIsComplete(!data.needs_followup);

      // Automatically sync top-nav selector with active grievance language
      const targetCode = mapLanguageNameToCode(data.selected_language || data.detected_language);
      if (targetCode) {
        setSelectedLanguage(targetCode);
      }


      // Clear citizen unread notification badge
      markReadCitizen(sId);
    } catch (err) {
      console.error("Failed to load existing conversation:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await API.post("/upload/evidence", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setEvidenceUrl(res.data.url);
    } catch (err) {
      alert("Failed to upload evidence image.");
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!citizenUser) {
      navigate("/login");
      return;
    }

    if ((!inputMessage.trim() && !evidenceUrl) || loading) return;

    const currentMsg = inputMessage.trim();
    const currentEvidence = evidenceUrl;

    setInputMessage("");
    setEvidenceUrl("");

    // Block the poll from firing while this POST is in-flight
    sendingRef.current = true;

    const tempUserMsg = {
      role: "user",
      content: currentMsg || "📷 [Photo Evidence Submitted]",
      evidence_url: currentEvidence || undefined,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const selectedLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage);
      const payload = {
        message: currentMsg || undefined,
        session_id: sessionId || undefined,
        selected_language: selectedLangObj ? selectedLangObj.label : "English"
      };

      if (currentEvidence) {
        payload.evidence_url = currentEvidence;
      }


      const res = await API.post("/chat", payload);
      const data = res.data;

      setSessionId(data.session_id);
      setAgentEngaged(data.agent_engaged || false);
      setAnalysis({
        detected_language: data.detected_language,
        translated_text: data.translated_text,
        sentiment: data.sentiment,
        priority: data.priority,
        department: data.department,
        ticket_id: data.ticket_id,
        grievance_ref: data.grievance_ref,
        needs_followup: data.needs_followup
      });

      // Sync top-nav selector immediately with detected language
      const targetCode = mapLanguageNameToCode(data.detected_language || data.selected_language);
      if (targetCode) {
        setSelectedLanguage(targetCode);
      }


      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        const assistantMsg = { role: "assistant", content: data.reply, timestamp: new Date().toISOString() };
        setMessages((prev) => [...prev, assistantMsg]);
      }

      if (!data.needs_followup) {
        setIsComplete(true);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        alert("Session expired. Please log in again.");
        navigate("/login");
      } else {
        alert("Error sending message. Please try again.");
      }
    } finally {
      setLoading(false);
      // Unblock the poll and reset the interval to a fresh 5s window.
      // This ensures the next poll fires 5s AFTER the write completes,
      // never in the middle of it.
      sendingRef.current = false;
      startPolling(sessionId);
    }
  };

  const resetChat = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setSessionId(null);
    setMessages([]);
    setAnalysis(null);
    setIsComplete(false);
    setAgentEngaged(false);
    setInputMessage("");
    setEvidenceUrl("");
  };

  return (
    <div style={styles.container}>
      <div style={styles.chatCard}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{t("aiAssistantTitle")}</h2>
            <p style={styles.subtitle}>
              {t("aiAssistantSubtitle")}
            </p>
          </div>
          {sessionId && citizenUser && (
            <button onClick={resetChat} style={styles.newChatBtn}>
              {t("newComplaint")}
            </button>
          )}
        </div>

        {/* Login Prompt Banner for Unauthenticated Citizens */}
        {!authLoading && !citizenUser && (
          <div style={styles.authBanner}>
            <span>{t("loginRequired")}</span>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <Link to="/login" style={styles.authBannerBtn}>
                {t("login")}
              </Link>
              <Link to="/signup" style={{ ...styles.authBannerBtn, backgroundColor: "#16a34a" }}>
                {t("register")}
              </Link>
            </div>
          </div>
        )}

        {/* Status Badge Bar */}
        {analysis && citizenUser && (
          <div style={styles.analysisBar}>
            {analysis.grievance_ref && (
              <span style={{ ...styles.chip, backgroundColor: "#e0e7ff", color: "#3730a3", fontWeight: "bold" }}>
                📌 {analysis.grievance_ref}
              </span>
            )}
            <span style={styles.chip}>🌐 {analysis.detected_language}</span>
            <span style={styles.chip}>🏢 {analysis.department}</span>
            <span
              style={{
                ...styles.chip,
                backgroundColor:
                  analysis.priority === "HIGH" ? "#fee2e2" : "#fef3c7",
                color: analysis.priority === "HIGH" ? "#991b1b" : "#92400e",
                fontWeight: "bold",
              }}
            >
              ⚡ Priority: {analysis.priority}
            </span>
            {agentEngaged && (
              <span style={{ ...styles.chip, backgroundColor: "#dbeafe", color: "#1e40af", fontWeight: "bold" }}>
                🛡️ Live Support Agent Active
              </span>
            )}
            {analysis.ticket_id && (
              <span style={{ ...styles.chip, backgroundColor: "#dcfce7", color: "#166534" }}>
                🎫 Ticket #{analysis.ticket_id.slice(0, 8)}
              </span>
            )}
          </div>
        )}

        {/* Chat Thread */}
        <div style={styles.chatThread}>
          {messages.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: "40px", marginBottom: "10px" }}>🏛️</div>
              <p style={{ fontWeight: "600", color: "#374151" }}>Public Grievance Intake Portal</p>
              <p style={{ fontSize: "14px", color: "#6b7280" }}>
                "Water leak near Main Street" / "पाणीपुरवठा खंडित झाला आहे" / "மின்சாரம் வரவில்லை"
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              if (msg.role === "system") {
                return (
                  <div key={index} style={styles.systemMessageRow}>
                    <div style={styles.systemBadge}>
                      🤝 {getMessageDisplayContent(msg)}
                    </div>
                  </div>
                );
              }

              const isUser = msg.role === "user";
              const isAgent = msg.role === "agent";
              const displayContent = getMessageDisplayContent(msg);


              return (
                <div
                  key={index}
                  style={{
                    ...styles.messageRow,
                    justifyContent: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      ...styles.bubble,
                      backgroundColor: isUser
                        ? "#2563eb"
                        : isAgent
                        ? "#1e1b4b"
                        : "#f3f4f6",
                      color: isUser || isAgent ? "white" : "#1f2937",
                      borderRadius: isUser
                        ? "16px 16px 2px 16px"
                        : "16px 16px 16px 2px",
                      border: isAgent ? "1px solid #312e81" : "none",
                    }}
                  >
                    {isAgent && (
                      <div style={styles.agentLabel}>
                        🛡️ Support Agent ({msg.sender_name || "Admin"})
                      </div>
                    )}
                    <div style={styles.bubbleText}>{displayContent}</div>

                    {msg.evidence_url && (
                      <div style={{ marginTop: "8px" }}>
                        <a href={msg.evidence_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                          <img
                            src={msg.evidence_url}
                            alt="Uploaded Evidence"
                            style={{
                              maxWidth: "100%",
                              maxHeight: "220px",
                              borderRadius: "8px",
                              objectFit: "cover",
                              border: "1px solid rgba(255,255,255,0.2)",
                              display: "block"
                            }}
                          />
                        </a>
                      </div>
                    )}

                    {msg.timestamp && (
                      <div
                        style={{
                          ...styles.timestamp,
                          color: isUser || isAgent ? "rgba(255,255,255,0.7)" : "#9ca3af",
                        }}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
              <div style={{ ...styles.bubble, backgroundColor: "#f3f4f6", color: "#6b7280" }}>
                {agentEngaged ? "💬 Transmitting to support agent..." : "🤖 AI is analyzing your grievance..."}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Evidence attachment preview */}
        {evidenceUrl && (
          <div style={styles.evidencePreview}>
            📎 Evidence attached: <a href={evidenceUrl} target="_blank" rel="noreferrer">View File</a>
          </div>
        )}

        {/* Input Controls */}
        <form onSubmit={sendMessage} style={styles.inputForm}>
          <input
            type="text"
            disabled={!citizenUser}
            placeholder={
              !citizenUser
                ? t("placeholderLoggedOut")
                : agentEngaged
                ? t("placeholderAgent")
                : isComplete
                ? t("placeholderComplete")
                : t("placeholderInput")
            }
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            style={styles.input}
          />

          <label style={styles.uploadBtn} title="Upload Evidence (Optional)">
            {uploading ? "⏳" : "📷"}
            <input type="file" disabled={!citizenUser} onChange={handleFileUpload} accept="image/*" style={{ display: "none" }} />
          </label>

          <button
            type="submit"
            disabled={loading || (!inputMessage.trim() && !evidenceUrl) || !citizenUser}
            style={{
              ...styles.sendBtn,
              opacity: loading || (!inputMessage.trim() && !evidenceUrl) || !citizenUser ? 0.6 : 1,
            }}
          >
            {t("send")}
          </button>

        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    minHeight: "88vh",
    backgroundColor: "#f8fafc",
  },
  chatCard: {
    width: "100%",
    maxWidth: "680px",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    height: "78vh",
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  title: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    margin: "4px 0 0 0",
    fontSize: "13px",
    color: "#64748b",
  },
  authBanner: {
    padding: "12px 20px",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    fontSize: "13px",
    borderBottom: "1px solid #fde68a",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  authBannerBtn: {
    padding: "4px 12px",
    backgroundColor: "#2563eb",
    color: "white",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "bold",
    textDecoration: "none",
  },
  newChatBtn: {
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "600",
    backgroundColor: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    cursor: "pointer",
  },
  analysisBar: {
    padding: "8px 20px",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chip: {
    fontSize: "12px",
    padding: "3px 8px",
    borderRadius: "12px",
    backgroundColor: "#e2e8f0",
    color: "#334155",
  },
  chatThread: {
    flex: 1,
    padding: "20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  emptyState: {
    margin: "auto",
    textAlign: "center",
    padding: "20px",
  },
  systemMessageRow: {
    display: "flex",
    justifyContent: "center",
    margin: "8px 0",
  },
  systemBadge: {
    fontSize: "12px",
    fontWeight: "600",
    backgroundColor: "#eff6ff",
    color: "#1e40af",
    padding: "6px 16px",
    borderRadius: "20px",
    border: "1px solid #93c5fd",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  messageRow: {
    display: "flex",
    width: "100%",
  },
  bubble: {
    maxWidth: "80%",
    padding: "12px 16px",
    fontSize: "14px",
    lineHeight: "1.5",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  agentLabel: {
    fontSize: "11px",
    fontWeight: "700",
    marginBottom: "4px",
    color: "#93c5fd",
  },
  bubbleText: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  timestamp: {
    fontSize: "10px",
    marginTop: "4px",
    textAlign: "right",
  },
  evidencePreview: {
    padding: "6px 20px",
    fontSize: "12px",
    backgroundColor: "#eff6ff",
    borderTop: "1px dashed #bfdbfe",
    color: "#1d4ed8",
  },
  inputForm: {
    display: "flex",
    padding: "12px 16px",
    borderTop: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
    gap: "8px",
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    outline: "none",
  },
  uploadBtn: {
    padding: "10px 12px",
    backgroundColor: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    padding: "10px 18px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
  },
};

export default Home;
