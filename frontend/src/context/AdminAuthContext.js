import React, { createContext, useState, useEffect } from "react";
import API from "../api/api";

export const AdminAuthContext = createContext();

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [adminLoading, setAdminLoading] = useState(true);

  const fetchCurrentAdmin = async () => {
    try {
      setAdminLoading(true);
      const res = await API.get("/admin/me");
      setAdminUser(res.data);
    } catch {
      setAdminUser(null);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentAdmin();
  }, []);

  const loginAdmin = async (username, password) => {
    const res = await API.post("/admin/login", { username, password });
    await fetchCurrentAdmin();
    return res.data;
  };

  const logoutAdmin = async () => {
    try {
      await API.post("/admin/logout");
    } catch {
      // ignore
    }
    setAdminUser(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        adminLoading,
        fetchCurrentAdmin,
        loginAdmin,
        logoutAdmin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}
