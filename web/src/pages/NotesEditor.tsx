import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { apiFetch } from "../api/client";
import "./NotesEditor.css";
import { getCurrentUserId } from "../api/auth";

export default function NoteEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareEmail, setShareEmail] = useState('');
    const [shareError, setShareError] = useState('');
    const [shareSuccess, setShareSuccess] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [owner, setOwner] = useState<{ id: string; email: string; name: string; avatarUrl?: string } | null>(null);
    const [collaborators, setCollaborators] = useState<{ id: string; email: string; name: string; avatarUrl?: string }[]>([]);
    const [activeUsers, setActiveUsers] = useState<{ userId: string; name: string; avatarUrl?: string }[]>([]);
    const [isOwner, setIsOwner] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isRemoteUpdate = useRef(false); // prevents echoing our own broadcasts back into a save loop

    // const contentRef = useRef(content);
    // const idRef = useRef(id);

    const [summary, setSummary] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Grows the textarea to fit its content instead of scrolling internally
    function autoResize() {
        const el = contentTextareaRef.current;
        if (!el) return;
        el.style.height = "auto"; // reset first so it can shrink too, not just grow
        el.style.height = `${el.scrollHeight}px`;
    }

    // Resize once after the note's content loads (initial render needs a height too)
    useEffect(() => {
        if (!loading) autoResize();
    }, [loading]);

    // useEffect(() => {
    //     contentRef.current = content;
    // }, [content]);

    // Load the note once on mount
    useEffect(() => {
        if (!id) return;
        apiFetch(`/notes/${id}`).then((note) => {
            setTitle(note.title);
            setContent(note.content);
            setIsOwner(note.ownerId === getCurrentUserId());
            setLoading(false);
        }).catch(() => navigate("/notes"));
    }, [id, navigate]);

    // Set up the socket connection once
    useEffect(() => {
        if (!id) return;
        const token = localStorage.getItem("token");

        const socket = io(import.meta.env.VITE_API_URL || "http://localhost:3000", {
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

        // backend sends the full current list of who's in this note's room
        socket.on('presence_update', (users: { userId: string; name: string; avatarUrl?: string }[]) => {
            setActiveUsers(users);
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

    // useEffect(() => {
    //     return () => {
    //         if (contentRef.current.trim().length > 0) {
    //             // fire-and-forget : we're leaving the page, no need to wait or update UI here
    //             apiFetch(`/notes/${idRef.current}/summarize`, { method: 'POST' }).catch(() => {
    //             // silently ignore  
    //             });
    //         }
    //     };
    // }, []);

    useEffect(() => {
        if (!id) return;
        apiFetch(`/notes/${id}`).then((note) => {
            setTitle(note.title);
            setContent(note.content);
            setSummary(note.summary ?? null);
            setTags(note.tags ?? []);
            setIsOwner(note.ownerId === getCurrentUserId());
            setLoading(false);
        }).catch(() => navigate("/notes"));
    }, [id, navigate]);

    const handleShare = async () => {
        if (!shareEmail.trim()) {
            setShareError('Enter an email address');
            return;
        }

        try {
            setIsSharing(true);
            setShareError('');
            setShareSuccess('');

            await apiFetch(`/notes/${id}/collaborators`, {
            method: 'POST',
            body: JSON.stringify({ email: shareEmail.trim() }),
            });

            setShareSuccess('Collaborator added!');
            setShareEmail('');
            loadCollaborators();
        } catch (error) {
            if (error instanceof Error) {
            setShareError(error.message);
            } else {
            setShareError('Something went wrong');
            }
        } finally {
            setIsSharing(false);
        }
    };

    async function loadCollaborators() {
        try {
            const data = await apiFetch(`/notes/${id}/collaborators`);

            console.log("Collaborator response:", data);

            setOwner(data.owner);
            setCollaborators(data.collaborators);
        } catch (err) {
            console.error(err);
        }
    }

    async function handleGenerateSummary() {
        setIsGenerating(true);
        try {
            const updated = await apiFetch(`/notes/${id}/summarize`, { method: "POST" });
            setSummary(updated.summary);
            setTags(updated.tags ?? []);
        } catch (err) {
            setSummary(null);
        
        } finally {
            setIsGenerating(false);
        }
    }

    if (loading) {
        return <div className="note-editor-loading">Loading...</div>;
    }

    return (
        <div className="note-editor-page">
        <div className="note-editor-topbar">
            <button
                className="note-editor-back"
                onClick={() => navigate("/notes")}
            >
                ← Back to notes
            </button>

            {activeUsers.length > 0 && (
            <div className="presence-bar">
                <span className="presence-label">Editing now:</span>
                {activeUsers.map((u, i) => (
                <span key={`${u.userId}-${i}`} className="presence-pill">
                    {u.name}
                </span>
                ))}
            </div>
            )}

            <button
            className="note-editor-share"
            onClick={() => {
                setShowShareModal(true);
                loadCollaborators();
            }}
            >
            {isOwner ? "Share" : "Collaborators"}
            </button>
            </div>
        {showShareModal && (
            <div className="modal-overlay">
                <div className="share-modal">
                <h2>{isOwner ? "Share note" : "Collaborators"}</h2>
                
                <p>
                {isOwner ? "Add another Huddle user as a collaborator." : "Everyone with access to this note."}
                </p>

                <div className="collaborator-list">
                    {owner && (
                        <div className="collaborator-row">
                        <div className="collaborator-avatar">
                            {owner.avatarUrl ? (<img src={owner.avatarUrl} alt={owner.name} />) : (<span>{owner.name?.[0]?.toUpperCase()}</span>)}
                        </div>
                        <div className="collaborator-info">
                            <div className="collaborator-name">{owner.name}</div>
                            <div className="collaborator-email">{owner.email}</div>
                        </div>
                        <span className="collaborator-badge">Owner</span>
                        </div>
                    )}

                    {collaborators.map((c) => (
                        <div key={c.id} className="collaborator-row">
                        <div className="collaborator-avatar">
                            {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt={c.name} />
                            ) : (
                            <span>{c.name?.[0]?.toUpperCase()}</span>
                            )}
                        </div>
                        <div className="collaborator-info">
                            <div className="collaborator-name">{c.name}</div>
                            <div className="collaborator-email">{c.email}</div>
                        </div>
                        </div>
                    ))}
                </div>

                {isOwner && (
                <>
                    <input
                    type="email"
                    placeholder="friend@example.com"
                    value={shareEmail}
                    onChange={(e) => {
                        setShareEmail(e.target.value);
                        setShareError('');
                        setShareSuccess('');
                    }}
                    />

                    {shareError && <p className="share-error">{shareError}</p>}
                    {shareSuccess && <p className="share-success">{shareSuccess}</p>}
                </>
                )}

                <div className="share-modal-actions">
                    <button className="share-cancel-button" onClick={() => {
                        setShowShareModal(false);
                        setShareEmail('');
                        setShareError('');
                        setShareSuccess('');
                    }}
                    >
                    {isOwner ? "Cancel" : "Close"}
                    </button>
                    
                    {isOwner && (
                        <button className="share-submit-button" onClick={handleShare} disabled={isSharing}>
                            {isSharing ? 'Adding...' : 'Add collaborator'}
                        </button>
                    )}
                </div>
                </div>
            </div>
            )}

        <div className="note-editor-card">
            <input
            className="note-editor-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            />
            <textarea
            ref={contentTextareaRef}
            className="note-editor-content"
            value={content}
            onChange={(e) => {
                setContent(e.target.value);
                autoResize();
            }}
            placeholder="Start writing..."
            />
        </div>

        <div className="note-editor-ai-section">
        <button
            className="note-editor-generate-btn"
            onClick={handleGenerateSummary}
            disabled={isGenerating || content.trim().length === 0}
        >
            {isGenerating ? "Generating..." : "Generate summary & tags"}
        </button>

        {summary && (
            <div className="note-editor-summary">
            <p>{summary}</p>
            {tags.length > 0 && (
                <div className="note-editor-tags">
                {tags.map((tag) => (
                    <span key={tag} className="note-editor-tag">
                    {tag}
                    </span>
                ))}
                </div>
            )}
            </div>
        )}
        </div>

        <div className="note-editor-save-status">
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "saved" && "Saved"}
        </div>
        </div>
    );
}