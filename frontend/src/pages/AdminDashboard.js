import { useEffect, useState } from "react";
import API from "../api/api";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

const LIMIT = 5; // tickets per page

function AdminDashboard() {
  const [tickets, setTickets] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const res = await API.get("/analytics/overview");
      setAnalytics(res.data);
    } catch (error) {
      console.log("Analytics fetch failed");
    }
  };

  // Fetch tickets
  const fetchTickets = async () => {
    try {
      const skip = (currentPage - 1) * LIMIT;
      let url = `/tickets?skip=${skip}&limit=${LIMIT}`;

      if (statusFilter !== "ALL") {
        url += `&status=${statusFilter}`;
      }

      const res = await API.get(url);

      setTickets(res.data.tickets);
      setTotalTickets(res.data.total_tickets);
    } catch (error) {
      localStorage.removeItem("token");
      window.location.href = "/admin";
    }
  };

  const updateStatus = async (ticketId, newStatus) => {
    try {
      await API.put(`/ticket/${ticketId}/status`, {
        status: newStatus,
      });

      fetchTickets();
      fetchAnalytics();
    } catch {
      alert("Failed to update ticket.");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/admin";
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, currentPage]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const totalPages = Math.ceil(totalTickets / LIMIT);

  const departmentChartData = analytics
    ? {
        labels: analytics.complaints_by_department.map(
          (item) => item._id
        ),
        datasets: [
          {
            label: "Complaints by Department",
            data: analytics.complaints_by_department.map(
              (item) => item.count
            ),
            backgroundColor: "#4f46e5",
          },
        ],
      }
    : null;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <h2>Admin Dashboard</h2>
        <button onClick={logout}>Logout</button>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "15px",
            marginBottom: "30px",
          }}
        >
          <StatCard title="Total Complaints" value={analytics.total_complaints} />
          <StatCard title="High Priority" value={analytics.high_priority_complaints} />
          <StatCard
            title="Open Tickets"
            value={
              analytics.tickets_by_status.find((s) => s._id === "OPEN")?.count || 0
            }
          />
          <StatCard
            title="Resolved"
            value={
              analytics.tickets_by_status.find((s) => s._id === "RESOLVED")?.count || 0
            }
          />
        </div>
      )}

      {/* Chart */}
      {departmentChartData && (
        <div style={{ marginBottom: "40px" }}>
          <Bar data={departmentChartData} />
        </div>
      )}

      {/* Filter */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ marginRight: "10px" }}>Filter by Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => {
            setCurrentPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          <option value="ALL">ALL</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>

      {/* Tickets */}
      {tickets.map((ticket) => (
        <div
          key={ticket.ticket_id}
          style={{
            border: "1px solid #ddd",
            padding: "20px",
            marginBottom: "15px",
            borderRadius: "8px",
          }}
        >
          <p><strong>ID:</strong> {ticket.ticket_id}</p>
          <p><strong>Message:</strong> {ticket.message}</p>
          <p><strong>Department:</strong> {ticket.department}</p>

          <p>
            <strong>Priority:</strong>{" "}
            <Badge type="priority" value={ticket.priority} />
          </p>

          <p>
            <strong>Status:</strong>{" "}
            <Badge type="status" value={ticket.status} />
          </p>

          <select
            onChange={(e) =>
              updateStatus(ticket.ticket_id, e.target.value)
            }
            defaultValue=""
          >
            <option value="" disabled>Update Status</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      ))}

      {/* Pagination */}
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            style={{
              margin: "5px",
              padding: "6px 12px",
              background: currentPage === i + 1 ? "#111827" : "#e5e7eb",
              color: currentPage === i + 1 ? "white" : "black",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

const StatCard = ({ title, value }) => (
  <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
    <h4>{title}</h4>
    <h2>{value}</h2>
  </div>
);

const Badge = ({ type, value }) => {
  const colors = {
    HIGH: "#dc2626",
    MEDIUM: "#f59e0b",
    LOW: "#16a34a",
    OPEN: "#2563eb",
    IN_PROGRESS: "#9333ea",
    RESOLVED: "#16a34a",
    REJECTED: "#6b7280",
  };

  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: "6px",
        background: colors[value],
        color: "white",
      }}
    >
      {value}
    </span>
  );
};

export default AdminDashboard;