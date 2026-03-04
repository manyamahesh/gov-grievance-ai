import { useState } from "react";
import API from "../api/api";

function Home() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState(null);

  const submitComplaint = async () => {
    if (!message) {
      alert("Please enter your complaint.");
      return;
    }

    try {
      const res = await API.post("/chat", { message });
      setResponse(res.data);
    } catch (error) {
      alert("Error submitting complaint.");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>AI Powered Grievance Portal</h1>

        <p style={styles.subtitle}>
          Submit your complaint and our AI system will route it to the correct
          department.
        </p>

        <textarea
          rows="4"
          placeholder="Describe your issue..."
          style={styles.textarea}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button style={styles.button} onClick={submitComplaint}>
          Submit Complaint
        </button>

        {response && (
          <div style={styles.result}>
            <h3>Complaint Submitted</h3>

            <p>
              <strong>Session ID:</strong> {response.session_id}
            </p>

            <p>
              <strong>Department:</strong> {response.department}
            </p>

            <p>
              <strong>Priority:</strong> {response.priority}
            </p>

            <p>{response.reply}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "90vh",
    background: "#f3f4f6",
  },

  card: {
    background: "white",
    padding: "40px",
    width: "500px",
    borderRadius: "10px",
    boxShadow: "0px 5px 20px rgba(0,0,0,0.1)",
  },

  title: {
    marginBottom: "10px",
  },

  subtitle: {
    marginBottom: "20px",
    color: "#555",
  },

  textarea: {
    width: "100%",
    padding: "10px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    marginBottom: "20px",
  },

  button: {
    width: "100%",
    padding: "12px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "5px",
    fontWeight: "bold",
    cursor: "pointer",
  },

  result: {
    marginTop: "25px",
    padding: "15px",
    background: "#f9fafb",
    borderRadius: "6px",
  },
};

export default Home;
