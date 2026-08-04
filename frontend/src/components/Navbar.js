import React, { useContext, useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { CitizenAuthContext } from "../context/CitizenAuthContext";
import { AdminAuthContext } from "../context/AdminAuthContext";
import { SUPPORTED_LANGUAGES, getTranslation } from "../utils/translations";
import API from "../api/api";

function Navbar() {
  const { citizenUser, logoutCitizen, selectedLanguage, setSelectedLanguage } = useContext(CitizenAuthContext);
  const { adminUser, logoutAdmin } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);
  const pollingRef = useRef(null);

  const isAdminPage =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/admin");

  const fetchUnread = async () => {
    if (!citizenUser) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await API.get("/notifications/unread-counts");
      setUnreadCount(res.data.unread_citizen_count || 0);
    } catch {
      // Ignore background notification fetch errors
    }
  };

  useEffect(() => {
    if (!isAdminPage && citizenUser) {
      fetchUnread();
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(fetchUnread, 10000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citizenUser, isAdminPage]);

  const handleCitizenLogout = async () => {
    await logoutCitizen();
    navigate("/login");
  };

  const handleAdminLogout = async () => {
    await logoutAdmin();
    navigate("/admin");
  };

  const t = (key) => getTranslation(key, selectedLanguage);

  // Render Admin Navigation Bar when on admin routes
  if (isAdminPage) {
    return (
      <nav style={styles.navAdmin}>
        <div style={styles.brandGroup}>
          <Link to={adminUser ? "/dashboard" : "/admin"} style={styles.logoLink}>
            <div style={styles.logoBadgeAdmin}>🏛️</div>
            <div>
              <h2 style={styles.logo}>Grievance Admin Portal</h2>
              <span style={styles.logoTaglineAdmin}>Official Government Operations</span>
            </div>
          </Link>
        </div>

        <div style={styles.links}>
          {adminUser ? (
            <>
              <Link to="/dashboard" style={styles.link}>
                Dashboard
              </Link>
              <Link to="/admin/users" style={styles.link}>
                👥 Citizens
              </Link>

              <div style={styles.userSection}>
                <span style={styles.userBadgeAdmin}>
                  <span style={styles.userDotAdmin}></span>
                  🛡️ {adminUser.username} ({adminUser.department || "All"})
                </span>
                <button onClick={handleAdminLogout} style={styles.logoutBtnAdmin}>
                  Admin Logout
                </button>
              </div>
            </>
          ) : (
            <div style={styles.unauthBadge}>
              <span style={styles.secureTagAdmin}>🔒 Officials Login</span>
            </div>
          )}
        </div>
      </nav>
    );
  }

  // Render Citizen Navigation Bar on citizen routes with Language Selector
  return (
    <nav style={styles.nav}>
      <div style={styles.brandGroup}>
        <Link to={citizenUser ? "/" : "/login"} style={styles.logoLink}>
          <div style={styles.logoBadge}>🏛️</div>
          <div>
            <h2 style={styles.logo}>{t("portalTitle")}</h2>
            <span style={styles.logoTagline}>{t("portalSubtitle")}</span>
          </div>
        </Link>
      </div>

      <div style={styles.links}>
        {/* Language Selector Dropdown */}
        <div style={styles.langSelectorBox}>
          <span style={styles.langIcon}>🌐</span>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={styles.langSelect}
            title="Select Application Language"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option
                key={lang.code}
                value={lang.code}
                style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
              >
                {lang.nativeName} ({lang.label})
              </option>
            ))}

          </select>
        </div>

        {citizenUser ? (
          <>
            <Link to="/" style={styles.link}>
              {t("home")}
            </Link>
            <Link to="/track" style={styles.linkWrapper}>
              <span>{t("myGrievances")}</span>
              {unreadCount > 0 && (
                <span style={styles.unreadBadgeNav} title={`${unreadCount} unread agent replies`}>
                  🔔 {unreadCount}
                </span>
              )}
            </Link>

            <div style={styles.userSection}>
              <span style={styles.userBadge}>
                <span style={styles.userDot}></span>
                {citizenUser.username}
              </span>
              <button onClick={handleCitizenLogout} style={styles.logoutBtn}>
                {t("logout")}
              </button>
            </div>
          </>
        ) : (
          <div style={styles.unauthBadge}>
            <span style={styles.secureTag}>{t("securePortal")}</span>
          </div>
        )}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 32px",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.15)",
  },
  navAdmin: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 32px",
    backgroundColor: "#1e1b4b",
    color: "#ffffff",
    borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
    boxShadow: "0 2px 12px rgba(30, 27, 75, 0.2)",
  },
  brandGroup: {
    display: "flex",
    alignItems: "center",
  },
  logoLink: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    color: "white",
    textDecoration: "none",
  },
  logoBadge: {
    fontSize: "24px",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255, 255, 255, 0.12)",
  },
  logoBadgeAdmin: {
    fontSize: "24px",
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(165, 180, 252, 0.3)",
  },
  logo: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "700",
    letterSpacing: "-0.3px",
    color: "#f8fafc",
  },
  logoTagline: {
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: "500",
    display: "block",
  },
  logoTaglineAdmin: {
    fontSize: "11px",
    color: "#a5b4fc",
    fontWeight: "500",
    display: "block",
  },
  links: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  link: {
    color: "#cbd5e1",
    textDecoration: "none",
    fontWeight: "500",
    fontSize: "14px",
    transition: "color 0.2s ease",
  },
  linkWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#cbd5e1",
    textDecoration: "none",
    fontWeight: "500",
    fontSize: "14px",
  },
  langSelectorBox: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: "4px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
  },
  langIcon: {
    fontSize: "14px",
  },
  langSelect: {
    backgroundColor: "transparent",
    color: "#ffffff",
    border: "none",
    fontSize: "13px",
    fontWeight: "600",
    outline: "none",
    cursor: "pointer",
  },
  unreadBadgeNav: {
    backgroundColor: "#ef4444",
    color: "white",
    fontSize: "11px",
    fontWeight: "bold",
    padding: "2px 7px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    gap: "2px",
  },
  userSection: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginLeft: "4px",
  },
  userBadge: {
    fontSize: "13px",
    color: "#e2e8f0",
    fontWeight: "600",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: "6px 14px",
    borderRadius: "20px",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  userBadgeAdmin: {
    fontSize: "13px",
    color: "#e0e7ff",
    fontWeight: "600",
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    padding: "6px 14px",
    borderRadius: "20px",
    border: "1px solid rgba(165, 180, 252, 0.3)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  userDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#10b981",
    display: "inline-block",
  },
  userDotAdmin: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#6366f1",
    display: "inline-block",
  },
  logoutBtn: {
    padding: "7px 16px",
    backgroundColor: "transparent",
    color: "#cbd5e1",
    border: "1px solid #334155",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    transition: "all 0.2s ease",
  },
  logoutBtnAdmin: {
    padding: "7px 16px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "700",
    transition: "all 0.2s ease",
  },
  unauthBadge: {
    display: "flex",
    alignItems: "center",
  },
  secureTag: {
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: "500",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  secureTagAdmin: {
    fontSize: "12px",
    color: "#c7d2fe",
    fontWeight: "600",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(165, 180, 252, 0.2)",
  },
};

export default Navbar;
