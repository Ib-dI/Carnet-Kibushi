import { describe, it, expect } from "vitest";
import { authErrorText } from "./login.js";

describe("authErrorText", () => {
  it("explains the per-address delay between two codes", () => {
    const t = authErrorText({ status: 429, message: "For security purposes, you can only request this after 37 seconds." });
    expect(t).toMatch(/Un code vient déjà de partir/);
    expect(t).toMatch(/37 secondes/);
  });

  it("never says 0 seconds", () => {
    expect(authErrorText({ status: 429, message: "you can only request this after 0 seconds." })).toMatch(/1 seconde\./);
  });

  it("falls back to the hourly limit message", () => {
    expect(authErrorText({ status: 429, message: "email rate limit exceeded" })).toMatch(/Trop d'e-mails/);
  });

  it("refused addresses and network errors", () => {
    expect(authErrorText({ status: 403 })).toMatch(/pas accès au carnet/);
    expect(authErrorText({ status: 500 })).toMatch(/Vérifie ta connexion/);
  });
});
