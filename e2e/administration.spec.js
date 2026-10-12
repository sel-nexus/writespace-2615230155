/** Exercise live Admin oversight with real UI login and browser-local records. */
import { test, expect } from "./fixtures.js";

const member = {
  id: "admin-story-writer",
  username: "story-writer",
  displayName: "Story Writer",
  password: "synthetic",
  role: "user",
  createdAt: "2026-01-01",
};
const manager = {
  ...member,
  id: "admin-story-manager",
  username: "story-manager",
  displayName: "Story Manager",
  role: "admin",
};
const posts = Array.from({ length: 7 }, (_, index) => ({
  id: `oversight-${index}`,
  title: `Oversight ${index}`,
  content: "Synthetic local writing",
  authorId: member.id,
  authorName: member.displayName,
  createdAt: `2026-01-0${index + 1}T00:00:00.000Z`,
}));
const requests = new WeakMap();

test.beforeEach(async ({ page }) => {
  const services = [];
  requests.set(page, services);
  page.on("request", (request) => {
    if (
      ["fetch", "xhr"].includes(request.resourceType()) ||
      request.method() !== "GET"
    )
      services.push(request.url());
  });
  page.on("websocket", (socket) => services.push(socket.url()));
});
test.afterEach(async ({ page }) => {
  expect(requests.get(page), "No application service requests").toEqual([]);
});

/** Activate actual login fields without seeding a session. */
async function login(page, username = "admin", password = "admin") {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}
/** Navigate through the responsive account navbar, opening it only when needed. */
async function nav(page, name) {
  const toggle = page.getByRole("button", { name: "Open menu", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .getByRole("navigation", { name: "Account navigation" })
    .getByRole("link", { name, exact: true })
    .click();
}
/** Seed synthetic account/post records only; authentication still belongs to the UI. */
async function seed(page) {
  await page.evaluate(
    ({ users, posts }) => {
      localStorage.setItem("writespace_users", JSON.stringify(users));
      localStorage.setItem("writespace_posts", JSON.stringify(posts));
    },
    { users: [member, manager], posts }
  );
}
/** Re-read the durable browser records after actions. */
async function stored(page, key) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(`writespace_${key}`)),
    key
  );
}

for (const entry of ["/admin", "/users"]) {
  test(`guest ${entry} redirects, member login rejects Admin access without exposing actions`, async ({
    page,
  }) => {
    await page.goto(entry);
    await expect(page).toHaveURL(/\/login$/);
    await seed(page);
    await login(page, member.username, member.password);
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(
      page.getByRole("link", { name: "Users", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Admin Dashboard" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Delete Oversight/ })
    ).toHaveCount(0);
    expect(await stored(page, "posts")).toEqual(posts);
    expect((await stored(page, "session")).role).toBe("user");
  });
}

test("fixed Admin four counts/five newest, all-author edit/cancel/delete and durable oversight", async ({
  page,
}) => {
  await page.goto("/admin");
  await seed(page);
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  for (const [label, count] of [
    ["Total Posts", 7],
    ["Total Users", 3],
    ["Total Admins", 2],
    ["Total user accounts", 1],
  ]) {
    await expect(
      page.getByText(label, { exact: true }).locator("..")
    ).toContainText(String(count));
  }
  await expect(page.locator(".admin-post h3")).toHaveText([
    "Oversight 6",
    "Oversight 5",
    "Oversight 4",
    "Oversight 3",
    "Oversight 2",
  ]);
  expect(await stored(page, "posts")).toEqual(posts);
  await page
    .getByRole("link", { name: "Edit Oversight 6", exact: true })
    .click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Oversight 6"
  );
  await page
    .getByLabel("Title", { exact: true })
    .fill("Discard oversight change");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await stored(page, "posts")).toEqual(posts);
  await page.getByRole("link", { name: "Edit Post", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Admin revised another author");
  await page.getByRole("button", { name: "Save Changes" }).click();
  const revised = { ...posts[6], title: "Admin revised another author" };
  expect((await stored(page, "posts"))[6]).toEqual(revised);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: revised.title })
  ).toBeVisible();
  await nav(page, "Users");
  await page.getByRole("link", { name: "Back to Admin Dashboard" }).click();
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();
  });
  await page
    .getByRole("button", { name: `Delete ${revised.title}`, exact: true })
    .click();
  expect(await stored(page, "posts")).toHaveLength(7);
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await page
    .getByRole("button", { name: `Delete ${revised.title}`, exact: true })
    .click();
  expect(await stored(page, "posts")).toEqual(posts.slice(0, 6));
  await expect(page.locator(".admin-post h3")).toHaveText([
    "Oversight 5",
    "Oversight 4",
    "Oversight 3",
    "Oversight 2",
    "Oversight 1",
  ]);
  await page.reload();
  await expect(
    page.getByRole("link", { name: revised.title, exact: true })
  ).toHaveCount(0);
  await page.getByRole("link", { name: "View All Blogs" }).click();
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true })
  ).toBeVisible();
  await nav(page, "Write");
  await expect(
    page.getByRole("heading", { name: "Write a Post" })
  ).toBeVisible();
});

