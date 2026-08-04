import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Track from "./pages/Track";
import CitizenLogin from "./pages/CitizenLogin";
import CitizenSignup from "./pages/CitizenSignup";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import ProtectedRoute from "./components/ProtectedRoute";
import CitizenProtectedRoute from "./components/CitizenProtectedRoute";
import Navbar from "./components/Navbar";
import { CitizenAuthProvider } from "./context/CitizenAuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";

function App() {
  return (
    <Router>
      <AdminAuthProvider>
        <CitizenAuthProvider>
          <Navbar />

          <Routes>
            <Route
              path="/"
              element={
                <CitizenProtectedRoute>
                  <Home />
                </CitizenProtectedRoute>
              }
            />
            <Route
              path="/track"
              element={
                <CitizenProtectedRoute>
                  <Track />
                </CitizenProtectedRoute>
              }
            />
            <Route path="/login" element={<CitizenLogin />} />
            <Route path="/signup" element={<CitizenSignup />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
          </Routes>
        </CitizenAuthProvider>
      </AdminAuthProvider>
    </Router>
  );
}

export default App;
