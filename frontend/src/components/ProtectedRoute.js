import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AdminAuthContext } from "../context/AdminAuthContext";

function ProtectedRoute({ children }) {
  const { adminUser, adminLoading } = useContext(AdminAuthContext);

  if (adminLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Verifying admin session...</p>
      </div>
    );
  }

  if (!adminUser) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

const styles = {
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "80vh",
    backgroundColor: "#f8fafc",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #cbd5e1",
    borderTop: "4px solid #0f172a",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    marginTop: "16px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: "500",
  },
};

export default ProtectedRoute;