/** Own the single router and persistence-aware browser session lifecycle. */
import { useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { readSession, clearSession } from "./lib/storage.js";
import { AppNavbar } from "./components/AppNavbar.jsx";
import { PublicNavbar } from "./components/PublicNavbar.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import NotFound from "./pages/NotFound.jsx";
import Blogs from "./pages/Blogs.jsx";
import BlogDetail from "./pages/BlogDetail.jsx";
import WritePost from "./pages/WritePost.jsx";
import EditPost from "./pages/EditPost.jsx";

/** Compose available routes and resolve guards before future route fallbacks.
 * Returns: {JSX.Element} Route shell restored from localStorage.
 */
function RouteShell() {
  const [session, setSession] = useState(readSession);
  const [logoutError, setLogoutError] = useState("");
  const navigate = useNavigate();

  /** Remove only durable session before clearing the rendered identity. */
  function logout() {
    const result = clearSession();
    if (!result.ok) {
      setLogoutError(result.error.message);
      return;
    }
    setLogoutError("");
    setSession(null);
    navigate("/");
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {session ? (
        <AppNavbar session={session} onLogout={logout} />
      ) : (
        <PublicNavbar />
      )}
      {logoutError && (
        <p role="alert" className="error-banner page-container mt-6">
          {logoutError}
        </p>
      )}
      <Routes>
        <Route path="/" element={<Landing session={session} />} />
        <Route
          path="/login"
          element={<Login session={session} onSession={setSession} />}
        />
        <Route
          path="/register"
          element={<Register session={session} onSession={setSession} />}
        />
        <Route
          path="/blogs"
          element={
            <ProtectedRoute session={session}>
              <Blogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/blog/:id"
          element={
            <ProtectedRoute session={session}>
              <BlogDetail session={session} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/write"
          element={
            <ProtectedRoute session={session}>
              <WritePost session={session} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit/:id"
          element={
            <ProtectedRoute session={session}>
              <EditPost session={session} />
            </ProtectedRoute>
          }
        />
        {["/admin", "/users"].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute session={session} requiredRole="admin">
                <NotFound />
              </ProtectedRoute>
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

/** Render exactly one browser router with the account-entry shell.
 * Returns: {JSX.Element} Application root.
 */
export default function App() {
  return (
    <BrowserRouter>
      <RouteShell />
    </BrowserRouter>
  );
}
