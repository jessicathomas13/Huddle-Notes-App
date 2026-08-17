export default function Login() {
  const handleLogin = () => {
    // full page redirect to your backend's Google OAuth route
    window.location.href = "http://localhost:3000/auth/google";
  };

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#1C1B1A" }}>
      <button
        onClick={handleLogin}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          background: "#F7F4EC",
          color: "#1C1B1A",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}