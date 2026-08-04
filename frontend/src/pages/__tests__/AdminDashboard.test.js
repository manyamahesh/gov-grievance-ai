import React from "react";
import { render, screen } from "@testing-library/react";
import AdminDashboard from "../AdminDashboard";

jest.mock("../../api/api", () => ({
  get: jest.fn((url) => {
    if (url.includes("/admin/me")) {
      return Promise.resolve({
        data: { username: "admin", role: "super_admin", department: "All" },
      });
    }
    if (url.includes("/analytics/overview")) {
      return Promise.resolve({
        data: {
          total_complaints: 10,
          high_priority_complaints: 3,
          complaints_by_department: [{ _id: "Water Supply Department", count: 5 }],
          complaints_by_priority: [{ _id: "HIGH", count: 3 }],
          tickets_by_status: [{ _id: "OPEN", count: 2 }],
          cached: false,
        },
      });
    }
    if (url.includes("/tickets")) {
      return Promise.resolve({
        data: {
          tickets: [
            {
              ticket_id: "test-ticket-101",
              department: "Water Supply Department",
              message: "Main line broken",
              priority: "HIGH",
              status: "OPEN",
              created_at: new Date().toISOString(),
            },
          ],
        },
      });
    }
    return Promise.reject(new Error("Not found"));
  }),
  post: jest.fn(),
  put: jest.fn(),
}));

// Mock Recharts ResponsiveContainer to avoid size observer errors in JSDOM
jest.mock("recharts", () => {
  const OriginalModule = jest.requireActual("recharts");
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: "800px", height: "300px" }}>{children}</div>
    ),
  };
});

describe("AdminDashboard Component", () => {
  test("renders dashboard title and tickets list", async () => {
    render(<AdminDashboard />);
    expect(
      screen.getByText(/Grievance Admin Operations Center/i)
    ).toBeInTheDocument();
    
    const ticketEl = await screen.findByText(/test-ticket-101/i);
    expect(ticketEl).toBeInTheDocument();
  });
});
