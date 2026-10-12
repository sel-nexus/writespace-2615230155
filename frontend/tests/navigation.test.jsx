/** Verify guards, shared primitives and the real App session lifecycle. */
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import App from "../src/App.jsx";
import ProtectedRoute from "../src/routes/ProtectedRoute.jsx";
import { PublicNavbar } from "../src/components/PublicNavbar.jsx";
import { AppNavbar } from "../src/components/AppNavbar.jsx";
import { Avatar } from "../src/components/Avatar.jsx";
import { EmptyState } from "../src/components/EmptyState.jsx";
import { FormField } from "../src/components/FormField.jsx";
import { DEFAULT_ADMIN } from "../src/lib/permissions.js";
import {
  writeSession,
  readSession,
  writeUsers,
  readUsers,
  writePosts,
} from "../src/lib/storage.js";
const member = {
  userId: "u1",
  username: "writer",
  displayName: "Writer",
  role: "user",
};

it.each([
  [null, undefined, "Login"],
  [member, "admin", "Blogs"],
  [DEFAULT_ADMIN, "admin", "Allowed"],
  [member, undefined, "Allowed"],
])("resolves guest then role guard %j %s", (session, requiredRole, heading) => {
  render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute session={session} requiredRole={requiredRole}>
              <h1>Allowed</h1>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<h1>Login</h1>} />
        <Route path="/blogs" element={<h1>Blogs</h1>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
});
it("toggles public mobile menu and closes it on link activation", async () => {
  render(
    <MemoryRouter>
      <PublicNavbar />
    </MemoryRouter>
  );
  const toggle = screen.getByRole("button", { name: "Open menu" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  await userEvent.click(screen.getByRole("link", { name: "Login" }));
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});
it.each(["WriteSpace", "Get Started"])(
  "closes the guest public menu after activating %s",
  async (name) => {
    render(
      <MemoryRouter>
        <PublicNavbar />
      </MemoryRouter>
    );
    const toggle = screen.getByRole("button", { name: "Open menu" });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole("link", { name, exact: true }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  }
);
it.each([
  ["admin", "Admin Dashboard"],
  ["user", "All Blogs"],
])(
  "closes the signed-in %s public menu after role-home activation",
  async (role, name) => {
    render(
      <MemoryRouter>
        <PublicNavbar session={{ ...member, role }} />
      </MemoryRouter>
    );
    const toggle = screen.getByRole("button", { name: "Open menu" });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole("link", { name, exact: true }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  }
);
it.each([
  ["admin", "Admin Dashboard", "/admin"],
  ["user", "All Blogs", "/blogs"],
])("shows signed-in public %s identity and home", (role, name, home) => {
  render(
    <MemoryRouter>
      <PublicNavbar session={{ ...member, role }} />
    </MemoryRouter>
  );
  expect(screen.getByText("Writer")).toBeInTheDocument();
  expect(screen.getByRole("link", { name })).toHaveAttribute("href", home);
  expect(screen.queryByRole("link", { name: "Login" })).not.toBeInTheDocument();
});
it.each(["admin", "user"])(
  "shows role-specific %s links and activated logout only",
  async (role) => {
    const logout = vi.fn();
    render(
      <MemoryRouter initialEntries={["/blogs"]}>
        <AppNavbar session={{ ...member, role }} onLogout={logout} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "All Blogs" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Write" })).toHaveAttribute(
      "href",
      "/write"
    );
    expect(Boolean(screen.queryByRole("link", { name: "Users" }))).toBe(
      role === "admin"
    );
    expect(
      screen.queryByRole("button", { name: "Logout" })
    ).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Writer/ }));
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(logout).toHaveBeenCalledOnce();
  }
);
it("dismisses both authenticated menus with Escape and closes on route navigation", async () => {
  render(
    <MemoryRouter>
      <AppNavbar session={member} onLogout={vi.fn()} />
    </MemoryRouter>
  );
  await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
  await userEvent.click(screen.getByRole("button", { name: /Writer/ }));
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  expect(
    screen.queryByRole("button", { name: "Logout" })
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
  await userEvent.click(screen.getByRole("button", { name: /Writer/ }));
  await userEvent.click(screen.getByRole("link", { name: "Write" }));
  expect(
    screen.queryByRole("button", { name: "Logout" })
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
});
it("renders accessible crown and default book avatars", () => {
  render(
    <>
      <Avatar role="admin" name="Admin" />
      <Avatar />
    </>
  );
  expect(screen.getByRole("img", { name: "Admin, Admin" })).toHaveTextContent(
    "👑"
  );
  expect(screen.getByRole("img", { name: "Writer, user" })).toHaveTextContent(
    "📚"
  );
});
it("renders empty feedback with and without optional action", () => {
  const { rerender } = render(
    <MemoryRouter>
      <EmptyState
        title="Empty"
        description="Nothing here"
        to="/"
        action="Home"
      />
    </MemoryRouter>
  );
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
    "href",
    "/"
  );
  rerender(
    <MemoryRouter>
      <EmptyState title="Missing" />
    </MemoryRouter>
  );
  expect(screen.getByRole("heading", { name: "Missing" })).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("binds optional field, input value and error description", async () => {
  const change = vi.fn();
  const { rerender } = render(
    <FormField
      id="name"
      label="Name"
      value=""
      onChange={change}
      required={false}
    />
  );
  expect(screen.getByLabelText("Name")).toHaveAttribute(
    "aria-invalid",
    "false"
  );
  expect(screen.getByLabelText("Name")).not.toBeRequired();
  await userEvent.type(screen.getByLabelText("Name"), "a");
  expect(change).toHaveBeenCalled();
  rerender(
    <FormField
      id="name"
      label="Name"
      value="a"
      onChange={change}
      error="Required"
    />
  );
  expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Required");
  expect(screen.getByRole("alert")).toHaveTextContent("Required");
});
it.each([
  ["/", "WriteSpace"],
  ["/login", "Login | WriteSpace"],
  ["/register", "Register | WriteSpace"],
  ["/blogs", "All Blogs | WriteSpace"],
  ["/write", "Write | WriteSpace"],
  ["/admin", "Admin | WriteSpace"],
  ["/users", "Users | WriteSpace"],
  ["/unknown", "Page not found | WriteSpace"],
  ["/blog/missing", "Post not found | WriteSpace"],
  ["/edit/missing", "Post not found | WriteSpace"],
])("sets the document title for %s", (path, title) => {
  if (!["/", "/login", "/register", "/unknown"].includes(path)) {
    writeSession(DEFAULT_ADMIN);
  }
  window.history.replaceState({}, "", path);
  render(<App />);
  expect(document.title).toBe(title);
});
it.each(["/blog/%", "/edit/%"])(
  "handles malformed percent encoding at %s without an uncaught exception",
  (path) => {
    writeSession(DEFAULT_ADMIN);
    window.history.replaceState({}, "", path);
    document.title = "Previous page | WriteSpace";
    expect(() => render(<App />)).not.toThrow();
    expect(document.title).toBe("Post not found | WriteSpace");
    expect(
      screen.getByRole("heading", { name: "Post not found" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe(path);
  }
);
it("updates resource titles across detail, edit, save and list navigation", async () => {
  writeSession(DEFAULT_ADMIN);
  writePosts([{
    id: "post with spaces",
    title: "Original writing",
    content: "Synthetic local text",
    authorId: DEFAULT_ADMIN.userId,
    authorName: DEFAULT_ADMIN.displayName,
    createdAt: "2026-01-01T00:00:00.000Z",
  }]);
  window.history.replaceState({}, "", "/blog/post%20with%20spaces");
  render(<App />);
  expect(document.title).toBe("Original writing | WriteSpace");
  await userEvent.click(screen.getByRole("link", { name: "Edit Post" }));
  expect(document.title).toBe("Edit: Original writing | WriteSpace");
  await userEvent.clear(screen.getByLabelText("Title"));
  await userEvent.type(screen.getByLabelText("Title"), "Revised writing");
  await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(document.title).toBe("Revised writing | WriteSpace");
  await userEvent.click(screen.getByRole("link", { name: "Back to All Blogs" }));
  expect(document.title).toBe("All Blogs | WriteSpace");
});
it("updates guest route titles without remounting the App", async () => {
  window.history.replaceState({}, "", "/login");
  render(<App />);
  expect(document.title).toBe("Login | WriteSpace");
  await userEvent.click(screen.getByRole("link", { name: "Get Started Free", exact: true }));
  expect(document.title).toBe("Register | WriteSpace");
  await userEvent.click(screen.getByRole("link", { name: "WriteSpace", exact: true }));
  expect(document.title).toBe("WriteSpace");
});
it.each(["/blogs", "/blog/p1", "/write", "/edit/p1", "/admin", "/users"])(
  "redirects guest protected route %s to login",
  (path) => {
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    expect(document.title).toBe("Login | WriteSpace");
  }
);
it.each([
  ["/write", "Write a Post"],
  ["/edit/p1", "Post not found"],
])("renders real guarded writing route %s", (path, heading) => {
  writeSession(DEFAULT_ADMIN);
  window.history.replaceState({}, "", path);
  render(<App />);
  expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  expect(window.location.pathname).toBe(path);
});
it.each([
  ["/admin", "Admin Dashboard"],
  ["/users", "Users"],
])("renders real guarded administration route %s", (path, heading) => {
  writeSession(DEFAULT_ADMIN);
  window.history.replaceState({}, "", path);
  render(<App />);
  expect(
    screen.getByRole("heading", { name: heading, level: 1 })
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe(path);
});
it.each(["/admin", "/users"])(
  "redirects member Admin route %s before administration renders",
  (path) => {
    writeSession(member);
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(window.location.pathname).toBe("/blogs");
    expect(
      screen.getByRole("heading", { level: 1, name: "All Blogs" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No posts yet" })
    ).toBeInTheDocument();
  }
);
it("restores session on remount and logout preserves accounts", async () => {
  writeSession(member);
  writeUsers([
    {
      id: "u1",
      displayName: "Writer",
      username: "writer",
      password: "demo",
      role: "user",
      createdAt: "2026-01-01",
    },
  ]);
  const first = render(<App />);
  first.unmount();
  render(<App />);
  expect(screen.getByText("Writer")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Writer/ }));
  await userEvent.click(screen.getByRole("button", { name: "Logout" }));
  expect(readSession()).toBeNull();
  expect(readUsers()).toHaveLength(1);
  expect(
    screen.getByRole("link", { name: "Get Started Free" })
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe("/");
});
it("preserves App identity on logout failure then allows explicit retry", async () => {
  writeSession(member);
  render(<App />);
  const spy = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new Error("private");
    });
  await userEvent.click(screen.getByRole("button", { name: /Writer/ }));
  await userEvent.click(screen.getByRole("button", { name: "Logout" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Logout could not be saved"
  );
  expect(readSession()).toEqual(member);
  spy.mockRestore();
  await userEvent.click(screen.getByRole("button", { name: /Writer/ }));
  await userEvent.click(screen.getByRole("button", { name: "Logout" }));
  expect(readSession()).toBeNull();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("shows unknown route fallback and follows home link", async () => {
  window.history.replaceState({}, "", "/unknown");
  render(<App />);
  expect(document.title).toBe("Page not found | WriteSpace");
  await userEvent.click(screen.getByRole("link", { name: "Back to Home" }));
  expect(document.title).toBe("WriteSpace");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Your thoughts."
  );
});
it("treats malformed stored session as guest at mount", () => {
  localStorage.setItem("writespace_session", "{}");
  window.history.replaceState({}, "", "/write");
  render(<App />);
  expect(window.location.pathname).toBe("/login");
});
