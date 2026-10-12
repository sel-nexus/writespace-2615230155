/** Exercise real guarded writing pages and persistence-first navigation. */
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import App from "../src/App.jsx";
import WritePost from "../src/pages/WritePost.jsx";
import EditPost from "../src/pages/EditPost.jsx";
import { readPosts, writePosts, writeSession } from "../src/lib/storage.js";
import { DEFAULT_ADMIN } from "../src/lib/permissions.js";

const owner = {
  userId: "u1",
  username: "writer",
  displayName: "Current Writer",
  role: "user",
};
const post = {
  id: "p1",
  title: "Original",
  content: "  Original\ntext ",
  createdAt: "2026-01-01",
  authorId: "u1",
  authorName: "Original Writer",
};

/** Mount the real application at the specified browser route. */
function open(path, session = owner, posts = [post]) {
  writePosts(posts);
  if (session) writeSession(session);
  window.history.replaceState({}, "", path);
  return render(<App />);
}

it.each(["/write", "/edit/p1", "/edit/missing"])(
  "redirects guest %s to login without mutation",
  (path) => {
    open(path, null);
    expect(window.location.pathname).toBe("/login");
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(readPosts()).toEqual([post]);
  }
);

it.each([owner, DEFAULT_ADMIN])(
  "creates through guarded form for %j then reads saved detail",
  async (session) => {
    open("/write", session);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("new / id");
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  New title  " },
    });
    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "\n<b>literal</b>  " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    expect(window.location.pathname).toBe("/blog/new%20%2F%20id");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "New title"
    );
    expect(document.querySelector(".post-content").textContent).toBe(
      "\n<b>literal</b>  "
    );
    expect(readPosts()[1]).toMatchObject({
      id: "new / id",
      title: "  New title  ",
      content: "\n<b>literal</b>  ",
      authorId: session.userId,
      authorName: session.displayName,
    });
    expect(readPosts()[0]).toEqual(post);
  }
);

it("invalid create stays on form and cancel discards draft without a write", async () => {
  open("/write");
  const stored = localStorage.getItem("writespace_posts");
  await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
  expect(screen.getByText("Title is required.")).toBeInTheDocument();
  expect(screen.getByText("Content is required.")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/write");
  await userEvent.type(screen.getByLabelText("Title"), "discard");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(window.location.pathname).toBe("/blogs");
  expect(localStorage.getItem("writespace_posts")).toBe(stored);
  expect(readPosts()).toEqual([post]);
});

it.each(["storage", "uuid", "time"])(
  "keeps create draft and route on %s failure then succeeds on retry",
  async (source) => {
    open("/write");
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Draft" },
    });
    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "Text" },
    });
    const spy =
      source === "storage"
        ? vi.spyOn(Storage.prototype, "setItem")
        : source === "uuid"
        ? vi.spyOn(crypto, "randomUUID")
        : vi.spyOn(Date.prototype, "toISOString");
    spy.mockImplementation(() => {
      throw new Error("private");
    });
    await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      source === "storage"
        ? "Post could not be saved"
        : "Post could not be created"
    );
    expect(window.location.pathname).toBe("/write");
    expect(screen.getByLabelText("Title")).toHaveValue("Draft");
    expect(screen.getByLabelText("Content")).toHaveValue("Text");
    expect(readPosts()).toEqual([post]);
    spy.mockRestore();
    await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    expect(window.location.pathname).toMatch(/^\/blog\//);
    expect(readPosts()).toHaveLength(2);
  }
);

it.each([owner, DEFAULT_ADMIN])(
  "prefills and updates as %j while preserving original metadata",
  async (session) => {
    open("/edit/p1", session);
    expect(screen.getByLabelText("Title")).toHaveValue(post.title);
    expect(screen.getByLabelText("Content")).toHaveValue(post.content);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Revised" },
    });
    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "  New\ntext " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(window.location.pathname).toBe("/blog/p1");
    expect(readPosts()).toEqual([
      { ...post, title: "Revised", content: "  New\ntext " },
    ]);
    expect(screen.getByText("Original Writer")).toBeInTheDocument();
  }
);

it("redirects nonowner edit to blogs before rendering an editor", () => {
  open("/edit/p1", { ...owner, userId: "different" });
  expect(window.location.pathname).toBe("/blogs");
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  expect(readPosts()).toEqual([post]);
});

