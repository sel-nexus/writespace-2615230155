/** Verify account rules against real re-read browser-local persistence. */
import { it, expect, vi } from "vitest";
import {
  accountRows,
  countUsers,
  createManagedUser,
  deleteManagedUser,
} from "../src/lib/users.js";
import {
  readUsers,
  writeUsers,
  writeSession,
  readSession,
} from "../src/lib/storage.js";
import { DEFAULT_ADMIN } from "../src/lib/permissions.js";

const user = {
  id: "u1",
  displayName: "Writer",
  username: "writer",
  password: "synthetic",
  role: "user",
  createdAt: "2026-01-01",
};
const input = {
  displayName: "  New Writer  ",
  username: " NewWriter ",
  password: " demo ",
  role: "user",
};
const manager = { ...DEFAULT_ADMIN, userId: "manager", username: "manager" };

it.each([
  [[], { totalUsers: 1, totalAdmins: 1, totalMembers: 0 }],
  [[user], { totalUsers: 2, totalAdmins: 1, totalMembers: 1 }],
  [
    [user, { ...user, id: "a1", username: "boss", role: "admin" }],
    { totalUsers: 3, totalAdmins: 2, totalMembers: 1 },
  ],
  [
    [{ ...user, id: "admin", username: "fixed" }, user],
    { totalUsers: 2, totalAdmins: 1, totalMembers: 1 },
  ],
  [
    [
      { ...user, id: "alias", username: " AdMiN " },
      { ...user, id: "admin", role: "admin" },
      user,
    ],
    { totalUsers: 2, totalAdmins: 1, totalMembers: 1 },
  ],
])("counts the fixed Admin once for %j", (users, expected) => {
  writeUsers(users);
  expect(countUsers()).toEqual(expected);
  expect(countUsers(users)).toEqual(expected);
  expect(accountRows().filter((row) => row.id === "admin")).toHaveLength(1);
  expect(accountRows()[0]).toMatchObject({
    username: "admin",
    role: "admin",
    createdAt: "",
  });
  expect(accountRows()[0]).not.toHaveProperty("password");
  expect(readUsers()).toEqual(users);
});

