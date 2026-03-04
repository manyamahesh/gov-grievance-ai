import { useEffect, useState } from "react";
import API from "../api/api";

function AdminDashboard() {
  const [tickets, setTickets] = useState([]);

  const fetchTickets = async () => {
    try {
      const res = await API.get("/tickets?skip=0&limit=20");
      setTickets(res.data.tickets);
    } catch (error) {
      alert("Error fetching tickets");
    }
  };

  const updateStatus = async (ticketId, status) => {
    try {
      await API.put(`/ticket/${ticketId}/status`, { status });
      fetchTickets();
    } catch {
      alert("Failed to update status");
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const getPriorityColor = (priority) => {
    if (priority === "HIGH") return "#dc2626";
    if (priority === "MEDIUM") return "#f59e0b";
    return "#16a34a";
  };

  const getStatusColor = (status) => {
    if (status === "OPEN") return "#dc2626";
    if (status === "IN_PROGRESS") return "#f59e0b";
    if (status === "RESOLVED") return "#16a34a";
    return "#6b7280";
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Admin Dashboard</h2>

      {tickets.length === 0 ? (
        <p>No tickets available.</p>
      ) : (
        tickets.map((ticket) => (
          <div key={ticket.ticket_id} style={styles.card}>
            <div style={styles.row}>
              <strong>Ticket ID:</strong> {ticket.ticket_id}
            </div>

            <div style={styles.row}>
              <strong>Department:</strong> {ticket.department}
            </div>

            <div style={styles.row}>
              <strong>Message:</strong>
              <p style={{ marginTop: "5px" }}>{ticket.message}</p>
            </div>

            <div style={styles.row}>
              <strong>Priority:</strong>
              <span
                style={{
                  ...styles.badge,
                  backgroundColor: getPriorityColor(ticket.priority),
                }}
              >
                {ticket.priority}
              </span>
            </div>

            <div style={styles.row}>
              <strong>Status:</strong>
              <span
                style={{
                  ...styles.badge,
                  backgroundColor: getStatusColor(ticket.status),
                }}
              >
                {ticket.status}
              </span>
            </div>

            <select
              style={styles.dropdown}
              onChange={(e) =>
                updateStatus(ticket.ticket_id, e.target.value)
              }
              defaultValue=""
            >
              <option value="" disabled>
                Update Status
              </option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        ))
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "800px",
    margin: "40px auto",
  },

  title: {
    marginBottom: "20px",
  },

  card: {
    background: "white",
    padding: "20px",
    marginBottom: "20px",
    borderRadius: "10px",
    boxShadow: "0px 5px 20px rgba(0,0,0,0.1)",
  },

  row: {
    marginBottom: "10px",
  },

  badge: {
    color: "white",
    padding: "4px 10px",
    borderRadius: "6px",
    marginLeft: "10px",
    fontSize: "12px",
  },

  dropdown: {
    marginTop: "10px",
    padding: "8px",
    borderRadius: "5px",
  },
};

export default AdminDashboard;
