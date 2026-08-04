import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { CitizenAuthContext } from "../../context/CitizenAuthContext";
import Home from "../Home";

// Mock API module
jest.mock("../../api/api", () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

const mockContextValue = {
  citizenUser: { user_id: "test-user-123", username: "john_doe" },
  loading: false,
  loginCitizen: jest.fn(),
  signupCitizen: jest.fn(),
  logoutCitizen: jest.fn(),
};

describe("Home Component Chat UI", () => {
  test("renders AI Grievance Assistant title and welcome prompt", () => {
    render(
      <BrowserRouter>
        <CitizenAuthContext.Provider value={mockContextValue}>
          <Home />
        </CitizenAuthContext.Provider>
      </BrowserRouter>
    );
    expect(screen.getByText(/AI Grievance Assistant/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Welcome to Public Grievance Intake/i)
    ).toBeInTheDocument();
  });

  test("renders chat input box and send button", () => {
    render(
      <BrowserRouter>
        <CitizenAuthContext.Provider value={mockContextValue}>
          <Home />
        </CitizenAuthContext.Provider>
      </BrowserRouter>
    );
    const inputEl = screen.getByPlaceholderText(/Type your grievance or reply/i);
    const sendBtn = screen.getByRole("button", { name: /Send/i });

    expect(inputEl).toBeInTheDocument();
    expect(sendBtn).toBeInTheDocument();
  });
});