it.each([null, "[]", "{}", "{bad", '[{"id":"p1"}]'])(
  "shows missing edit with back link for storage %s",
  async (raw) => {
    writeSession(owner);
    if (raw !== null) localStorage.setItem("writespace_posts", raw);
    window.history.replaceState({}, "", "/edit/p1");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Post not found" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(localStorage.getItem("writespace_posts")).toBe(raw);
    await userEvent.click(
      screen.getByRole("link", { name: "Back to All Blogs" })
    );
    expect(window.location.pathname).toBe("/blogs");
  }
);

it("shows missing edit on inaccessible post read without changing persisted records", () => {
  writePosts([post]);
  writeSession(owner);
  const original = Storage.prototype.getItem;
  const spy = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(function (key) {
      if (key === "writespace_posts") throw new Error("private");
      return original.call(this, key);
    });
  window.history.replaceState({}, "", "/edit/p1");
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Post not found" })
  ).toBeInTheDocument();
  spy.mockRestore();
  expect(readPosts()).toEqual([post]);
});

it("invalid edit does not write and cancel returns to original detail", async () => {
  open("/edit/p1");
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: "\n\t" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Content is required.");
  expect(window.location.pathname).toBe("/edit/p1");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(window.location.pathname).toBe("/blog/p1");
  expect(readPosts()).toEqual([post]);
});

it.each(["missing", "forbidden", "storage"])(
  "keeps edit draft and visible failure when latest target is %s",
  async (condition) => {
    open("/edit/p1");
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Draft revision" },
    });
    const latest =
      condition === "missing"
        ? []
        : condition === "forbidden"
        ? [{ ...post, authorId: "different" }]
        : [post];
    writePosts(latest);
    if (condition === "storage")
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      condition === "missing"
        ? "no longer exists"
        : condition === "forbidden"
        ? "cannot manage"
        : "could not be saved"
    );
    expect(window.location.pathname).toBe("/edit/p1");
    expect(screen.getByLabelText("Title")).toHaveValue("Draft revision");
    expect(screen.getByLabelText("Content")).toHaveValue(post.content);
    expect(readPosts()).toEqual(latest);
  }
);

it("updates against fresh metadata and retains posts added since editor entry", async () => {
  open("/edit/p1");
  const latest = {
    ...post,
    authorName: "Latest author",
    createdAt: "2025-01-01",
  };
  const added = { ...post, id: "added" };
  writePosts([latest, added]);
  await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(readPosts()).toEqual([latest, added]);
  expect(window.location.pathname).toBe("/blog/p1");
});

it.each(["write", "edit"])(
  "rechecks session changed after %s form entry",
  async (kind) => {
    writePosts([post]);
    const component = (session) =>
      kind === "write" ? (
        <WritePost session={session} />
      ) : (
        <EditPost session={session} />
      );
    const view = (session) => (
      <MemoryRouter initialEntries={[kind === "write" ? "/write" : "/edit/p1"]}>
        <Routes>
          <Route path="/write" element={component(session)} />
          <Route path="/edit/:id" element={component(session)} />
          <Route path="/login" element={<h1>Login destination</h1>} />
          <Route path="/blogs" element={<h1>Blogs destination</h1>} />
        </Routes>
      </MemoryRouter>
    );
    const { rerender } = render(view(owner));
    rerender(view(null));
    expect(
      screen.getByRole("heading", { name: "Login destination" })
    ).toBeInTheDocument();
    expect(readPosts()).toEqual([post]);
  }
);

it("resets prefill when navigation changes the edit ID", async () => {
  writePosts([
    post,
    { ...post, id: "next / id", title: "Next", content: "Next content" },
  ]);
  render(
    <MemoryRouter initialEntries={["/edit/p1"]}>
      <Link to="/edit/next%20%2F%20id">Next editor</Link>
      <Routes>
        <Route path="/edit/:id" element={<EditPost session={owner} />} />
      </Routes>
    </MemoryRouter>
  );
  await userEvent.type(screen.getByLabelText("Title"), "discard");
  await userEvent.click(screen.getByRole("link", { name: "Next editor" }));
  expect(screen.getByLabelText("Title")).toHaveValue("Next");
  expect(screen.getByLabelText("Content")).toHaveValue("Next content");
  expect(readPosts()[0]).toEqual(post);
});
