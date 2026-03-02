import { useState } from "react";
import API from "../api/api";

function Track() {
  const [sessionId, setSessionId] = useState("");
  const [data, setData] = useState(null);

  const fetchConversation = async () => {
    try {
      const res = await API.get(`/conversation/${sessionId}`);
      setData(res.data);
    } catch (error) {
      alert("Session not found.");
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "auto" }}>
      <h2>Track Complaint</h2>

      <input
        type="text"
        placeholder="Enter Session ID"
        value={sessionId}
        onChange={(e) => setSessionId(e.target.value)}
        style={{ width: "100%", padding: "10px" }}
      />

      <br /><br />

      <button onClick={fetchConversation}>Track</button>

      {data && (
        <div style={{ marginTop: "20px" }}>
          <p><strong>Total Messages:</strong> {data.total_messages}</p>

          {data.conversations.map((item, index) => (
            <div key={index} style={{ border: "1px solid #ccc", padding: "10px", marginTop: "10px" }}>
              <p><strong>Message:</strong> {item.message}</p>
              <p><strong>Priority:</strong> {item.priority}</p>
              <p><strong>Department:</strong> {item.department}</p>
              <p><strong>Status:</strong> {item.status || "N/A"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Track;