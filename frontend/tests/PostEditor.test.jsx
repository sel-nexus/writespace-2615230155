/** Verify editor feedback, prefill, plain-text preservation and no-write cancel. */
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostEditor } from "../src/components/PostEditor.jsx";
import { createPost } from "../src/lib/posts.js";
import { readPosts, writePosts } from "../src/lib/storage.js";

const session = {
  userId: "u1",
  username: "writer",
  displayName: "Writer",
  role: "user",
};

it("starts empty and displays both associated required errors without saving", async () => {
  const save = vi.fn();
  render(<PostEditor onSave={save} onCancel={vi.fn()} />);
  expect(screen.getByLabelText("Title")).toHaveValue("");
  expect(screen.getByLabelText("Content")).toHaveValue("");
  expect(screen.getByText("0 characters")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
  expect(screen.getByLabelText("Title")).toHaveAccessibleDescription(
    "Title is required."
  );
  expect(screen.getByLabelText("Content")).toHaveAccessibleDescription(
    "Content is required. 0 characters"
  );
  expect(screen.getByLabelText("Content")).toHaveAttribute(
    "aria-invalid",
    "true"
  );
  expect(save).not.toHaveBeenCalled();
  expect(readPosts()).toEqual([]);
});

it.each([
  [" ", "text", "Title is required."],
  ["title", "\n\t ", "Content is required."],
])("rejects whitespace fields independently", async (title, content, error) => {
  render(
    <PostEditor
      initialFields={{ title, content }}
      onSave={(fields) => createPost(fields, session)}
      onCancel={vi.fn()}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
  expect(screen.getByRole("alert")).toHaveTextContent(error);
  expect(readPosts()).toEqual([]);
});

it("prefills, updates counter on edit and clear, and saves raw text with a custom label", async () => {
  render(
    <PostEditor
      initialFields={{ title: "Draft", content: "old" }}
      submitLabel="Save Changes"
      onSave={(fields) => createPost(fields, session)}
      onCancel={vi.fn()}
    />
  );
  expect(screen.getByLabelText("Title")).toHaveValue("Draft");
  expect(screen.getByText("3 characters")).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText("Content"));
  expect(screen.getByText("0 characters")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: " \n<b>literal</b>\t " },
  });
  expect(screen.getByText("18 characters")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(readPosts()[0]).toMatchObject({
    title: "Draft",
    content: " \n<b>literal</b>\t ",
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("cancels an edited invalid draft without invoking save or changing storage", async () => {
  writePosts([]);
  const stored = localStorage.getItem("writespace_posts");
  const save = vi.fn();
  const cancel = vi.fn();
  render(<PostEditor onSave={save} onCancel={cancel} />);
  await userEvent.type(screen.getByLabelText("Title"), "discard");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
  expect(localStorage.getItem("writespace_posts")).toBe(stored);
  expect(readPosts()).toEqual([]);
});

it("shows typed field failure and preserves entered values", async () => {
  render(
    <PostEditor
      initialFields={{ title: "Title", content: "Text" }}
      onSave={() => ({
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          field: "content",
          message: "Content is required.",
        },
      })}
      onCancel={vi.fn()}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
  expect(screen.getByLabelText("Content")).toHaveAccessibleDescription(
    "Content is required. 4 characters"
  );
  expect(screen.getByLabelText("Content")).toHaveValue("Text");
  expect(readPosts()).toEqual([]);
});

it("keeps draft on real storage failure then clears feedback on successful retry", async () => {
  render(
    <PostEditor
      initialFields={{ title: "Title", content: "Text" }}
      onSave={(fields) => createPost(fields, session)}
      onCancel={vi.fn()}
    />
  );
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Post could not be saved in this browser."
  );
  expect(screen.getByLabelText("Title")).toHaveValue("Title");
  expect(screen.getByLabelText("Content")).toHaveValue("Text");
  expect(readPosts()).toEqual([]);
  spy.mockRestore();
  await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(readPosts()[0]).toMatchObject({ title: "Title", content: "Text" });
});

it("allows a large draft and clears old validation feedback after valid submission", async () => {
  render(
    <PostEditor
      onSave={(fields) => createPost(fields, session)}
      onCancel={vi.fn()}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Large" },
  });
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: "x".repeat(10000) },
  });
  expect(screen.getByText("10000 characters")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Publish Post" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(readPosts()[0].content).toHaveLength(10000);
});
