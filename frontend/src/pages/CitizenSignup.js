import React, { useState, useContext, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CitizenAuthContext } from "../context/CitizenAuthContext";

function CitizenSignup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { citizenUser, loading, signupCitizen } = useContext(CitizenAuthContext);
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && citizenUser) {
      navigate("/");
    }
  }, [citizenUser, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Please choose a valid username.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please check and re-enter.");
      return;
    }

    setSubmitting(true);

    try {
      await signupCitizen(username.trim(), password);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Registration failed. That username may already be taken."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || citizenUser) {
    return null;
  }

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const passwordTooShort = password.length > 0 && password.length < 6;

  return (
    <div style={styles.pageWrapper}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .signup-input:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
          outline: none !important;
        }
        .signup-btn:hover {
          background-color: #1d4ed8 !important;
        }
        .signup-btn:active {
          transform: translateY(1px);
        }
        .switch-link:hover {
          text-decoration: underline !important;
        }
        @media (max-width: 860px) {
          .right-civic-panel {
            display: none !important;
          }
          .left-form-panel {
            width: 100% !important;
            max-width: 100% !important;
            padding: 32px 24px !important;
          }
        }
      `}</style>

      <div style={styles.containerCard}>
        {/* Left Panel - Interactive Form */}
        <div className="left-form-panel" style={styles.leftPanel}>
          <div style={styles.formHeader}>
            <div style={styles.badgeTag}>Citizen Registration</div>
            <h1 style={styles.title}>Create Account</h1>
            <p style={styles.subtitle}>
              Register your official account to lodge grievances and receive automated resolution updates.
            </p>
          </div>

          {error && (
            <div style={styles.errorBanner}>
              <span style={styles.errorIcon}>⚠️</span>
              <div style={styles.errorText}>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="signup-username" style={styles.label}>
                Choose Username
              </label>
              <input
                id="signup-username"
                className="signup-input"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. john_doe"
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label htmlFor="signup-password" style={styles.label}>
                Password
              </label>
              <div style={styles.passwordWrapper}>
                <input
                  id="signup-password"
                  className="signup-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  style={passwordTooShort ? styles.inputError : styles.inputPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.togglePasswordBtn}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
              {passwordTooShort && (
                <span style={styles.inlineHintError}>
                  Password must be at least 6 characters.
                </span>
              )}
            </div>

            <div style={styles.inputGroup}>
              <label htmlFor="signup-confirm-password" style={styles.label}>
                Confirm Password
              </label>
              <div style={styles.passwordWrapper}>
                <input
                  id="signup-confirm-password"
                  className="signup-input"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  style={passwordMismatch ? styles.inputError : styles.inputPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.togglePasswordBtn}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? "👁️" : "🙈"}
                </button>
              </div>
              {passwordMismatch && (
                <span style={styles.inlineHintError}>
                  Passwords do not match.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || passwordMismatch || passwordTooShort}
              className="signup-btn"
              style={
                submitting || passwordMismatch || passwordTooShort
                  ? styles.submitBtnDisabled
                  : styles.submitBtn
              }
            >
              {submitting ? (
                <div style={styles.btnLoadingWrapper}>
                  <div style={styles.btnSpinner}></div>
                  <span>Creating Account...</span>
                </div>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div style={styles.footer}>
            <span style={{ color: "#64748b" }}>Already have an account? </span>
            <Link to="/login" className="switch-link" style={styles.switchLink}>
              Sign in here →
            </Link>
          </div>
        </div>

        {/* Right Panel - Civic Identity Showcase */}
        <div className="right-civic-panel" style={styles.rightPanel}>
          <div style={styles.rightContent}>
            <div style={styles.brandTitleBlock}>
              <div style={styles.civicEmblem}>🏛️</div>
              <h2 style={styles.brandName}>Gov Grievance AI</h2>
              <p style={styles.brandTagline}>
                Direct citizen empowerment through intelligent municipal tracking
              </p>
            </div>

            <div style={styles.servicesGrid}>
              <div style={styles.serviceCard}>
                <span style={styles.serviceIcon}>💧</span>
                <div>
                  <h4 style={styles.serviceTitle}>Water & Sanitation</h4>
                  <p style={styles.serviceDesc}>Pipeline leaks, water supply, sewage overflow</p>
                </div>
              </div>

              <div style={styles.serviceCard}>
                <span style={styles.serviceIcon}>🛣️</span>
                <div>
                  <h4 style={styles.serviceTitle}>Roads & Infrastructure</h4>
                  <p style={styles.serviceDesc}>Potholes, street lighting, traffic signals</p>
                </div>
              </div>

              <div style={styles.serviceCard}>
                <span style={styles.serviceIcon}>⚡</span>
                <div>
                  <h4 style={styles.serviceTitle}>Electricity & Power</h4>
                  <p style={styles.serviceDesc}>Power cuts, faulty transformers, dangerous wiring</p>
                </div>
              </div>

              <div style={styles.serviceCard}>
                <span style={styles.serviceIcon}>🧹</span>
                <div>
                  <h4 style={styles.serviceTitle}>Waste & Cleanliness</h4>
                  <p style={styles.serviceDesc}>Garbage disposal, street sweeping, hygiene</p>
                </div>
              </div>
            </div>

            <div style={styles.trustFooter}>
              <div style={styles.trustBadge}>
                <span>✨ Instant Case File</span>
              </div>
              <div style={styles.trustBadge}>
                <span>🔒 Privacy Protected</span>
              </div>
              <div style={styles.trustBadge}>
                <span>⚡ Verified Updates</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageWrapper: {
    minHeight: "calc(100vh - 70px)",
    backgroundColor: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  containerCard: {
    width: "100%",
    maxWidth: "960px",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 20px 40px -15px rgba(15, 23, 42, 0.12), 0 0 1px 1px rgba(15, 23, 42, 0.05)",
    display: "flex",
    overflow: "hidden",
    minHeight: "580px",
  },
  leftPanel: {
    width: "50%",
    padding: "44px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  formHeader: {
    marginBottom: "24px",
  },
  badgeTag: {
    display: "inline-block",
    backgroundColor: "#ecfdf5",
    color: "#047857",
    fontSize: "12px",
    fontWeight: "700",
    padding: "4px 10px",
    borderRadius: "20px",
    marginBottom: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    marginTop: "8px",
    marginBottom: 0,
    fontSize: "14px",
    color: "#64748b",
    lineHeight: "1.5",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  errorIcon: {
    fontSize: "16px",
  },
  errorText: {
    color: "#dc2626",
    fontSize: "13px",
    fontWeight: "600",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    color: "#0f172a",
    backgroundColor: "#ffffff",
    transition: "all 0.2s ease",
  },
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputPassword: {
    width: "100%",
    padding: "12px 42px 12px 14px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    color: "#0f172a",
    backgroundColor: "#ffffff",
    transition: "all 0.2s ease",
  },
  inputError: {
    width: "100%",
    padding: "12px 42px 12px 14px",
    borderRadius: "10px",
    border: "1px solid #ef4444",
    fontSize: "14px",
    color: "#0f172a",
    backgroundColor: "#fef2f2",
    transition: "all 0.2s ease",
  },
  inlineHintError: {
    fontSize: "12px",
    color: "#dc2626",
    fontWeight: "500",
    marginTop: "2px",
  },
  togglePasswordBtn: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    padding: "2px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
  },
  submitBtn: {
    marginTop: "8px",
    padding: "14px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "background-color 0.2s ease, transform 0.1s ease",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
  },
  submitBtnDisabled: {
    marginTop: "8px",
    padding: "14px",
    backgroundColor: "#93c5fd",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "not-allowed",
  },
  btnLoadingWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
  },
  btnSpinner: {
    width: "18px",
    height: "18px",
    border: "2px solid rgba(255, 255, 255, 0.4)",
    borderTop: "2px solid #ffffff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  footer: {
    marginTop: "24px",
    textAlign: "center",
    fontSize: "14px",
  },
  switchLink: {
    color: "#2563eb",
    fontWeight: "700",
    textDecoration: "none",
    marginLeft: "4px",
  },
  rightPanel: {
    width: "50%",
    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
    color: "#ffffff",
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  rightContent: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    justifyContent: "space-between",
  },
  brandTitleBlock: {
    marginBottom: "24px",
  },
  civicEmblem: {
    fontSize: "36px",
    marginBottom: "12px",
  },
  brandName: {
    fontSize: "24px",
    fontWeight: "800",
    margin: 0,
    color: "#f8fafc",
    letterSpacing: "-0.5px",
  },
  brandTagline: {
    fontSize: "13px",
    color: "#94a3b8",
    marginTop: "6px",
    marginBottom: 0,
    lineHeight: "1.4",
  },
  servicesGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    margin: "16px 0",
  },
  serviceCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "12px 16px",
    backdropFilter: "blur(4px)",
  },
  serviceIcon: {
    fontSize: "22px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: "700",
    color: "#f1f5f9",
  },
  serviceDesc: {
    margin: 0,
    fontSize: "11px",
    color: "#94a3b8",
    marginTop: "2px",
  },
  trustFooter: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "16px",
  },
  trustBadge: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#cbd5e1",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: "5px 10px",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
};

export default CitizenSignup;