it.each(["admin", "user"])(
  "creates canonical %s with UUID/time and leaves session unchanged",
  (role) => {
    writeUsers([user]);
    writeSession(DEFAULT_ADMIN);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("new-uuid");
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue(
      "2026-03-01T00:00:00.000Z"
    );
    const result = createManagedUser(
      { ...input, role, id: "injected", createdAt: "injected" },
      DEFAULT_ADMIN
    );
    expect(result).toEqual({
      ok: true,
      value: {
        id: "new-uuid",
        displayName: "New Writer",
        username: "NewWriter",
        password: " demo ",
        role,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    });
    expect(readUsers()).toEqual([user, result.value]);
    expect(readSession()).toEqual(DEFAULT_ADMIN);
  }
);

it("uses real runtime UUID and ISO time for managed creation", () => {
  const before = Date.now();
  const result = createManagedUser(input, manager);
  expect(result.ok).toBe(true);
  expect(result.value.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
  expect(Date.parse(result.value.createdAt)).toBeGreaterThanOrEqual(before);
  expect(new Date(result.value.createdAt).toISOString()).toBe(
    result.value.createdAt
  );
  expect(readUsers()).toEqual([result.value]);
});

it.each([
  null,
  undefined,
  {},
  [],
  { ...DEFAULT_ADMIN, role: "user" },
  { ...DEFAULT_ADMIN, role: "Admin" },
  { ...DEFAULT_ADMIN, userId: 1 },
  { ...DEFAULT_ADMIN, displayName: null },
])("rejects inactive or non-Admin session %j for both services", (session) => {
  writeUsers([user]);
  expect(createManagedUser(input, session)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(deleteManagedUser(user.id, session, true)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(readUsers()).toEqual([user]);
});

it.each([
  [undefined, "username"],
  [null, "username"],
  [{}, "username"],
  [[], "username"],
  [{ ...input, displayName: "" }, "displayName"],
  [{ ...input, displayName: " \t " }, "displayName"],
  [{ ...input, displayName: 1 }, "displayName"],
  [{ ...input, username: null }, "username"],
  [{ ...input, username: "\n " }, "username"],
  [{ ...input, username: {} }, "username"],
  [{ ...input, password: "" }, "password"],
  [{ ...input, password: 2 }, "password"],
  [{ ...input, role: undefined }, "role"],
  [{ ...input, role: null }, "role"],
  [{ ...input, role: "Admin" }, "role"],
  [{ ...input, role: 1 }, "role"],
  [{ ...input, role: "owner" }, "role"],
])(
  "rejects missing/wrong-type/canonical fields %j without persistence",
  (fields, field) => {
    writeUsers([user]);
    const raw = localStorage.getItem("writespace_users");
    expect(createManagedUser(fields, DEFAULT_ADMIN)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED", field },
    });
    expect(readUsers()).toEqual([user]);
    expect(localStorage.getItem("writespace_users")).toBe(raw);
  }
);

it.each(["admin", " AdMiN ", "ADMIN"])(
  "rejects reserved username %s",
  (username) => {
    expect(
      createManagedUser({ ...input, username }, DEFAULT_ADMIN)
    ).toMatchObject({
      ok: false,
      error: { code: "USERNAME_RESERVED", field: "username" },
    });
    expect(readUsers()).toEqual([]);
  }
);
it.each(["writer", " WRITER ", "Writer"])(
  "rejects fresh normalized duplicate %s",
  (username) => {
    writeUsers([{ ...user, username: " Writer " }]);
    expect(
      createManagedUser({ ...input, username }, DEFAULT_ADMIN)
    ).toMatchObject({ ok: false, error: { code: "USERNAME_DUPLICATE" } });
    expect(readUsers()).toEqual([{ ...user, username: " Writer " }]);
  }
);
it("re-reads newly stored accounts before append and before deletion", () => {
  writeUsers([user]);
  const fresh = { ...user, id: "fresh", username: "fresh" };
  writeUsers([user, fresh]);
  const result = createManagedUser(input, DEFAULT_ADMIN);
  expect(readUsers()).toEqual([user, fresh, result.value]);
  expect(deleteManagedUser("u1", DEFAULT_ADMIN, true)).toEqual({
    ok: true,
    value: null,
  });
  expect(readUsers()).toEqual([fresh, result.value]);
});

it.each([undefined, null, 1, {}, "missing"])(
  "reports missing target %j without changes",
  (id) => {
    writeUsers([user]);
    expect(deleteManagedUser(id, DEFAULT_ADMIN, true)).toMatchObject({
      ok: false,
      error: { code: "TARGET_NOT_FOUND" },
    });
    expect(readUsers()).toEqual([user]);
  }
);
it.each([false, undefined, "true", 1, null])(
  "requires strict confirmed true, not %j",
  (confirmed) => {
    writeUsers([user]);
    expect(deleteManagedUser("u1", DEFAULT_ADMIN, confirmed)).toMatchObject({
      ok: false,
      error: { code: "CONFIRMATION_REQUIRED" },
    });
    expect(readUsers()).toEqual([user]);
  }
);
it.each([
  [{ ...user, id: "admin" }, DEFAULT_ADMIN],
  [{ ...user, id: "alias", username: " AdMiN " }, DEFAULT_ADMIN],
  [{ ...user, id: "manager", role: "admin" }, manager],
])("protects default aliases and current account %j", (target, session) => {
  writeUsers([target, user]);
  expect(deleteManagedUser(target.id, session, true)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(readUsers()).toEqual([target, user]);
});
it("protects synthetic default Admin when no managed rows exist", () => {
  expect(deleteManagedUser("admin", DEFAULT_ADMIN, true)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(localStorage.getItem("writespace_users")).toBeNull();
});
it.each(["admin", "user"])(
  "deletes eligible %s without deleting posts or session",
  (role) => {
    writeUsers([{ ...user, role }]);
    writeSession(DEFAULT_ADMIN);
    localStorage.setItem("writespace_posts", "synthetic-post-records");
    expect(deleteManagedUser("u1", DEFAULT_ADMIN, true)).toEqual({
      ok: true,
      value: null,
    });
    expect(readUsers()).toEqual([]);
    expect(readSession()).toEqual(DEFAULT_ADMIN);
    expect(localStorage.getItem("writespace_posts")).toBe(
      "synthetic-post-records"
    );
  }
);
it("rejects newly protected target after a fresh read", () => {
  writeUsers([user]);
  writeUsers([{ ...user, username: "ADMIN" }]);
  expect(deleteManagedUser("u1", DEFAULT_ADMIN, true)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(readUsers()).toEqual([{ ...user, username: "ADMIN" }]);
});

it.each(["{broken", "{}", "null", "[null,1,{}]"])(
  "reads corrupted %s safely without repairing it",
  (raw) => {
    localStorage.setItem("writespace_users", raw);
    expect(accountRows()).toHaveLength(1);
    expect(countUsers()).toEqual({
      totalUsers: 1,
      totalAdmins: 1,
      totalMembers: 0,
    });
    expect(localStorage.getItem("writespace_users")).toBe(raw);
    const result = createManagedUser(input, DEFAULT_ADMIN);
    expect(result.ok).toBe(true);
    expect(readUsers()).toEqual([result.value]);
  }
);
it("filters malformed stored rows without rewriting read source", () => {
  const raw = JSON.stringify([
    user,
    { ...user, role: "Admin" },
    null,
    { ...user, password: 1 },
  ]);
  localStorage.setItem("writespace_users", raw);
  expect(countUsers().totalUsers).toBe(2);
  expect(localStorage.getItem("writespace_users")).toBe(raw);
});
it("handles inaccessible collection reads as empty and reports missing deletion", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("private");
  });
  expect(countUsers()).toEqual({
    totalUsers: 1,
    totalAdmins: 1,
    totalMembers: 0,
  });
  expect(deleteManagedUser("u1", DEFAULT_ADMIN, true)).toMatchObject({
    ok: false,
    error: { code: "TARGET_NOT_FOUND" },
  });
  const result = createManagedUser(input, DEFAULT_ADMIN);
  expect(result.ok).toBe(true);
  vi.restoreAllMocks();
  expect(readUsers()).toEqual([result.value]);
});
it.each(["randomUUID", "toISOString"])(
  "reports metadata failure from %s without persistence",
  (method) => {
    writeUsers([user]);
    vi.spyOn(
      method === "randomUUID" ? crypto : Date.prototype,
      method
    ).mockImplementation(() => {
      throw new Error("private");
    });
    expect(createManagedUser(input, DEFAULT_ADMIN)).toMatchObject({
      ok: false,
      error: { code: "USER_CREATION_FAILED" },
    });
    expect(readUsers()).toEqual([user]);
  }
);
it("reports creation and deletion write failures with unchanged stored data", () => {
  writeUsers([user]);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("private");
  });
  expect(createManagedUser(input, DEFAULT_ADMIN)).toMatchObject({
    ok: false,
    error: { code: "STORAGE_WRITE_FAILED" },
  });
  expect(deleteManagedUser("u1", DEFAULT_ADMIN, true)).toMatchObject({
    ok: false,
    error: { code: "STORAGE_WRITE_FAILED" },
  });
  expect(readUsers()).toEqual([user]);
});
it("supports whitespace passwords and unbounded plain text without adding policy", () => {
  const result = createManagedUser(
    {
      ...input,
      displayName: "<script>literal</script>" + "x".repeat(10000),
      password: " ",
    },
    DEFAULT_ADMIN
  );
  expect(result.ok).toBe(true);
  expect(readUsers()).toEqual([result.value]);
});
