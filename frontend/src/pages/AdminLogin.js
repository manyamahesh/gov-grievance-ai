import { useState } from "react";
import API from "../api/api";

function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    if (!username || !password) {
      alert("Enter username and password");
      return;
    }

    try {
      const res = await API.post("/admin/login", {
        username,
        password,
      });

      localStorage.setItem("token", res.data.access_token);

      window.location.href = "/dashboard";
    } catch (error) {
      alert("Invalid credentials");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Admin Login</h2>

        <input
          type="text"
          placeholder="Username"
          style={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          style={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button style={styles.button} onClick={login}>
          Login
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "90vh",
    background: "#f3f4f6",
  },

  card: {
    background: "white",
    padding: "40px",
    width: "350px",
    borderRadius: "10px",
    boxShadow: "0px 5px 20px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
  },

  title: {
    marginBottom: "25px",
    textAlign: "center",
  },

  input: {
    padding: "10px",
    marginBottom: "15px",
    borderRadius: "5px",
    border: "1px solid #ccc",
  },

  button: {
    padding: "12px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "5px",
    fontWeight: "bold",
    cursor: "pointer",
  },
};

export default AdminLogin;
