import { useState } from "react";
import API from "../api/api";

function Home() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const submitComplaint = async () => {
    if (!message.trim()) {
      alert("Please enter a complaint message.");
      return;
    }

    try {
      setLoading(true);
      setResponse(null);

      const res = await API.post("/chat", {
        message: message,
      });

      console.log("Backend Response:", res.data);
      setResponse(res.data);
      setMessage("");

    } catch (error) {
      console.log("FULL ERROR:", error);
      
      if (error.response) {
        console.log("Status:", error.response.status);
        console.log("Data:", error.response.data);
        alert(`Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else {
        alert("Server not reachable.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "auto" }}>
      <h2>Submit Complaint</h2>

      <textarea
        rows="4"
        style={{ width: "100%", padding: "10px" }}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Describe your issue..."
      />

      <br />
      <br />

      <button onClick={submitComplaint} disabled={loading}>
        {loading ? "Submitting..." : "Submit"}
      </button>

      {response && (
        <div style={{ marginTop: "30px", padding: "15px", border: "1px solid #ddd" }}>
          <p><strong>Session ID:</strong> {response.session_id}</p>
          <p><strong>Priority:</strong> {response.priority}</p>
          <p><strong>Department:</strong> {response.department}</p>
          {response.ticket_id && (
            <p><strong>Ticket ID:</strong> {response.ticket_id}</p>
          )}
          <p>{response.reply}</p>
        </div>
      )}
    </div>
  );
}

export default Home;