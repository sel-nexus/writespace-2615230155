/** Verify detail routing, original metadata, safe full text and edit permission branches. */
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import App from "../src/App.jsx";
import BlogDetail from "../src/pages/BlogDetail.jsx";
import { writePosts, writeSession } from "../src/lib/storage.js";
import { DEFAULT_ADMIN } from "../src/lib/permissions.js";

const owner = {
  userId: "u1",
  username: "writer",
  displayName: "Renamed Writer",
  role: "user",
};
const post = {
  id: "p1",
  title: "Original title",
  content:
    '  First line\n\n\t<script>alert("demo")</script> & <b>literal</b>\n' +
    "z".repeat(200) +
    "  ",
  createdAt: "2026-01-02T12:00:00",
  authorId: "u1",
  authorName: "Original Writer",
};

it.each([
  [owner, true],
  [DEFAULT_ADMIN, true],
  [{ ...owner, userId: "u2" }, false],
])(
  "shows Edit only for permitted identity %j and preserves full escaped content",
  (session, allowed) => {
    writePosts([post]);
    const stored = localStorage.getItem("writespace_posts");
    writeSession(session);
    window.history.replaceState({}, "", "/blog/p1");
    const { container } = render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      post.title
    );
    expect(screen.getByText("Original Writer")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Original Writer, user" })
    ).toBeInTheDocument();
    expect(screen.getByText("Jan 02, 2026")).toHaveAttribute(
      "dateTime",
      post.createdAt
    );
    expect(container.querySelector(".post-content").textContent).toBe(
      post.content
    );
    expect(container.querySelector("script, b")).toBeNull();
    expect(Boolean(screen.queryByRole("link", { name: "Edit Post" }))).toBe(
      allowed
    );
    if (allowed)
      expect(screen.getByRole("link", { name: "Edit Post" })).toHaveAttribute(
        "href",
        "/edit/p1"
      );
    expect(Boolean(screen.queryByRole("button", { name: "Delete Post" }))).toBe(
      allowed
    );
    expect(localStorage.getItem("writespace_posts")).toBe(stored);
  }
);

it("follows the owner Edit link without mutating the stored post", async () => {
  writePosts([post]);
  writeSession(owner);
  window.history.replaceState({}, "", "/blog/p1");
  render(<App />);
  await userEvent.click(screen.getByRole("link", { name: "Edit Post" }));
  expect(window.location.pathname).toBe("/edit/p1");
  expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([post]);
});

it.each(["/blog/p1", "/blog/missing"])(
  "redirects guests at %s to login without exposing details or controls",
  (path) => {
    writePosts([post]);
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(window.location.pathname).toBe("/login");
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.queryByText(post.title)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit Post" })
    ).not.toBeInTheDocument();
  }
);

it.each([null, "[]", "{bad", "{}", '[{"id":"p1"}]'])(
  "shows missing feedback for absent or malformed storage %s and returns to list",
  async (value) => {
    writeSession(DEFAULT_ADMIN);
    if (value !== null) localStorage.setItem("writespace_posts", value);
    window.history.replaceState({}, "", "/blog/p1");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Post not found" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit Post" })
    ).not.toBeInTheDocument();
    expect(localStorage.getItem("writespace_posts")).toBe(value);
    await userEvent.click(
      screen.getByRole("link", { name: "Back to All Blogs" })
    );
    expect(window.location.pathname).toBe("/blogs");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "All Blogs"
    );
  }
);

it("does not substitute another stored post for a missing ID", () => {
  writePosts([post]);
  writeSession(owner);
  window.history.replaceState({}, "", "/blog/missing");
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Post not found" })
  ).toBeInTheDocument();
  expect(screen.queryByText(post.title)).not.toBeInTheDocument();
});

it("shows missing feedback on a thrown post read", () => {
  writeSession(owner);
  const read = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (key) {
    if (key === "writespace_posts") throw new Error("unavailable");
    return read.call(this, key);
  });
  window.history.replaceState({}, "", "/blog/p1");
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Post not found" })
  ).toBeInTheDocument();
});

it("escapes title and author text and formats invalid dates safely", () => {
  writePosts([
    {
      ...post,
      title: "<img src=x>",
      authorName: "<b>Writer</b>",
      createdAt: "invalid",
    },
  ]);
  writeSession(owner);
  window.history.replaceState({}, "", "/blog/p1");
  const { container } = render(<App />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "<img src=x>"
  );
  expect(screen.getByText("<b>Writer</b>")).toBeInTheDocument();
  expect(screen.getByText("Unknown date")).toBeInTheDocument();
  expect(container.querySelector("img, b, script")).toBeNull();
});

