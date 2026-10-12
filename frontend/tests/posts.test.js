/** Verify typed mutation outcomes against re-read browser-local state. */
import { it, expect, vi } from "vitest";
import { createPost, updatePost, deletePost } from "../src/lib/posts.js";
import { readPosts, writePosts } from "../src/lib/storage.js";
import { DEFAULT_ADMIN } from "../src/lib/permissions.js";

const owner = {
  userId: "u1",
  username: "writer",
  displayName: "Writer",
  role: "user",
};
const post = {
  id: "p1",
  title: "Original",
  content: "Original text",
  createdAt: "2026-01-01T12:00:00.000Z",
  authorId: "u1",
  authorName: "Original Writer",
};
const fields = {
  title: "  Revised  ",
  content: " \n<script>literal</script>\t ",
};

it.each([owner, DEFAULT_ADMIN])(
  "creates UUID, timestamp and active author for %j without trimming text",
  (session) => {
    writePosts([post]);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("new-uuid");
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue(
      "2026-03-01T00:00:00.000Z"
    );
    const result = createPost(fields, session);
    expect(result).toEqual({
      ok: true,
      value: {
        id: "new-uuid",
        ...fields,
        createdAt: "2026-03-01T00:00:00.000Z",
        authorId: session.userId,
        authorName: session.displayName,
      },
    });
    expect(readPosts()).toEqual([post, result.value]);
  }
);

it.each([
  undefined,
  null,
  {},
  [],
  { title: 1, content: "text" },
  { title: "text", content: {} },
  { title: "\n\t ", content: "text" },
  { title: "text", content: "\n\t " },
])("rejects invalid fields %j on create and update without writes", (input) => {
  writePosts([post]);
  const stored = localStorage.getItem("writespace_posts");
  for (const result of [
    createPost(input, owner),
    updatePost("p1", input, owner),
  ]) {
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(["title", "content"]).toContain(result.error.field);
  }
  expect(readPosts()).toEqual([post]);
  expect(localStorage.getItem("writespace_posts")).toBe(stored);
});

