import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import NotesList from "./pages/NotesList";
import NoteEditor from "./pages/NotesEditor";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/notes" element={<NotesList />} />
        <Route path="/notes/:id" element={<NoteEditor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;