for (const width of [390, 1024]) {
  test(`managed Admin at ${width}: account fields/protections/validation/creation/deletion persist`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/users");
    await seed(page);
    await login(page, manager.username, manager.password);
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("link", { name: "Manage Users" }).click();
    const surface =
      width < 640 ? page.locator(".user-cards") : page.getByRole("table");
    const hiddenSurface =
      width < 640
        ? page.locator(".users-table-wrap")
        : page.locator(".user-cards");
    await expect(surface).toBeVisible();
    await expect(hiddenSurface).toBeHidden();
    await expect(
      surface.getByText(member.username, { exact: true })
    ).toBeVisible();
    await expect(
      surface.getByText(member.displayName, { exact: true })
    ).toBeVisible();
    await expect(surface.getByText("Jan 01, 2026")).toHaveCount(2);
    await expect(
      surface.getByRole("img", { name: "Story Manager, Admin" })
    ).toBeVisible();
    await expect(
      surface.getByRole("img", { name: "Story Writer, user" })
    ).toBeVisible();
    await expect(
      surface.getByRole("button", { name: `Delete ${manager.username}` })
    ).toHaveCount(0);
    await expect(
      surface.getByRole("button", { name: "Delete default Admin" })
    ).toBeDisabled();
    await expect(
      surface.getByText("Default admin cannot be deleted.").locator("..")
    ).toHaveAttribute("title", "Default admin cannot be deleted.");
    await expect(
      surface.getByText(member.password, { exact: true })
    ).toHaveCount(0);
    expect(await stored(page, "users")).toEqual([member, manager]);
    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click();
    for (const label of ["Display Name", "Username", "Password", "Role"]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveAttribute(
        "aria-invalid",
        "true"
      );
    }
    await page.getByLabel("Display Name").fill(" New Manager ");
    await page.getByLabel("Username", { exact: true }).fill(" AdMiN ");
    await page
      .getByLabel("Password", { exact: true })
      .fill(" synthetic-password ");
    await page.getByLabel("Role", { exact: true }).selectOption("admin");
    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click();
    await expect(
      page.getByText("Username admin is reserved.", { exact: true })
    ).toBeVisible();
    await page.getByLabel("Username", { exact: true }).fill(" STORY-WRITER ");
    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click();
    await expect(
      page.getByText("Username is already taken.", { exact: true })
    ).toBeVisible();
    expect(await stored(page, "users")).toEqual([member, manager]);
    await page.getByLabel("Username", { exact: true }).fill("new-manager");
    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Account created.");
    const created = (await stored(page, "users"))[2];
    expect(created).toMatchObject({
      displayName: "New Manager",
      username: "new-manager",
      password: " synthetic-password ",
      role: "admin",
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    await expect(
      surface.getByText(created.password, { exact: true })
    ).toHaveCount(0);
    await page.reload();
    await expect(
      surface.getByText("new-manager", { exact: true })
    ).toBeVisible();
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.dismiss();
    });
    await surface
      .getByRole("button", { name: "Delete new-manager", exact: true })
      .click();
    expect(await stored(page, "users")).toEqual([member, manager, created]);
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });
    await surface
      .getByRole("button", { name: "Delete new-manager", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Account deleted.");
    expect(await stored(page, "users")).toEqual([member, manager]);
    expect((await stored(page, "session")).userId).toBe(manager.id);
    expect(await stored(page, "posts")).toEqual(posts);
    await page.reload();
    await expect(surface.getByText("new-manager", { exact: true })).toHaveCount(
      0
    );
    await page.getByRole("link", { name: "Back to Admin Dashboard" }).click();
    await expect(
      page.getByText("Total Admins", { exact: true }).locator("..")
    ).toContainText("2");
  });
}

test("Admin write failures and stale targets report errors rather than false success", async ({
  page,
}) => {
  await page.goto("/login");
  await seed(page);
  await login(page);
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException("Unavailable", "QuotaExceededError");
    };
  });
  page.once("dialog", async (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete Oversight 6", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  expect(await stored(page, "posts")).toEqual(posts);
  await page.getByRole("link", { name: "Manage Users" }).click();
  await page.getByLabel("Display Name").fill("Failed account");
  await page.getByLabel("Username", { exact: true }).fill("failed-account");
  await page.getByLabel("Password", { exact: true }).fill("synthetic");
  await page.getByLabel("Role", { exact: true }).selectOption("user");
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(await stored(page, "users")).toEqual([member, manager]);
  page.once("dialog", async (dialog) => dialog.accept());
  await page
    .getByRole("table")
    .getByRole("button", { name: `Delete ${member.username}`, exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(await stored(page, "users")).toEqual([member, manager]);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalSetItem;
    localStorage.setItem("writespace_users", "[]");
  });
  await page
    .getByRole("table")
    .getByRole("button", { name: `Delete ${member.username}`, exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("no longer exists");
  expect(await stored(page, "users")).toEqual([]);
});
