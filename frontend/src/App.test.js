import { render, screen } from "@testing-library/react";
import App from "./App";

// Mock API module
jest.mock("./api/api", () => ({
  get: jest.fn(() => Promise.reject(new Error("Unauthenticated"))),
  post: jest.fn(),
}));

test("renders Citizen Login page by default for unauthenticated visitors", async () => {
  render(<App />);
  const welcomeText = await screen.findByText(/Welcome Back/i);
  expect(welcomeText).toBeInTheDocument();
});
