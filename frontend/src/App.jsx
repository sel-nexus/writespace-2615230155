/** Own the single router and persistence-aware browser session lifecycle. */
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, matchPath } from "react-router-dom";
import { readSession, clearSession, readPosts } from "./lib/storage.js";
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
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Users from "./pages/Users.jsx";

/** Compose real feature routes and resolve guest and role guards.
 * Returns: {JSX.Element} Route shell restored from localStorage.
 */
function RouteShell() {
  const [session, setSession] = useState(readSession);
  const [logoutError, setLogoutError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Keep browser history and post/edit resource titles in sync with the route.
  useEffect(() => {
    const titles = {
      "/": "",
      "/login": "Login",
      "/register": "Register",
      "/blogs": "All Blogs",
      "/write": "Write",
      "/admin": "Admin",
      "/users": "Users",
    };
    const route = Object.keys(titles).find((path) => matchPath(path, location.pathname));
    let title = route === undefined ? "Page not found" : titles[route];
    const resource = matchPath("/blog/:id", location.pathname) ||
      matchPath("/edit/:id", location.pathname);
    if (resource) {
      let id = resource.params.id;
      try {
        id = decodeURIComponent(id);
      } catch {
        // Malformed encoding cannot identify a stored post.
        id = null;
      }
      const post = readPosts().find((candidate) => candidate.id === id);
      title = post
        ? `${resource.pattern.path === "/edit/:id" ? "Edit: " : ""}${post.title}`
        : "Post not found";
    }
    document.title = title ? `${title} | WriteSpace` : "WriteSpace";
  }, [location]);

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
        <Route
          path="/admin"
          element={
            <ProtectedRoute session={session} requiredRole="admin">
              <AdminDashboard session={session} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute session={session} requiredRole="admin">
              <Users session={session} />
            </ProtectedRoute>
          }
        />
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
