import React, { createContext, useState, useEffect } from "react";
import API from "../api/api";

export const CitizenAuthContext = createContext();

export function CitizenAuthProvider({ children }) {
  const [citizenUser, setCitizenUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguageState] = useState(
    () => localStorage.getItem("app_language") || "en"
  );

  const setSelectedLanguage = (lang) => {
    setSelectedLanguageState(lang);
    localStorage.setItem("app_language", lang);
  };

  const fetchCurrentCitizen = async () => {
    try {
      setLoading(true);
      const res = await API.get("/me");
      setCitizenUser(res.data);
    } catch {
      setCitizenUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentCitizen();
  }, []);

  const loginCitizen = async (username, password) => {
    const res = await API.post("/login", { username, password });
    // Set user directly from response — no second /me round-trip, no race condition
    const userData = res.data?.user ?? res.data;
    setCitizenUser(userData);
    return res.data;
  };

  const signupCitizen = async (username, password) => {
    const res = await API.post("/signup", { username, password });
    // Set user directly from signup response — avoids race condition where
    // browser hasn't committed the Set-Cookie before the /me check fires.
    const userData = res.data?.user ?? res.data;
    setCitizenUser(userData);
    return res.data;
  };

  const logoutCitizen = async () => {
    try {
      await API.post("/logout");
    } catch {
      // ignore
    }
    setCitizenUser(null);
  };

  return (
    <CitizenAuthContext.Provider
      value={{
        citizenUser,
        loading,
        selectedLanguage,
        setSelectedLanguage,
        fetchCurrentCitizen,
        loginCitizen,
        signupCitizen,
        logoutCitizen,
      }}
    >
      {children}
    </CitizenAuthContext.Provider>
  );
}
