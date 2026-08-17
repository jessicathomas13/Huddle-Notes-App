import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasRun = useRef(false); // guards against StrictMode's double-invoke in dev

  useEffect(() => {
    if (hasRun.current) return; // skip the second invocation entirely
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("token", token);
      navigate("/notes");
    } else {
      navigate("/");
    }
  }, [navigate]);

  return <div style={{ color: "#F7F4EC", padding: "2rem" }}>Signing you in...</div>;
}