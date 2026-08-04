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
    await fetchCurrentCitizen();
    return res.data;
  };

  const signupCitizen = async (username, password) => {
    const res = await API.post("/signup", { username, password });
    await fetchCurrentCitizen();
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
