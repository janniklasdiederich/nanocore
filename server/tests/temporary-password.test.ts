import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type RequestApi = (path: string, method: string, body?: object, cookie?: string) => Promise<Response>;

async function withServer(run: (request: RequestApi, origin: string) => Promise<void>) {
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
    await run(request, origin);
  } finally {
    server.kill();
    await server.exited;
    rmSync(dataDir, { recursive: true, force: true });
  }
}

function session(response: Response) {
  const cookie = response.headers.get("Set-Cookie")?.split(";")[0];
  expect(cookie).toBeTruthy();
  return cookie!;
}

test("replacing a temporary password cannot overwrite a personal password", () =>
  withServer(async (request) => {
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
  }), 20_000);

test("admin reset and self-service password changes revoke prior access", () =>
  withServer(async (request, origin) => {
    const email = "admin@example.test";
    const original = "admin-original-password";
    const setup = await request("/setup", "POST", { orgName: "Test", email, password: original });
    const oldAdmin = session(setup);
    const { user: actor } = await setup.json();
    const change = (cookie: string, currentPassword: string, newPassword: string) =>
      request("/auth/change-password", "POST", { currentPassword, newPassword }, cookie);
    const admin = session(await change(oldAdmin, original, "admin-updated-password"));
    expect((await request("/users", "GET", undefined, oldAdmin)).status).toBe(401);

    const memberEmail = "member@example.test";
    const initial = "initial-test-password";
    const personal = "personal-test-password";
    const temporary = "temporary-after-reset";
    const newPersonal = "new-personal-password";
    const login = (password: string) =>
      request("/auth/login", "POST", { email: memberEmail, password });
    const created = await request("/users", "POST", { email: memberEmail, password: initial }, admin);
    const { user: member } = await created.json();
    const memberSession = session(await change(session(await login(initial)), initial, personal));
    const reset = (id: string, cookie: string) =>
      request(`/users/${id}/temporary-password`, "PUT", { password: temporary, mode: "reset" }, cookie);
    expect((await reset(actor.id, memberSession)).status).toBe(403);
    expect((await reset(actor.id, admin)).status).toBe(400);

    const boardResult = await request("/kanban", "POST", { name: "Team" }, admin);
    const { board } = await boardResult.json();
    await request(`/kanban/${board.id}/members`, "PUT", { userIds: [member.id] }, admin);
    const ticket = await request(`/kanban/${board.id}/sync-token`, "POST", undefined, memberSession);
    const { token } = await ticket.json();
    const room = new URL(`/api/kanban-sync/${board.id}`, origin);
    room.protocol = "ws:";
    room.searchParams.set("sessionId", crypto.randomUUID());
    room.searchParams.set("token", token);
    const ws = new WebSocket(room.href);
    await new Promise<void>((resolve, reject) => {
      ws.onmessage = () => resolve();
      ws.onerror = () => reject(new Error("Could not join the test room"));
    });
    const closed = new Promise<number>((resolve) => { ws.onclose = (e) => resolve(e.code); });
    expect((await reset(member.id, admin)).status).toBe(200);
    expect(await closed).toBe(4403);
    expect((await request("/kanban", "GET", undefined, memberSession)).status).toBe(401);
    expect((await login(personal)).status).toBe(401);
    const pending = await login(temporary);
    const pendingSession = session(pending);
    expect((await pending.json()).user.mustChangePassword).toBe(true);
    expect((await request("/kanban", "GET", undefined, pendingSession)).status).toBe(403);
    expect((await reset(member.id, admin)).status).toBe(409);
    const restored = session(await change(pendingSession, temporary, newPersonal));
    expect((await request("/kanban", "GET", undefined, restored)).status).toBe(200);
    expect((await login(temporary)).status).toBe(401);
    expect((await login(newPersonal)).status).toBe(200);

    // A pre-reset ticket stays invalid even after the user chooses a personal password.
    const oldTicket = new WebSocket(room.href);
    const opened = await new Promise<boolean>((resolve) => {
      oldTicket.onopen = () => { oldTicket.close(); resolve(true); };
      oldTicket.onerror = () => resolve(false);
    });
    expect(opened).toBe(false);
  }), 20_000);
