import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("admins can replace a temporary password only until the user chooses their own", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "nanocore-password-test-"));
  const server = Bun.spawn([process.execPath, "--no-env-file", join(import.meta.dir, "../src/index.ts")], {
    env: { ...process.env, NODE_ENV: "test", DATA_DIR: dataDir, HOST: "127.0.0.1", PORT: "0" },
    stdout: "pipe",
    stderr: "inherit",
  });

  try {
    const output = server.stdout.pipeThrough(new TextDecoderStream()).getReader();
    let startup = "";
    let origin: string | undefined;
    while (!origin) {
      const chunk = await output.read();
      if (chunk.done) throw new Error("Test server exited before listening");
      startup += chunk.value;
      origin = startup.match(/Nanocore listening on (http:\/\/127\.0\.0\.1:\d+)\r?\n/)?.[1];
    }
    output.releaseLock();

    function request(path: string, method: string, body?: object, cookie?: string) {
      return fetch(origin + "/api" + path, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
        body: body && JSON.stringify(body),
      });
    }
    function session(response: Response) {
      const cookie = response.headers.get("Set-Cookie")?.split(";")[0];
      expect(cookie).toBeTruthy();
      return cookie!;
    }

    const admin = session(await request("/setup", "POST", {
      orgName: "Test", email: "admin@example.test", password: "admin-test-password",
    }));
    const email = "member@example.test";
    const initial = "initial-test-password";
    const replacement = "replacement-test-password";
    const personal = "personal-test-password";
    const created = await request("/users", "POST", { email, password: initial }, admin);
    expect(created.status).toBe(201);
    const { user } = await created.json();
    const login = (password: string) => request("/auth/login", "POST", { email, password });
    const replace = (password: string, cookie?: string) =>
      request(`/users/${user.id}/temporary-password`, "PUT", { password }, cookie);

    const initialSession = session(await login(initial));
    expect((await replace(replacement)).status).toBe(401);
    expect((await replace(replacement, initialSession)).status).toBe(403);
    expect((await replace("short", admin)).status).toBe(400);
    expect((await replace(replacement, admin)).status).toBe(200);
    expect((await login(initial)).status).toBe(401);
    const oldSession = await request("/auth/me", "GET", undefined, initialSession);
    expect((await oldSession.json()).user).toBeNull();

    const newLogin = await login(replacement);
    const replacementSession = session(newLogin);
    expect((await newLogin.json()).user.mustChangePassword).toBe(true);
    const reused = await request("/auth/change-password", "POST", {
      currentPassword: replacement, newPassword: replacement,
    }, replacementSession);
    expect(reused.status).toBe(400);
    expect((await reused.json()).code).toBe("TEMPORARY_PASSWORD_REUSED");
    const changed = await request("/auth/change-password", "POST", {
      currentPassword: replacement, newPassword: personal,
    }, replacementSession);
    expect(changed.status).toBe(200);
    expect((await changed.json()).user.mustChangePassword).toBe(false);
    expect((await replace(initial, admin)).status).toBe(409);
    expect((await login(replacement)).status).toBe(401);
    expect((await login(personal)).status).toBe(200);
  } finally {
    server.kill();
    await server.exited;
    rmSync(dataDir, { recursive: true, force: true });
  }
}, 20_000);
