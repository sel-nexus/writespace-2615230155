/** Verify cross-feature foundation and capture preflight evidence before final E2E. */
import { test, expect } from "./fixtures.js";

const records = [0, 1, 2].map((index) => ({
  id: `foundation-${index}`,
  title: `Foundation entry ${index}`,
  content: "Synthetic local text",
  authorId: "foundation-writer",
  authorName: "Foundation Writer",
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
  expect(
    requests.get(page),
    "No accidental service or data transmission"
  ).toEqual([]);
});

/** Navigate via an actual responsive navbar link, never a second goto. */
async function nav(page, name) {
  const toggle = page.getByRole("button", { name: "Open menu", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .getByRole("navigation", { name: "Account navigation" })
    .getByRole("link", { name, exact: true })
    .click();
}
/** Login with actual form controls and canonical fixed credentials. */
async function adminLogin(page) {
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Login", exact: true }).click();
}
/** Log out through the account dropdown, opening mobile navigation when needed. */
async function logout(page, name) {
  const toggle = page.getByRole("button", { name: "Open menu", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
}
/** Read durable records independently of rendered state. */
async function stored(page, key) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(`writespace_${key}`)),
    key
  );
}
/** Attach source-review evidence, not subjective screenshot assertions.
 * Args: page, testInfo, state: live browser, test attachment sink and state name.
 * Returns: Nothing; attach accessibility, computed styles, rendered HTML and PNG.
 * Notes: Playwright 1.48.2 supplies accessibility.snapshot; no async loading exists.
 */
async function capture(page, testInfo, state) {
  await page.evaluate(() => document.fonts.ready);
  const accessibility = await page.accessibility.snapshot();
  const styles = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    const main = document.querySelector("main");
    const heading = document.querySelector("h1");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      body: {
        fontFamily: body.fontFamily,
        fontSize: body.fontSize,
        color: body.color,
        backgroundColor: body.backgroundColor,
        lineHeight: body.lineHeight,
      },
      root: { backgroundColor: root.backgroundColor, color: root.color },
      main: main
        ? {
            display: getComputedStyle(main).display,
            width: getComputedStyle(main).width,
          }
        : null,
      heading: heading
        ? {
            fontFamily: getComputedStyle(heading).fontFamily,
            fontSize: getComputedStyle(heading).fontSize,
          }
        : null,
    };
  });
  await testInfo.attach(`${state}-accessibility`, {
    body: JSON.stringify(accessibility, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach(`${state}-computed-styles`, {
    body: JSON.stringify(styles, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach(`${state}-html`, {
    body: await page.content(),
    contentType: "text/html",
  });
  await testInfo.attach(`${state}-screenshot`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  expect(styles.body.fontFamily).toContain("DM Sans");
  expect(styles.heading.fontFamily).toContain("Lora");
  expect(accessibility).not.toBeNull();
}

for (const width of [390, 1024]) {
  test(`preflight ${
    width < 640 ? "mobile" : "desktop"
  } empty/populated/editor/Admin/account source-review states`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Your thoughts."
    );
    await capture(page, testInfo, "landing-empty");
    if (width < 640) {
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Close menu", exact: true })
      ).toHaveAttribute("aria-expanded", "true");
      await capture(page, testInfo, "mobile-open-navigation");
      await page
        .getByRole("link", { name: "Login", exact: true })
        .first()
        .click();
    } else {
      await page
        .getByRole("link", { name: "Login", exact: true })
        .first()
        .click();
    }
    await capture(page, testInfo, "account-login");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Invalid username or password."
    );
    await capture(page, testInfo, "account-error");
    await adminLogin(page);
    await expect(
      page.getByRole("heading", { name: "Admin Dashboard" })
    ).toBeVisible();
    await capture(page, testInfo, "Admin-empty");
    await page.getByRole("link", { name: "Manage Users" }).click();
    await capture(page, testInfo, "account-empty");
    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click();
    await capture(page, testInfo, "account-validation");
    await page.getByLabel("Display Name").fill("Preflight Writer");
    await page.getByLabel("Username", { exact: true }).fill("preflight-writer");
    await page.getByLabel("Password", { exact: true }).fill("synthetic");
    await page.getByLabel("Role", { exact: true }).selectOption("user");
    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Account created.");
    await capture(page, testInfo, "account-populated");
    await nav(page, "Write");
    await expect(page.getByLabel("Content", { exact: true })).toHaveValue("");
    await capture(page, testInfo, "editor-empty");
    await page.getByLabel("Title", { exact: true }).fill("Preflight writing");
    await page
      .getByLabel("Content", { exact: true })
      .fill("Synthetic preflight\nplain text");
    await capture(page, testInfo, "editor-populated");
    await page.getByRole("button", { name: "Publish Post" }).click();
    await expect(
      page.getByRole("heading", { name: "Preflight writing" })
    ).toBeVisible();
    await capture(page, testInfo, "detail-populated");
    await nav(page, "All Blogs");
    await capture(page, testInfo, "blogs-populated");
    await nav(page, "Users");
    await page.getByRole("link", { name: "Back to Admin Dashboard" }).click();
    await capture(page, testInfo, "Admin-populated");
    await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
    await capture(page, testInfo, "landing-populated");
  });
}

for (const width of [390, 768, 1024]) {
  test(`foundation ${width} responsive nav, focus, palette, grids and account layouts`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await page.evaluate(
      (posts) =>
        localStorage.setItem("writespace_posts", JSON.stringify(posts)),
      records
    );
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      return {
        name: element.textContent,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    expect(focused.name).toContain("Skip to content");
    expect(focused.outlineStyle).not.toBe("none");
    expect(parseFloat(focused.outlineWidth)).toBeGreaterThan(0);
    await adminLogin(page);
    expect(
      await page
        .locator(".admin-banner")
        .evaluate((element) => getComputedStyle(element).backgroundImage)
    ).toContain("linear-gradient");
    await nav(page, "All Blogs");
    const columns = await page
      .locator(".recent-grid")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length
      );
    expect(columns).toBe(width < 768 ? 1 : width < 1024 ? 2 : 3);
    const toggle = page.getByRole("button", { name: "Open menu", exact: true });
    if (width < 640) {
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(
        page.getByRole("link", { name: "Users", exact: true })
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    } else {
      await expect(toggle).toBeHidden();
    }
    await nav(page, "Users");
    if (width < 640) {
      await expect(page.locator(".users-table-wrap")).toBeHidden();
      await expect(page.locator(".user-cards")).toBeVisible();
    } else {
      await expect(page.locator(".users-table-wrap")).toBeVisible();
      await expect(page.locator(".user-cards")).toBeHidden();
    }
    await nav(page, "Write");
    const actions = await page
      .locator(".editor-actions")
      .evaluate((element) => getComputedStyle(element).flexDirection);
    expect(actions).toBe(width < 768 ? "column" : "row");
    const started = Date.now();
    await nav(page, "All Blogs");
    await expect(
      page.getByRole("heading", { name: "All Blogs", exact: true })
    ).toBeVisible();
    await testInfo.attach("route-navigation-baseline", {
      body: JSON.stringify({
        width,
        elapsedMs: Date.now() - started,
        note: "Local baseline only; no invented SLA or deployed AWS claim.",
      }),
      contentType: "application/json",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  });
}

test("registration → writing → Admin account/post oversight → reload keeps cross-feature records consistent", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Display Name").fill("Foundation Writer");
  await page.getByLabel("Username", { exact: true }).fill("foundation-writer");
  await page.getByLabel("Password", { exact: true }).fill("synthetic");
  await page.getByLabel("Confirm Password", { exact: true }).fill("synthetic");
  await page.getByRole("button", { name: "Create Account" }).click();
  const registered = (await stored(page, "users"))[0];
  expect(registered.role).toBe("user");
  await nav(page, "Write");
  await page.getByLabel("Title", { exact: true }).fill("Cross-feature writing");
  await page
    .getByLabel("Content", { exact: true })
    .fill("  Synthetic\nlocal writing ");
  await page.getByRole("button", { name: "Publish Post" }).click();
  const created = (await stored(page, "posts"))[0];
  expect(created).toMatchObject({
    authorId: registered.id,
    authorName: registered.displayName,
    content: "  Synthetic\nlocal writing ",
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: created.title })
  ).toBeVisible();
  await logout(page, "Foundation Writer");
  expect(await stored(page, "session")).toBeNull();
  expect(await stored(page, "posts")).toEqual([created]);
  await page.getByRole("link", { name: "Login", exact: true }).first().click();
  await adminLogin(page);
  await expect(
    page.getByText("Total Posts", { exact: true }).locator("..")
  ).toContainText("1");
  await expect(
    page.getByText("Total Users", { exact: true }).locator("..")
  ).toContainText("2");
  await page
    .getByRole("link", { name: `Edit ${created.title}`, exact: true })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Admin-reviewed writing");
  await page.getByRole("button", { name: "Save Changes" }).click();
  const revised = { ...created, title: "Admin-reviewed writing" };
  expect(await stored(page, "posts")).toEqual([revised]);
  await nav(page, "Users");
  await expect(
    page.getByRole("table").getByText(registered.username, { exact: true })
  ).toBeVisible();
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await page
    .getByRole("table")
    .getByRole("button", { name: `Delete ${registered.username}`, exact: true })
    .click();
  expect(await stored(page, "users")).toEqual([]);
  expect(await stored(page, "posts")).toEqual([revised]);
  await page.reload();
  await page.getByRole("link", { name: "Back to Admin Dashboard" }).click();
  await expect(
    page.getByText("Total Users", { exact: true }).locator("..")
  ).toContainText("1");
  await page.getByRole("link", { name: revised.title, exact: true }).click();
  await expect(page.locator(".post-content")).toHaveText(revised.content);
  page.once("dialog", async (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Post", exact: true }).click();
  expect(await stored(page, "posts")).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "No posts yet" })
  ).toBeVisible();
});

for (const raw of ["{broken", "{}", "null", "[null,1,{}]"]) {
  test(`corrupt collection reads ${raw} remain safe, empty and do not rewrite source`, async ({
    page,
  }) => {
    await page.goto("/login");
    await page.evaluate((raw) => {
      localStorage.setItem("writespace_users", raw);
      localStorage.setItem("writespace_posts", raw);
    }, raw);
    await adminLogin(page);
    await expect(
      page.getByRole("heading", { name: "No posts yet" })
    ).toBeVisible();
    await page.getByRole("link", { name: "Manage Users" }).click();
    await expect(page.getByText(/No managed accounts yet/)).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("writespace_users"))
    ).toBe(raw);
    await nav(page, "All Blogs");
    await expect(
      page.getByRole("heading", { name: "No posts yet" })
    ).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("writespace_posts"))
    ).toBe(raw);
  });
}

test("unavailable collection reads render empty; unavailable session read fails closed", async ({
  page,
}) => {
  await page.goto("/login");
  await adminLogin(page);
  await page.evaluate(() => {
    window.originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key !== "writespace_session")
        throw new DOMException("Unavailable", "SecurityError");
      return window.originalGetItem.call(this, key);
    };
  });
  await page.getByRole("link", { name: "Manage Users" }).click();
  await expect(page.getByText(/No managed accounts yet/)).toBeVisible();
  await page.getByRole("link", { name: "Back to Admin Dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "No posts yet" })
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.getItem = window.originalGetItem;
  });
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () {
      throw new DOMException("Unavailable", "SecurityError");
    };
  });
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Login", exact: true })
  ).toBeVisible();
});

for (const sessionValue of [
  "{broken",
  "{}",
  "[]",
  '{"userId":"x","username":"x","displayName":"X","role":"Admin"}',
]) {
  test(`corrupt session ${sessionValue} fails closed on Admin refresh`, async ({
    page,
  }) => {
    await page.goto("/login");
    await adminLogin(page);
    await page.evaluate(
      (value) => localStorage.setItem("writespace_session", value),
      sessionValue
    );
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Login", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Account", exact: true })
    ).toHaveCount(0);
  });
}
