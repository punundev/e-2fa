import { describe, it, expect } from "vitest";
import { mergeAccounts } from "../src/lib/sync-engine";
import { AuthenticatorAccount } from "../src/types";

describe("Sync Engine - Account Merging", () => {
  const baseAccount: AuthenticatorAccount = {
    id: "acc-1",
    issuer: "GitHub",
    name: "user@example.com",
    secret: "JBSWY3DPEHPK3PXP",
    type: "totp",
    algorithm: "SHA-1",
    digits: 6,
    period: 30,
    counter: 0,
    createdAt: 1000,
    updatedAt: 1000,
  };

  it("adds remote accounts that do not exist locally", () => {
    const local: AuthenticatorAccount[] = [baseAccount];
    const remote: AuthenticatorAccount[] = [
      {
        ...baseAccount,
        id: "acc-2",
        issuer: "Google",
      },
    ];

    const merged = mergeAccounts(local, remote);
    expect(merged.length).toBe(2);
    expect(merged.map((a) => a.id).sort()).toEqual(["acc-1", "acc-2"]);
  });

  it("keeps local copy if local copy has newer updatedAt", () => {
    const local: AuthenticatorAccount[] = [
      {
        ...baseAccount,
        name: "updated-locally@example.com",
        updatedAt: 2000,
      },
    ];
    const remote: AuthenticatorAccount[] = [
      {
        ...baseAccount,
        name: "older-remote@example.com",
        updatedAt: 1500,
      },
    ];

    const merged = mergeAccounts(local, remote);
    expect(merged.length).toBe(1);
    expect(merged[0].name).toBe("updated-locally@example.com");
  });

  it("updates local copy if remote copy has newer updatedAt", () => {
    const local: AuthenticatorAccount[] = [
      {
        ...baseAccount,
        name: "older-local@example.com",
        updatedAt: 1000,
      },
    ];
    const remote: AuthenticatorAccount[] = [
      {
        ...baseAccount,
        name: "newer-remote@example.com",
        updatedAt: 5000,
      },
    ];

    const merged = mergeAccounts(local, remote);
    expect(merged.length).toBe(1);
    expect(merged[0].name).toBe("newer-remote@example.com");
  });
});
