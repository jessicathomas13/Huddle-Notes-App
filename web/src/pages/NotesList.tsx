import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    try {
      const data = await apiFetch("/notes");
      setNotes(data);
    } catch (err) {
      setError("Couldn't load notes. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      const newNote = await apiFetch("/notes", {
        method: "POST",
        body: JSON.stringify({ title: "Untitled note", content: "" }),
      });
      navigate(`/notes/${newNote.id}`); // jump straight into the new note
    } catch (err) {
      setError("Couldn't create note.");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#1C1B1A", fontFamily: "Inter, sans-serif" }}>
      <div style={{ width: "320px", borderRight: "1px solid #3D3B38", padding: "24px", color: "#F7F4EC" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: "22px", margin: 0 }}>Huddle Notes</h1>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#8A8580", cursor: "pointer", fontSize: "13px" }}>
            Log out
          </button>
        </div>

        <button
          onClick={handleCreate}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "20px",
            background: "#3D5A80",
            color: "#F7F4EC",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          + New note
        </button>

        {loading && <p style={{ color: "#8A8580" }}>Loading...</p>}
        {error && <p style={{ color: "#C4623E" }}>{error}</p>}

        {!loading && notes.length === 0 && (
          <p style={{ color: "#8A8580", fontSize: "14px" }}>No notes yet. Create your first one.</p>
        )}

        {notes.map((note) => (
          <div
            key={note.id}
            onClick={() => navigate(`/notes/${note.id}`)}
            style={{
              padding: "12px",
              marginBottom: "8px",
              background: "#242322",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 500 }}>{note.title || "Untitled"}</div>
            <div style={{ fontSize: "12px", color: "#8A8580", marginTop: "4px" }}>
              {new Date(note.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8A8580" }}>
        Select a note or create a new one
      </div>
    </div>
  );
}