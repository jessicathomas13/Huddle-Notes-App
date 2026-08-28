// Decodes the JWT payload without verifying it (verification already happened server-side)
// This is purely so the UI knows "who am I" (e.g. am I the owner of this note).
export function getCurrentUserId(): string | null {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.sub; // matches { sub: user.id } from AuthService.jwtService.sign(...)
  } catch {
    return null;
  }
}