it("resolves encoded IDs and updates detail when a link changes the routed ID", async () => {
  writePosts([post, { ...post, id: "next / id", title: "Second post" }]);
  render(
    <MemoryRouter initialEntries={["/blog/p1"]}>
      <Link to="/blog/next%20%2F%20id">Next post</Link>
      <Routes>
        <Route path="/blog/:id" element={<BlogDetail session={owner} />} />
      </Routes>
    </MemoryRouter>
  );
  await userEvent.click(screen.getByRole("link", { name: "Next post" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Second post"
  );
  expect(screen.getByRole("link", { name: "Edit Post" })).toHaveAttribute(
    "href",
    "/edit/next%20%2F%20id"
  );
});

it("hides Edit when the detail component receives no session", () => {
  writePosts([post]);
  render(
    <MemoryRouter initialEntries={["/blog/p1"]}>
      <Routes>
        <Route path="/blog/:id" element={<BlogDetail />} />
      </Routes>
    </MemoryRouter>
  );
  expect(
    screen.queryByRole("link", { name: "Edit Post" })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete Post" })
  ).not.toBeInTheDocument();
});

it.each([owner, DEFAULT_ADMIN])(
  "confirmed Delete removes only target for %j and navigates to blogs",
  async (session) => {
    const other = { ...post, id: "other", title: "Other post" };
    writePosts([post, other]);
    writeSession(session);
    window.history.replaceState({}, "", "/blog/p1");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    expect(confirm).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
      post,
      other,
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Delete Post" }));
    expect(confirm).toHaveBeenCalledWith("Delete this post?");
    expect(window.location.pathname).toBe("/blogs");
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
      other,
    ]);
  }
);

it("canceling Delete leaves stored and displayed detail unchanged", async () => {
  writePosts([post]);
  writeSession(owner);
  window.history.replaceState({}, "", "/blog/p1");
  vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<App />);
  const stored = localStorage.getItem("writespace_posts");
  await userEvent.click(screen.getByRole("button", { name: "Delete Post" }));
  expect(window.location.pathname).toBe("/blog/p1");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    post.title
  );
  expect(localStorage.getItem("writespace_posts")).toBe(stored);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("Delete write failure preserves visible detail and route then explicit retry succeeds", async () => {
  writePosts([post]);
  writeSession(owner);
  window.history.replaceState({}, "", "/blog/p1");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<App />);
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  await userEvent.click(screen.getByRole("button", { name: "Delete Post" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Changes could not be saved in this browser."
  );
  expect(window.location.pathname).toBe("/blog/p1");
  expect(document.querySelector(".post-content").textContent).toBe(
    post.content
  );
  expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([post]);
  spy.mockRestore();
  await userEvent.click(screen.getByRole("button", { name: "Delete Post" }));
  expect(window.location.pathname).toBe("/blogs");
  expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([]);
});

it("rejects a changed active identity before opening Delete confirmation", async () => {
  writePosts([post]);
  const active = { ...owner };
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  render(
    <MemoryRouter initialEntries={["/blog/p1"]}>
      <Routes>
        <Route path="/blog/:id" element={<BlogDetail session={active} />} />
      </Routes>
    </MemoryRouter>
  );
  active.userId = "different";
  await userEvent.click(screen.getByRole("button", { name: "Delete Post" }));
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "You cannot manage this post."
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    post.title
  );
  expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([post]);
});

it.each(["missing", "forbidden", "invalid-session"])(
  "rejects stale %s Delete after confirmation without hiding detail or navigating",
  async (condition) => {
    writePosts([post]);
    const active = { ...owner };
    vi.spyOn(window, "confirm").mockImplementation(() => {
      if (condition === "missing") writePosts([]);
      if (condition === "forbidden")
        writePosts([{ ...post, authorId: "different" }]);
      if (condition === "invalid-session") active.role = "invalid";
      return true;
    });
    render(
      <MemoryRouter initialEntries={["/blog/p1"]}>
        <Routes>
          <Route path="/blog/:id" element={<BlogDetail session={active} />} />
          <Route path="/blogs" element={<h1>Blogs destination</h1>} />
        </Routes>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete Post" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      condition === "missing" ? "no longer exists" : "cannot manage"
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      post.title
    );
    expect(
      screen.queryByRole("heading", { name: "Blogs destination" })
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual(
      condition === "missing"
        ? []
        : condition === "forbidden"
        ? [{ ...post, authorId: "different" }]
        : [post]
    );
  }
);
