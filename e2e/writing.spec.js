/** Exercise writing via live UI, real browser storage and native confirmation. */
import { test, expect } from "./fixtures.js";

const owner = {
  id: "writing-owner",
  displayName: "Demo Writer",
  username: "writing-owner",
  password: "synthetic",
  role: "user",
  createdAt: "2026-01-01",
};
const other = {
  ...owner,
  id: "writing-other",
  username: "writing-other",
  displayName: "Other Writer",
};
const post = {
  id: "original",
  title: "Original writing",
  content: "  Original\ntext ",
  createdAt: "2026-01-02T00:00:00.000Z",
  authorId: owner.id,
  authorName: "Original Writer",
};

/** Seed synthetic records and enter via actual login controls, never a session seed. */
async function login(
  page,
  username = owner.username,
  password = owner.password,
  posts = [post]
) {
  await page.evaluate(
    ({ users, posts }) => {
      localStorage.setItem("writespace_users", JSON.stringify(users));
      localStorage.setItem("writespace_posts", JSON.stringify(posts));
    },
    { users: [owner, other], posts }
  );
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

for (const entry of ["/write", "/edit/original"]) {
  test(`guest ${entry} enters via login, creates, edits, cancels and confirms deletion across reloads`, async ({
    page,
  }) => {
    await page.goto(entry);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Content", { exact: true })).toHaveCount(0);
    await login(page);
    await page.getByRole("link", { name: "Write", exact: true }).click();
    await page.getByRole("button", { name: "Publish Post" }).click();
    await expect(
      page.getByText("Title is required.", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Content is required.", { exact: true })
    ).toBeVisible();
    await page.getByLabel("Title", { exact: true }).fill("   ");
    await page.getByLabel("Content", { exact: true }).fill("\n\t ");
    await page.getByRole("button", { name: "Publish Post" }).click();
    await expect(page.getByLabel("Content", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts"))
      )
    ).toEqual([post]);
    await page.getByLabel("Title", { exact: true }).fill("Discard this draft");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts"))
      )
    ).toEqual([post]);

    await page.getByRole("link", { name: "Write", exact: true }).click();
    const content =
      "  First line\n\n<script>literal</script>\t " + "x".repeat(300);
    await page.getByLabel("Title", { exact: true }).fill("  New writing  ");
    await page.getByLabel("Content", { exact: true }).fill(content);
    await expect(
      page.getByText(`${content.length} characters`, { exact: true })
    ).toBeVisible();
    expect(
      await page
        .getByLabel("Content", { exact: true })
        .evaluate((element) => parseFloat(getComputedStyle(element).minHeight))
    ).toBeGreaterThanOrEqual(256);
    await page.getByRole("button", { name: "Publish Post" }).click();
    await expect(page).toHaveURL(/\/blog\//);
    const created = (
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts"))
      )
    )[1];
    expect(created).toMatchObject({
      title: "  New writing  ",
      content,
      authorId: owner.id,
      authorName: owner.displayName,
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    expect(await page.locator(".post-content").textContent()).toBe(content);
    await expect(page.locator(".post-content script")).toHaveCount(0);
    await page.reload();
    expect(await page.locator(".post-content").textContent()).toBe(content);

    await page.getByRole("link", { name: "Edit Post", exact: true }).click();
    await expect(page.getByLabel("Content", { exact: true })).toHaveValue(
      content
    );
    await page.getByLabel("Title", { exact: true }).fill("Discard revision");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts"))
      )
    ).toEqual([post, created]);
    await page.getByRole("link", { name: "Edit Post", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill("Revised writing");
    await page.getByLabel("Content", { exact: true }).fill("  Revised\ntext ");
    await page.getByRole("button", { name: "Save Changes" }).click();
    const revised = {
      ...created,
      title: "Revised writing",
      content: "  Revised\ntext ",
    };
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts"))
      )
    ).toEqual([post, revised]);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Revised writing" })
    ).toBeVisible();

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Delete Post" }).click();
    await expect(
      page.getByRole("heading", { name: "Revised writing" })
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts"))
      )
    ).toEqual([post, revised]);
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Delete Post" }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts"))
      )
    ).toEqual([post]);
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Revised writing", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: post.title, exact: true })
    ).toBeVisible();
  });
}

