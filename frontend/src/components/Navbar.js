import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav style={styles.nav}>
      <h2 style={styles.logo}>Gov Grievance AI</h2>

      <div style={styles.links}>
        <Link to="/" style={styles.link}>Home</Link>
        <Link to="/track" style={styles.link}>Track Complaint</Link>
        <Link to="/admin" style={styles.link}>Admin Login</Link>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 40px",
    background: "#1f2937",
    color: "white"
  },
  logo: {
    margin: 0
  },
  links: {
    display: "flex",
    gap: "20px"
  },
  link: {
    color: "white",
    textDecoration: "none",
    fontWeight: "500"
  }
};

export default Navbar;
