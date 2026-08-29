# Huddle Notes

A real-time collaborative notes app with Google sign-in, live multi-user editing, and AI-generated summaries and tags.

## Features

- **Google OAuth sign-in** - no passwords, JWT-based sessions
- **Real-time collaborative editing** - edits sync across open tabs/sessions via WebSockets (last-write-wins)
- **Live presence** - see who else is currently viewing a note
- **Collaborator sharing** - note owners can add collaborators by email; access is enforced server-side
- **AI-generated summaries and tags** - one-click summarization via the Gemini API, fully editable afterward
- **Full CRUD** - create, edit, delete notes, all scoped to the logged-in user's access

## Tech stack

**Backend:** NestJS, PostgreSQL, Prisma, Socket.io, Passport.js (Google OAuth2 + JWT)
**Frontend:** React, TypeScript, Vite, Socket.io-client
**AI:** Google Gemini API 
**Infra:** Docker Compose (local Postgres)