test("nonowner cannot edit or delete another author, including a stale edit link", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page, other.username, other.password);
  await page.getByRole("link", { name: post.title, exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Edit Post", exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Post" })).toHaveCount(
    0
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts"))
    )
  ).toEqual([post]);
  // Obtain an own-post link through the UI, then change ownership before activation.
  await page.getByRole("link", { name: "Write", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Other own post");
  await page.getByLabel("Content", { exact: true }).fill("Synthetic text");
  await page.getByRole("button", { name: "Publish Post" }).click();
  await page.evaluate(() => {
    const posts = JSON.parse(localStorage.getItem("writespace_posts"));
    posts[1].authorId = "writing-owner";
    localStorage.setItem("writespace_posts", JSON.stringify(posts));
  });
  const latest = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("writespace_posts"))
  );
  await page.getByRole("link", { name: "Edit Post", exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByLabel("Content", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts"))
    )
  ).toEqual(latest);
});

test("missing edit target displays back link and a stale save keeps the draft visible", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await page.getByRole("link", { name: post.title, exact: true }).click();
  await page.evaluate(() => localStorage.setItem("writespace_posts", "[]"));
  await page.getByRole("link", { name: "Edit Post", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Post not found" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to All Blogs" }).click();
  await page.getByRole("link", { name: "Write a Post", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Temporary post");
  await page.getByLabel("Content", { exact: true }).fill("Temporary text");
  await page.getByRole("button", { name: "Publish Post" }).click();
  await page.getByRole("link", { name: "Edit Post", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Keep my draft");
  await page.evaluate(() => localStorage.setItem("writespace_posts", "[]"));
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "The selected record no longer exists."
  );
  await expect(page).toHaveURL(/\/edit\//);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Keep my draft"
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts"))
    )
  ).toEqual([]);
});

test("stale ownership blocks save and confirmed deletion without changing displayed state", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await page.getByRole("link", { name: post.title, exact: true }).click();
  await page.getByRole("link", { name: "Edit Post", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Keep forbidden draft");
  const reassigned = { ...post, authorId: other.id };
  await page.evaluate(
    (post) => localStorage.setItem("writespace_posts", JSON.stringify([post])),
    reassigned
  );
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "You cannot manage this post."
  );
  await expect(page).toHaveURL(/\/edit\/original$/);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Keep forbidden draft"
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts"))
    )
  ).toEqual([reassigned]);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete Post" })).toHaveCount(
    0
  );
  await page.evaluate(
    (post) => localStorage.setItem("writespace_posts", JSON.stringify([post])),
    post
  );
  await page.getByRole("link", { name: "Back to All Blogs" }).click();
  await page.getByRole("link", { name: post.title, exact: true }).click();
  await page.evaluate(
    (post) => localStorage.setItem("writespace_posts", JSON.stringify([post])),
    reassigned
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Post" }).click();
  await expect(page).toHaveURL(/\/blog\/original$/);
  await expect(page.getByRole("heading", { name: post.title })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText(
    "You cannot manage this post."
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts"))
    )
  ).toEqual([reassigned]);
});

test("Admin can edit and delete another author while retaining original metadata", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page, "admin", "admin");
  await page.getByRole("link", { name: "All Blogs", exact: true }).click();
  await page.getByRole("link", { name: post.title, exact: true }).click();
  await page.getByRole("link", { name: "Edit Post", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Admin revision");
  await page.getByRole("button", { name: "Save Changes" }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts"))
    )
  ).toEqual([{ ...post, title: "Admin revision" }]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Post" }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.reload();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts"))
    )
  ).toEqual([]);
  await expect(
    page.getByRole("heading", { name: "No posts yet" })
  ).toBeVisible();
});

test("mobile writer reaches editor via hamburger and cancels without persisting a draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await login(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Write", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Discard mobile draft");
  await page.getByLabel("Content", { exact: true }).fill("text".repeat(1000));
  await expect(
    page.getByText("4000 characters", { exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: "test-results/writing-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts"))
    )
  ).toEqual([post]);
});
