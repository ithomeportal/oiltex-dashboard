import { describe, expect, it } from "vitest";
import { clientIp } from "../request-ip";

const req = (headers: Record<string, string>) => new Request("https://index.oiltex.com/api/auth/send-code", { headers });

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry (the real client on Vercel)", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  it("returns null when unknown so callers skip the per-IP limit", () => {
    expect(clientIp(req({}))).toBeNull();
  });

  it("caps length to the column size", () => {
    expect(clientIp(req({ "x-forwarded-for": "x".repeat(200) }))?.length).toBe(64);
  });
});
