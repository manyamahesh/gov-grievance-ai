import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AdminAuthContext } from "../context/AdminAuthContext";

function AdminLogin() {
  const { loginAdmin, adminUser } = useContext(AdminAuthContext);
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (adminUser) {
    navigate("/dashboard");
  }

  const login = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      setErrorMsg("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      await loginAdmin(username, password);
      navigate("/dashboard");
    } catch (error) {
      setErrorMsg(
        error.response?.data?.detail || "Invalid credentials. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconHeader}>🏛️</div>
        <h2 style={styles.title}>Admin Portal Login</h2>
        <p style={styles.subtitle}>Secure Access for Government Officials</p>

        {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}

        <form onSubmit={login}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              placeholder="e.g. admin, water_admin"
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Logging in..." : "Login to Dashboard"}
          </button>
        </form>

        <div style={styles.credentialsHint}>
          <p style={{ margin: "0 0 4px 0", fontWeight: "600" }}>Demo Credentials:</p>
          <div>• Super Admin: <code>admin</code> / <code>admin123</code></div>
          <div>• Water Admin: <code>water_admin</code> / <code>admin123</code></div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "88vh",
    background: "#f8fafc",
  },
  card: {
    background: "white",
    padding: "36px",
    width: "100%",
    maxWidth: "400px",
    borderRadius: "12px",
    boxShadow: "0px 10px 25px rgba(0,0,0,0.08)",
  },
  iconHeader: {
    fontSize: "36px",
    textAlign: "center",
    marginBottom: "10px",
  },
  title: {
    textAlign: "center",
    margin: "0 0 4px 0",
    color: "#0f172a",
    fontSize: "22px",
  },
  subtitle: {
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
    marginBottom: "24px",
  },
  errorBanner: {
    padding: "10px 14px",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: "6px",
    fontSize: "13px",
    marginBottom: "16px",
  },
  inputGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "12px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "8px",
  },
  credentialsHint: {
    marginTop: "24px",
    padding: "12px",
    backgroundColor: "#f1f5f9",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#475569",
  },
};

export default AdminLogin;
