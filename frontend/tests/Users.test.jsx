/** Exercise account management through visible controls and real browser-local records. */
import { it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Users from "../src/pages/Users.jsx";
import { DEFAULT_ADMIN } from "../src/lib/permissions.js";
import {
  readUsers,
  writeUsers,
  writeSession,
  readSession,
} from "../src/lib/storage.js";

const user = {
  id: "u1",
  displayName: "Writer",
  username: "writer",
  password: "never-display-this",
  role: "user",
  createdAt: "2026-01-01",
};
const manager = {
  ...user,
  id: "manager",
  username: "manager",
  displayName: "Manager",
  role: "admin",
};
const session = {
  ...DEFAULT_ADMIN,
  userId: manager.id,
  username: manager.username,
  displayName: manager.displayName,
};

/** Mount the page without replacing its local-storage service implementation. */
function mount(identity = DEFAULT_ADMIN) {
  return render(
    <MemoryRouter>
      <Users session={identity} />
    </MemoryRouter>
  );
}
/** Fill all required fields with synthetic demo values. */
async function fill(role = "user", username = "new-writer") {
  await userEvent.type(screen.getByLabelText("Display Name"), " New Writer ");
  await userEvent.type(
    screen.getByLabelText("Username", { exact: true }),
    username
  );
  await userEvent.type(screen.getByLabelText("Password"), " demo ");
  await userEvent.selectOptions(
    screen.getByLabelText("Role", { exact: true }),
    role
  );
}
/** Select the desktop counterpart because jsdom does not apply responsive CSS. */
function deleteButton(username = "writer") {
  return within(screen.getByRole("table")).getByRole("button", {
    name: `Delete ${username}`,
  });
}

it("renders full desktop table/mobile card fields and role avatars, not credentials or self delete", () => {
  writeUsers([user, manager]);
  const confirm = vi.spyOn(window, "confirm");
  mount(session);
  const table = screen.getByRole("table");
  const cards = screen.getByRole("list", { name: "Local account cards" });
  for (const surface of [table, cards]) {
    expect(
      within(surface).getByText("Writer", { exact: true })
    ).toBeInTheDocument();
    expect(
      within(surface).getByText("writer", { exact: true })
    ).toBeInTheDocument();
    expect(within(surface).getAllByText("Jan 01, 2026")).toHaveLength(2);
    expect(
      within(surface).getByRole("img", { name: "Writer, user" })
    ).toHaveTextContent("📚");
    expect(
      within(surface).getByRole("img", { name: "Manager, Admin" })
    ).toHaveTextContent("👑");
    expect(within(surface).queryByText(user.password)).not.toBeInTheDocument();
    expect(
      within(surface).queryByRole("button", { name: "Delete manager" })
    ).not.toBeInTheDocument();
    expect(
      within(surface).getByRole("button", { name: "Delete default Admin" })
    ).toBeDisabled();
    expect(
      within(surface).getByText("Default admin cannot be deleted.")
    ).toBeInTheDocument();
  }
  expect(confirm).not.toHaveBeenCalled();
  expect(readUsers()).toEqual([user, manager]);
  expect(
    screen.getByRole("link", { name: "Back to Admin Dashboard" })
  ).toHaveAttribute("href", "/admin");
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
});
it("shows default Admin once in each layout even if aliases are stored", () => {
  writeUsers([
    { ...user, id: "admin", username: "ADMIN", role: "admin" },
    { ...user, id: "alias", username: " admin " },
  ]);
  mount();
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  expect(
    within(screen.getByRole("list")).getAllByRole("listitem")
  ).toHaveLength(1);
});
it("shows empty-managed explanation and protected built-in account", async () => {
  mount();
  expect(screen.getByText(/No managed accounts yet/)).toBeInTheDocument();
  const confirm = vi.spyOn(window, "confirm");
  await userEvent.click(
    within(screen.getByRole("table")).getByRole("button", {
      name: "Delete default Admin",
    })
  );
  expect(confirm).not.toHaveBeenCalled();
  expect(readUsers()).toEqual([]);
});
it("associates all required-field errors including required canonical role", async () => {
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
  for (const [label, error] of [
    ["Display Name", "Display name is required."],
    ["Username", "Username is required."],
    ["Password", "Password is required."],
    ["Role", "Choose Admin or user."],
  ]) {
    expect(screen.getByLabelText(label, { exact: true })).toBeRequired();
    expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(
      screen.getByLabelText(label, { exact: true })
    ).toHaveAccessibleDescription(error);
  }
  expect(readUsers()).toEqual([]);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it.each(["admin", "user"])(
  "creates selected %s with trimmed identity, exact password and durable row on remount",
  async (role) => {
    writeUsers([user]);
    writeSession(DEFAULT_ADMIN);
    const view = mount();
    await fill(role);
    await userEvent.click(
      screen.getByRole("button", { name: "Create Account" })
    );
    expect(screen.getByRole("status")).toHaveTextContent("Account created.");
    const stored = readUsers();
    expect(stored).toHaveLength(2);
    expect(stored[1]).toMatchObject({
      displayName: "New Writer",
      username: "new-writer",
      password: " demo ",
      role,
    });
    expect(stored[1].id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Date(stored[1].createdAt).toISOString()).toBe(
      stored[1].createdAt
    );
    expect(readSession()).toEqual(DEFAULT_ADMIN);
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Role", { exact: true })).toHaveValue("");
    view.unmount();
    mount();
    expect(
      within(screen.getByRole("table")).getByText("new-writer")
    ).toBeInTheDocument();
    expect(screen.queryByText(" demo ")).not.toBeInTheDocument();
  }
);
it.each([
  [" AdMiN ", "Username admin is reserved."],
  [" WRITER ", "Username is already taken."],
])(
  "rejects reserved or normalized duplicate %s from freshly stored data",
  async (username, message) => {
    mount();
    writeUsers([user]);
    await fill("user", username);
    await userEvent.click(
      screen.getByRole("button", { name: "Create Account" })
    );
    expect(
      screen.getByLabelText("Username", { exact: true })
    ).toHaveAccessibleDescription(message);
    expect(screen.getByLabelText("Username", { exact: true })).toHaveValue(
      username
    );
    expect(readUsers()).toEqual([user]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }
);
it.each([null, { ...DEFAULT_ADMIN, role: "user" }])(
  "rejects account creation for %j at handler/service and hides eligible delete",
  async (identity) => {
    writeUsers([user]);
    mount(identity);
    await fill();
    await userEvent.click(
      screen.getByRole("button", { name: "Create Account" })
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Only Admin");
    expect(
      screen.queryByRole("button", { name: "Delete writer" })
    ).not.toBeInTheDocument();
    expect(readUsers()).toEqual([user]);
  }
);
it("rejects unsupported role even when the select DOM is tampered with", async () => {
  mount();
  await fill();
  const select = screen.getByLabelText("Role", { exact: true });
  const option = document.createElement("option");
  option.value = "owner";
  select.append(option);
  fireEvent.change(select, { target: { value: "owner" } });
  await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
  expect(select).toHaveAccessibleDescription("Choose Admin or user.");
  expect(readUsers()).toEqual([]);
});
it("keeps fields and records on create write failure then clears error after explicit retry", async () => {
  writeUsers([user]);
  mount();
  await fill();
  const failure = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("private");
    });
  await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Changes could not be saved"
  );
  expect(screen.getByLabelText("Username", { exact: true })).toHaveValue(
    "new-writer"
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(readUsers()).toEqual([user]);
  failure.mockRestore();
  await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(readUsers()).toHaveLength(2);
});
it("shows metadata failure with no false success", async () => {
  mount();
  await fill();
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
    throw new Error("private");
  });
  await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Account could not be created"
  );
  expect(readUsers()).toEqual([]);
});
it("cancels then confirms eligible deletion preserving fresh unrelated data and session", async () => {
  writeUsers([user]);
  writeSession(DEFAULT_ADMIN);
  const view = mount();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await userEvent.click(deleteButton());
  expect(readUsers()).toEqual([user]);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  writeUsers([user, manager]);
  confirm.mockReturnValue(true);
  await userEvent.click(deleteButton());
  expect(readUsers()).toEqual([manager]);
  expect(readSession()).toEqual(DEFAULT_ADMIN);
  expect(screen.getByRole("status")).toHaveTextContent("Account deleted.");
  expect(
    screen.queryByRole("button", { name: "Delete writer" })
  ).not.toBeInTheDocument();
  view.unmount();
  mount();
  expect(
    within(screen.getByRole("table")).getByText("manager")
  ).toBeInTheDocument();
});
it("mobile-card deletion is the same activated confirmed workflow", async () => {
  writeUsers([user]);
  mount();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await userEvent.click(
    within(screen.getByRole("list")).getByRole("button", {
      name: "Delete writer",
    })
  );
  expect(readUsers()).toEqual([]);
  expect(screen.getByText(/No managed accounts yet/)).toBeInTheDocument();
});
it("keeps row on delete write failure and allows explicit retry", async () => {
  writeUsers([user]);
  mount();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const failure = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("private");
    });
  await userEvent.click(deleteButton());
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Changes could not be saved"
  );
  expect(deleteButton()).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(readUsers()).toEqual([user]);
  failure.mockRestore();
  await userEvent.click(deleteButton());
  expect(readUsers()).toEqual([]);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("rejects a stale removed account before confirmation", async () => {
  writeUsers([user]);
  mount();
  writeUsers([]);
  const confirm = vi.spyOn(window, "confirm");
  await userEvent.click(deleteButton());
  expect(screen.getByRole("alert")).toHaveTextContent("no longer exists");
  expect(confirm).not.toHaveBeenCalled();
  expect(readUsers()).toEqual([]);
});
it("repeats permission on stale delete after active role changes", async () => {
  const identity = { ...DEFAULT_ADMIN };
  writeUsers([user]);
  mount(identity);
  identity.role = "user";
  const confirm = vi.spyOn(window, "confirm");
  await userEvent.click(deleteButton());
  expect(screen.getByRole("alert")).toHaveTextContent("cannot be deleted");
  expect(confirm).not.toHaveBeenCalled();
  expect(readUsers()).toEqual([user]);
});
it.each(["missing", "reserved", "self", "role"])(
  "rejects target/session changed during confirmation: %s",
  async (change) => {
    const identity = { ...DEFAULT_ADMIN };
    writeUsers([user]);
    mount(identity);
    vi.spyOn(window, "confirm").mockImplementation(() => {
      if (change === "missing") writeUsers([]);
      if (change === "reserved") writeUsers([{ ...user, username: "ADMIN" }]);
      if (change === "self") identity.userId = user.id;
      if (change === "role") identity.role = "user";
      return true;
    });
    await userEvent.click(deleteButton());
    expect(screen.getByRole("alert")).toHaveTextContent(
      change === "missing"
        ? "no longer exists"
        : change === "role"
        ? "Only Admin"
        : "cannot be deleted"
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(readUsers()).toEqual(
      change === "missing"
        ? []
        : change === "reserved"
        ? [{ ...user, username: "ADMIN" }]
        : [user]
    );
  }
);
it.each(["{broken", "{}", "null", "[null,1,{}]"])(
  "renders safe empty account state for malformed %s without repairing data",
  (raw) => {
    localStorage.setItem("writespace_users", raw);
    mount();
    expect(screen.getByText(/No managed accounts yet/)).toBeInTheDocument();
    expect(localStorage.getItem("writespace_users")).toBe(raw);
  }
);
it("reports total storage unavailability without false creation success or losing entered fields", async () => {
  writeUsers([user]);
  mount();
  await fill();
  const reads = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(() => {
      throw new Error("private");
    });
  const writes = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("private");
    });
  await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Changes could not be saved"
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Username", { exact: true })).toHaveValue(
    "new-writer"
  );
  expect(deleteButton()).toBeInTheDocument();
  reads.mockRestore();
  writes.mockRestore();
  expect(readUsers()).toEqual([user]);
});

it("renders safely when collection reads are inaccessible", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("private");
  });
  mount();
  expect(screen.getByText(/No managed accounts yet/)).toBeInTheDocument();
});
it("escapes stored names and usernames as text", () => {
  writeUsers([
    {
      ...user,
      displayName: "<script>literal</script>",
      username: "<b>writer</b>",
    },
  ]);
  const view = mount();
  expect(
    within(screen.getByRole("table")).getByText("<script>literal</script>")
  ).toBeInTheDocument();
  expect(view.container.querySelector("script, b")).toBeNull();
});
