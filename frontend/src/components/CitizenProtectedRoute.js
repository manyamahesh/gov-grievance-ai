import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { CitizenAuthContext } from "../context/CitizenAuthContext";

function CitizenProtectedRoute({ children }) {
  const { citizenUser, loading } = useContext(CitizenAuthContext);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Verifying citizen session...</p>
      </div>
    );
  }

  if (!citizenUser) {
    return <Navigate to="/login" replace />;
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
    border: "4px solid #e2e8f0",
    borderTop: "4px solid #2563eb",
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

export default CitizenProtectedRoute;