it.each([
  null,
  undefined,
  {},
  [],
  { ...owner, role: "Admin" },
  { ...owner, userId: 2 },
  { ...owner, displayName: null },
  { userId: "u1", role: "user" },
])("rejects invalid active session %j for all mutations", (session) => {
  writePosts([post]);
  expect(createPost(fields, session)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(updatePost("p1", fields, session)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(deletePost("p1", session)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(readPosts()).toEqual([post]);
});

it.each([owner, DEFAULT_ADMIN])(
  "updates only editable fields for %j preserving metadata and unrelated records",
  (session) => {
    const other = { ...post, id: "other" };
    writePosts([post, other]);
    const result = updatePost(
      "p1",
      {
        ...fields,
        id: "injected",
        authorId: "injected",
        createdAt: "injected",
      },
      session
    );
    expect(result).toEqual({ ok: true, value: { ...post, ...fields } });
    expect(readPosts()).toEqual([{ ...post, ...fields }, other]);
  }
);

it("rejects nonowner update and delete, including freshly reassigned ownership", () => {
  writePosts([{ ...post, authorId: "different" }]);
  expect(updatePost("p1", fields, owner)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(deletePost("p1", owner)).toMatchObject({
    ok: false,
    error: { code: "FORBIDDEN" },
  });
  expect(readPosts()).toEqual([{ ...post, authorId: "different" }]);
});

it.each([undefined, null, 1, {}, [], "missing"])(
  "reports missing or wrong-type target %j without touching another post",
  (id) => {
    writePosts([post]);
    expect(updatePost(id, fields, owner)).toEqual({
      ok: false,
      error: {
        code: "TARGET_NOT_FOUND",
        message: "The selected record no longer exists.",
      },
    });
    expect(deletePost(id, owner)).toEqual({
      ok: false,
      error: {
        code: "TARGET_NOT_FOUND",
        message: "The selected record no longer exists.",
      },
    });
    expect(readPosts()).toEqual([post]);
  }
);

it.each([owner, DEFAULT_ADMIN])(
  "deletes only selected post and returns null for %j",
  (session) => {
    const other = { ...post, id: "other" };
    writePosts([post, other]);
    expect(deletePost("p1", session)).toEqual({ ok: true, value: null });
    expect(readPosts()).toEqual([other]);
  }
);

it("reads latest collection and metadata across successive mutations, never using an independent cache", () => {
  writePosts([post]);
  expect(updatePost("p1", fields, owner).ok).toBe(true);
  const latest = {
    ...post,
    authorName: "Latest author",
    createdAt: "2025-01-01",
  };
  const added = { ...post, id: "added" };
  writePosts([latest, added]);
  expect(updatePost("p1", fields, owner).value).toEqual({
    ...latest,
    ...fields,
  });
  expect(readPosts()).toEqual([{ ...latest, ...fields }, added]);
  writePosts([added]);
  expect(deletePost("p1", owner).error.code).toBe("TARGET_NOT_FOUND");
  expect(createPost(fields, owner).ok).toBe(true);
  expect(readPosts()[0]).toEqual(added);
  expect(readPosts()).toHaveLength(2);
});

it.each([null, "{bad", "{}", '[{"id":"p1"}]'])(
  "uses safe empty reads for malformed post storage %s",
  (raw) => {
    if (raw !== null) localStorage.setItem("writespace_posts", raw);
    expect(updatePost("p1", fields, owner).error.code).toBe("TARGET_NOT_FOUND");
    expect(deletePost("p1", owner).error.code).toBe("TARGET_NOT_FOUND");
    expect(localStorage.getItem("writespace_posts")).toBe(raw);
    expect(readPosts()).toEqual([]);
    const created = createPost(fields, owner);
    expect(created.ok).toBe(true);
    expect(readPosts()).toEqual([created.value]);
  }
);

it("handles inaccessible collection reads as empty without reporting false update/delete success", () => {
  writePosts([post]);
  const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("private");
  });
  expect(updatePost("p1", fields, owner).error.code).toBe("TARGET_NOT_FOUND");
  expect(deletePost("p1", owner).error.code).toBe("TARGET_NOT_FOUND");
  spy.mockRestore();
  expect(readPosts()).toEqual([post]);
});

it.each(["create", "update", "delete"])(
  "preserves persisted state on %s write failure and permits explicit retry",
  (operation) => {
    writePosts([post]);
    const mutate = () =>
      operation === "create"
        ? createPost(fields, owner)
        : operation === "update"
        ? updatePost("p1", fields, owner)
        : deletePost("p1", owner);
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("secret quota details");
      });
    expect(mutate()).toEqual({
      ok: false,
      error: {
        code: "STORAGE_WRITE_FAILED",
        message:
          operation === "delete"
            ? "Changes could not be saved in this browser."
            : "Post could not be saved in this browser.",
      },
    });
    expect(readPosts()).toEqual([post]);
    spy.mockRestore();
    expect(mutate().ok).toBe(true);
    expect(readPosts()).toHaveLength(
      operation === "create" ? 2 : operation === "delete" ? 0 : 1
    );
    if (operation === "update")
      expect(readPosts()[0]).toEqual({ ...post, ...fields });
  }
);

it.each(["uuid", "time"])(
  "reports typed %s generation failure and does not persist",
  (source) => {
    writePosts([post]);
    vi.spyOn(
      source === "uuid" ? crypto : Date.prototype,
      source === "uuid" ? "randomUUID" : "toISOString"
    ).mockImplementation(() => {
      throw new Error("private");
    });
    expect(createPost(fields, owner)).toEqual({
      ok: false,
      error: {
        code: "POST_CREATION_FAILED",
        message: "Post could not be created in this browser.",
      },
    });
    expect(readPosts()).toEqual([post]);
  }
);

it("preserves large content without imposing unstated length limits", () => {
  const large = { title: "x".repeat(1000), content: "text\n".repeat(20000) };
  const result = createPost(large, owner);
  expect(result.ok).toBe(true);
  expect(readPosts()).toEqual([result.value]);
  expect(result.value.content).toBe(large.content);
});
