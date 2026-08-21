import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import "./NotesList.css";

interface Note {
  id: string;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  updatedAt: string;
}

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    setLoading(true);
    setError(null);
    try {
        const data = await apiFetch("/notes");
        setNotes(data);
    } catch (err) {
        setError("Couldn't load notes.");
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

    async function handleDelete(e: React.MouseEvent, noteId: string, title: string) {
        e.stopPropagation();

        const confirmed = window.confirm(`Delete "${title || "Untitled"}"? This can't be undone.`);
        if (!confirmed) return;

        setDeletingId(noteId);
        try {
            await apiFetch(`/notes/${noteId}`, { method: "DELETE" });
            setNotes((prev) => prev.filter((n) => n.id !== noteId)); // optimistic removal, no full refetch needed
        } catch (err) {
            setError("Couldn't delete note.");
        } finally {
            setDeletingId(null);
        }
    }

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <div className="notes-list-page">
      <div className="notes-sidebar">
        <div className="notes-sidebar-header">
          <h1>Huddle Notes</h1>
          <button className="notes-logout-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>

        <button className="notes-create-btn" onClick={handleCreate}>
          + New note
        </button>

        {loading && <p className="notes-loading-state">Loading...</p>}

        {error && (
          <p className="notes-error-state">
            {error}
            <button className="notes-retry-btn" onClick={loadNotes}>
              Retry
            </button>
          </p>
        )}

        {!loading && !error && notes.length === 0 && (
          <p className="notes-empty-state">No notes yet. Create your first one.</p>
        )}

        {notes.map((note) => (
          <div key={note.id} className="note-card" onClick={() => navigate(`/notes/${note.id}`)}>
            <button
              className="note-delete-btn"
              onClick={(e) => handleDelete(e, note.id, note.title)}
              disabled={deletingId === note.id}
              title="Delete note"
            >
              {deletingId === note.id ? "..." : "✕"}
            </button>

            <div className="note-card-title">{note.title || "Untitled"}</div>
            <div className="note-card-date">{new Date(note.updatedAt).toLocaleDateString()}</div>

            {note.summary && <div className="note-card-summary">{note.summary}</div>}

            {note.tags && note.tags.length > 0 && (
              <div className="note-card-tags">
                {note.tags.map((tag) => (
                  <span key={tag} className="note-card-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="notes-empty-panel">Select a note or create a new one</div>
    </div>
  );
}