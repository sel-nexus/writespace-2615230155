/** Verify Admin activity and explicitly activated post actions using local storage. */
import { it, expect, vi } from "vitest";
import {
  createEvent,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AdminDashboard from "../src/pages/AdminDashboard.jsx";
import { DEFAULT_ADMIN } from "../src/lib/permissions.js";
import { readPosts, writePosts, writeUsers } from "../src/lib/storage.js";

const post = {
  id: "p1",
  title: "Other author post",
  content: "Synthetic",
  authorId: "other",
  authorName: "Other Writer",
  createdAt: "2026-01-01",
};
const user = {
  id: "u1",
  username: "writer",
  displayName: "Writer",
  password: "never-display-this",
  role: "user",
  createdAt: "2026-01-01",
};

/** Mount real dashboard and observable navigation destinations. */
function mount(session = DEFAULT_ADMIN) {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard session={session} />} />
        <Route path="/edit/:id" element={<h1>Edit destination</h1>} />
        <Route path="/users" element={<h1>Users destination</h1>} />
        <Route path="/blogs" element={<h1>Blogs destination</h1>} />
        <Route path="/write" element={<h1>Write destination</h1>} />
        <Route path="/blog/:id" element={<h1>Detail destination</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

it("renders four counts, fixed Admin once, and only five newest entries without activation", () => {
  const posts = Array.from({ length: 7 }, (_, index) => ({
    ...post,
    id: `p${index}`,
    title: `Post ${index}`,
    createdAt: `2026-01-0${index + 1}`,
  }));
  writePosts(posts);
  writeUsers([
    user,
    { ...user, id: "manager", username: "manager", role: "admin" },
    { ...user, id: "admin", username: "ADMIN", role: "admin" },
  ]);
  const confirm = vi.spyOn(window, "confirm");
  mount();
  const counts = screen.getByRole("region", { name: "Workspace counts" });
  for (const [label, count] of [
    ["Total Posts", 7],
    ["Total Users", 3],
    ["Total Admins", 2],
    ["Total user accounts", 1],
  ]) {
    expect(within(counts).getByText(label).parentElement).toHaveTextContent(
      String(count)
    );
  }
  expect(
    screen
      .getAllByRole("heading", { level: 3 })
      .map((element) => element.textContent)
  ).toEqual(["Post 6", "Post 5", "Post 4", "Post 3", "Post 2"]);
  expect(screen.getAllByRole("link", { name: /^Edit Post/ })).toHaveLength(5);
  expect(screen.getAllByRole("button", { name: /^Delete Post/ })).toHaveLength(
    5
  );
  expect(
    screen.getAllByRole("img", { name: "Other Writer, user" })
  ).toHaveLength(5);
  expect(confirm).not.toHaveBeenCalled();
  expect(readPosts()).toEqual(posts);
  expect(screen.queryByText(user.password)).not.toBeInTheDocument();
});

it("renders meaningful empty local state and default-only counts", () => {
  mount();
  expect(
    screen.getByRole("heading", { name: "No posts yet" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Write your first post" })
  ).toHaveAttribute("href", "/write");
  expect(
    screen.queryByRole("button", { name: /^Delete/ })
  ).not.toBeInTheDocument();
  expect(screen.getByText("Total Admins").parentElement).toHaveTextContent("1");
  expect(
    screen.getByText("Total user accounts").parentElement
  ).toHaveTextContent("0");
});

it.each([null, { ...DEFAULT_ADMIN, role: "user" }])(
  "does not expose Admin post actions to %j",
  (session) => {
    writePosts([post]);
    mount(session);
    expect(
      screen.queryByRole("link", { name: /^Edit/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Delete/ })
    ).not.toBeInTheDocument();
    expect(readPosts()).toEqual([post]);
  }
);

it.each([
  ["Manage Users", "Users destination"],
  ["Write a Post", "Write destination"],
  ["View All Blogs", "Blogs destination"],
])("quick action %s navigates through a real link", async (name, heading) => {
  mount();
  await userEvent.click(screen.getByRole("link", { name }));
  expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
});
it("opens another author’s detail and edit through dashboard links", async () => {
  writePosts([post]);
  const view = mount();
  await userEvent.click(screen.getByRole("link", { name: post.title }));
  expect(
    screen.getByRole("heading", { name: "Detail destination" })
  ).toBeInTheDocument();
  view.unmount();
  mount();
  await userEvent.click(
    screen.getByRole("link", { name: `Edit ${post.title}` })
  );
  expect(
    screen.getByRole("heading", { name: "Edit destination" })
  ).toBeInTheDocument();
  expect(readPosts()).toEqual([post]);
});
it.each(
  ["permitted", "missing", "stale"].flatMap((state) =>
    [
      ["metaKey", { button: 0, metaKey: true }],
      ["ctrlKey", { button: 0, ctrlKey: true }],
      ["shiftKey", { button: 0, shiftKey: true }],
      ["altKey", { button: 0, altKey: true }],
      ["middle button", { button: 1 }],
      ["right button", { button: 2 }],
    ].map(([activation, options]) => [activation, state, options])
  )
)("preserves native %s edit activation for a %s target", (activation, state, options) => {
  const session = { ...DEFAULT_ADMIN };
  writePosts([post]);
  mount(session);
  const link = screen.getByRole("link", { name: `Edit ${post.title}` });
  if (state === "missing") writePosts([]);
  if (state === "stale") session.role = "user";
  const event = createEvent.click(link, options);

  fireEvent(link, event);

  expect(event.defaultPrevented).toBe(false);
  expect(link).toHaveAttribute("href", "/edit/p1");
  expect(screen.getByRole("heading", { name: "Admin Dashboard" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Edit destination" })).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(readPosts()).toEqual(state === "missing" ? [] : [post]);
});
it.each(["permitted", "missing", "stale"])(
  "checks latest access and cancels ordinary edit activation for a %s target",
  (state) => {
    const session = { ...DEFAULT_ADMIN };
    writePosts([post]);
    mount(session);
    const link = screen.getByRole("link", { name: `Edit ${post.title}` });
    if (state === "missing") writePosts([]);
    if (state === "stale") session.role = "user";
    const event = createEvent.click(link, { button: 0 });

    fireEvent(link, event);

    expect(event.defaultPrevented).toBe(true);
    if (state === "permitted") {
      expect(screen.getByRole("heading", { name: "Edit destination" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole("heading", { name: "Admin Dashboard" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Edit destination" })).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        state === "missing" ? "no longer exists" : "Only Admin"
      );
    }
    expect(readPosts()).toEqual(state === "missing" ? [] : [post]);
  }
);
it("cancel leaves storage unchanged, confirm deletes fresh record and refreshes counts/recent view", async () => {
  writePosts([post]);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const view = mount();
  await userEvent.click(
    screen.getByRole("button", { name: `Delete ${post.title}` })
  );
  expect(readPosts()).toEqual([post]);
  expect(screen.getByRole("link", { name: post.title })).toBeInTheDocument();
  const fresh = { ...post, id: "fresh", title: "Fresh record" };
  writePosts([post, fresh]);
  confirm.mockReturnValue(true);
  await userEvent.click(
    screen.getByRole("button", { name: `Delete ${post.title}` })
  );
  expect(readPosts()).toEqual([fresh]);
  expect(
    screen.queryByRole("link", { name: post.title })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Fresh record" })
  ).toBeInTheDocument();
  expect(screen.getByText("Total Posts").parentElement).toHaveTextContent("1");
  view.unmount();
  mount();
  expect(
    screen.getByRole("link", { name: "Fresh record" })
  ).toBeInTheDocument();
});
it("deleting final record renders empty state and zero post count", async () => {
  writePosts([post]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mount();
  await userEvent.click(
    screen.getByRole("button", { name: `Delete ${post.title}` })
  );
  expect(readPosts()).toEqual([]);
  expect(
    screen.getByRole("heading", { name: "No posts yet" })
  ).toBeInTheDocument();
  expect(screen.getByText("Total Posts").parentElement).toHaveTextContent("0");
});
it("retains displayed post/count on write error and allows explicit retry", async () => {
  writePosts([post]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mount();
  const failure = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("private");
    });
  await userEvent.click(
    screen.getByRole("button", { name: `Delete ${post.title}` })
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Changes could not be saved"
  );
  expect(screen.getByRole("link", { name: post.title })).toBeInTheDocument();
  expect(readPosts()).toEqual([post]);
  failure.mockRestore();
  await userEvent.click(
    screen.getByRole("button", { name: `Delete ${post.title}` })
  );
  expect(readPosts()).toEqual([]);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it.each(["Edit", "Delete"])(
  "reports target removed since render before %s without confirmation",
  async (action) => {
    writePosts([post]);
    const confirm = vi.spyOn(window, "confirm");
    mount();
    writePosts([]);
    await userEvent.click(
      screen.getByRole(action === "Edit" ? "link" : "button", {
        name: `${action} ${post.title}`,
      })
    );
    expect(screen.getByRole("alert")).toHaveTextContent("no longer exists");
    expect(
      screen.queryByRole("heading", { name: "Edit destination" })
    ).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(readPosts()).toEqual([]);
  }
);
it.each(["Edit", "Delete"])(
  "repeats role check for stale %s control even for owning member",
  async (action) => {
    const session = { ...DEFAULT_ADMIN };
    writePosts([{ ...post, authorId: session.userId }]);
    const confirm = vi.spyOn(window, "confirm");
    mount(session);
    session.role = "user";
    await userEvent.click(
      screen.getByRole(action === "Edit" ? "link" : "button", {
        name: `${action} ${post.title}`,
      })
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Only Admin");
    expect(confirm).not.toHaveBeenCalled();
    expect(readPosts()).toHaveLength(1);
  }
);
it("repeats permission after confirmation and does not delete when role changes", async () => {
  const session = { ...DEFAULT_ADMIN };
  writePosts([post]);
  mount(session);
  vi.spyOn(window, "confirm").mockImplementation(() => {
    session.role = "user";
    return true;
  });
  await userEvent.click(
    screen.getByRole("button", { name: `Delete ${post.title}` })
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Only Admin");
  expect(readPosts()).toEqual([post]);
});
it("reports target removed during confirmation without false refresh", async () => {
  writePosts([post]);
  mount();
  vi.spyOn(window, "confirm").mockImplementation(() => {
    writePosts([]);
    return true;
  });
  await userEvent.click(
    screen.getByRole("button", { name: `Delete ${post.title}` })
  );
  expect(screen.getByRole("alert")).toHaveTextContent("no longer exists");
  expect(screen.getByRole("link", { name: post.title })).toBeInTheDocument();
  expect(readPosts()).toEqual([]);
});
it.each(["{broken", "{}", "null", "[null,{}]"])(
  "renders empty states for malformed collections %s without repairing reads",
  (raw) => {
    localStorage.setItem("writespace_posts", raw);
    localStorage.setItem("writespace_users", raw);
    mount();
    expect(
      screen.getByRole("heading", { name: "No posts yet" })
    ).toBeInTheDocument();
    expect(screen.getByText("Total Users").parentElement).toHaveTextContent(
      "1"
    );
    expect(localStorage.getItem("writespace_posts")).toBe(raw);
  }
);
it("renders safe empty dashboard when storage reads are unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("private");
  });
  mount();
  expect(
    screen.getByRole("heading", { name: "No posts yet" })
  ).toBeInTheDocument();
});
it("escapes author and title instead of rendering markup", () => {
  writePosts([
    { ...post, title: "<script>literal</script>", authorName: "<b>Writer</b>" },
  ]);
  const view = mount();
  expect(
    screen.getByRole("link", { name: "<script>literal</script>" })
  ).toBeInTheDocument();
  expect(view.container.querySelector("script, b")).toBeNull();
});
