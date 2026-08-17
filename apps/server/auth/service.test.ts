import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { resolveUserByIdentifier } from "./service.js";
import type { User } from "../db/users.js";

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    username: "aziz",
    email: "isanaziz34@gmail.com",
    passwordHash: "unused",
    emailVerified: true,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("resolveUserByIdentifier", () => {
  it("resolves by username first", async () => {
    const user = fakeUser();
    const result = await resolveUserByIdentifier(
      "aziz",
      async () => user,
      async () => {
        throw new Error("email lookup should not run");
      },
    );
    assert.equal(result, user);
  });

  it("falls back to email when username is not found", async () => {
    const user = fakeUser();
    let queried = "";
    const result = await resolveUserByIdentifier(
      "isanaziz34@gmail.com",
      async () => null,
      async (email) => {
        queried = email;
        return user;
      },
    );
    assert.equal(result, user);
    assert.equal(queried, "isanaziz34@gmail.com");
  });

  it("lowercases the email before lookup", async () => {
    const user = fakeUser();
    let queried = "";
    await resolveUserByIdentifier(
      "IsanAziz34@Gmail.com",
      async () => null,
      async (email) => {
        queried = email;
        return user;
      },
    );
    assert.equal(queried, "isanaziz34@gmail.com");
  });

  it("trims surrounding whitespace", async () => {
    const user = fakeUser();
    let queried = "";
    await resolveUserByIdentifier(
      "  aziz  ",
      async (username) => {
        queried = username;
        return user;
      },
      async () => null,
    );
    assert.equal(queried, "aziz");
  });

  it("returns null when neither username nor email matches", async () => {
    const result = await resolveUserByIdentifier(
      "nobody",
      async () => null,
      async () => null,
    );
    assert.equal(result, null);
  });
});
