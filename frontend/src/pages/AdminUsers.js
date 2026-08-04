import React, { useEffect, useState } from "react";
import API from "../api/api";

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await API.get("/admin/users");
      setUsers(res.data.users || []);
    } catch (err) {
      setError("Failed to fetch registered citizens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2>👥 Registered Citizens Directory</h2>
          <p style={styles.subtitle}>
            Overview of citizen user accounts registered in the portal.
          </p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b" }}>Loading citizen list...</p>
        ) : users.length === 0 ? (
          <div style={styles.emptyNotice}>No citizen accounts registered yet.</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Username</th>
                  <th style={styles.th}>User ID</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Registration Date</th>
                  <th style={styles.th}>Grievances Lodged</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr key={u.user_id || idx} style={styles.tr}>
                    <td style={styles.td}>
                      <strong>{u.username}</strong>
                    </td>
                    <td style={{ ...styles.td, fontFamily: "monospace", fontSize: "12px", color: "#64748b" }}>
                      {u.user_id ? u.user_id.slice(0, 13) + "..." : "N/A"}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.roleBadge}>{u.role || "citizen"}</span>
                    </td>
                    <td style={styles.td}>
                      {u.created_at ? new Date(u.created_at).toLocaleString() : "N/A"}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.countBadge}>{u.complaint_count || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

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
    maxWidth: "900px",
    backgroundColor: "white",
    padding: "28px",
    borderRadius: "12px",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.05)",
  },
  header: {
    marginBottom: "24px",
  },
  subtitle: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "4px",
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
    padding: "30px",
    textAlign: "center",
    color: "#64748b",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  thRow: {
    backgroundColor: "#f1f5f9",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontWeight: "bold",
    color: "#334155",
    borderBottom: "2px solid #cbd5e1",
  },
  tr: {
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    padding: "12px 14px",
    color: "#0f172a",
  },
  roleBadge: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "bold",
  },
  countBadge: {
    backgroundColor: "#f1f5f9",
    color: "#0f172a",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "bold",
  },
};

export default AdminUsers;
