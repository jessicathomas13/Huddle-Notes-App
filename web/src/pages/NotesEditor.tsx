import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { apiFetch } from "../api/client";

export default function NoteEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");

  const socketRef = useRef<Socket | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdate = useRef(false); // prevents echoing our own broadcasts back into a save loop

  // Load the note once on mount
  useEffect(() => {
    if (!id) return;
    apiFetch(`/notes/${id}`)
      .then((note) => {
        setTitle(note.title);
        setContent(note.content);
        setLoading(false);
      })
      .catch(() => navigate("/notes")); // note not found or no access - bounce back
  }, [id, navigate]);

  // Set up the socket connection once
  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("token");

    const socket = io("http://localhost:3000", {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_note", { noteId: id });
    });

    // another collaborator edited - update our view without re-triggering a save
    socket.on("note_updated", (data: { content: string }) => {
      isRemoteUpdate.current = true;
      setContent(data.content);
    });

    return () => {
      socket.emit("leave_note", { noteId: id });
      socket.disconnect();
    };
  }, [id]);

  // Whenever content changes locally, broadcast it (debounced) and auto-save to the DB
  useEffect(() => {
    if (loading) return; // don't fire on initial load

    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false; // this change came from someone else, don't re-broadcast or save
      return;
    }

    setSaveStatus("saving");

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      // broadcast to other collaborators in real time
      socketRef.current?.emit("edit_note", { noteId: id, content });

      // persist to the database
      await apiFetch(`/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, content }),
      });
      setSaveStatus("saved");
    }, 500); // debounce: wait for a pause in typing before syncing/saving
  }, [content, title]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div style={{ color: "#F7F4EC", padding: "2rem", background: "#1C1B1A", height: "100vh" }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1C1B1A", padding: "40px", fontFamily: "Inter, sans-serif" }}>
      <button
        onClick={() => navigate("/notes")}
        style={{ background: "none", border: "none", color: "#8A8580", cursor: "pointer", marginBottom: "20px" }}
      >
        ← Back to notes
      </button>

      <div style={{ maxWidth: "720px", margin: "0 auto", background: "#F7F4EC", borderRadius: "8px", padding: "48px", minHeight: "70vh" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "'Source Serif 4', serif",
            fontSize: "32px",
            marginBottom: "24px",
            color: "#1C1B1A",
          }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing..."
          style={{
            width: "100%",
            minHeight: "50vh",
            border: "none",
            outline: "none",
            resize: "vertical",
            background: "transparent",
            fontFamily: "Inter, sans-serif",
            fontSize: "16px",
            lineHeight: 1.6,
            color: "#1C1B1A",
          }}
        />
      </div>

      <div style={{ textAlign: "center", marginTop: "16px", color: "#8A8580", fontSize: "13px" }}>
        {saveStatus === "saving" && "Saving..."}
        {saveStatus === "saved" && "Saved"}
      </div>
    </div>
  );
}