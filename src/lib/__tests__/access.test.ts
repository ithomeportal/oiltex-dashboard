import { describe, expect, it } from "vitest";
import { isSenerPath, isSuperAdmin, scopeForEmail } from "../access";

describe("scopeForEmail", () => {
  it("gives company tenant domains full internal access", () => {
    expect(scopeForEmail("someone@oiltex.com")).toBe("internal");
    expect(scopeForEmail("ops@unilinkportal.com")).toBe("internal");
  });

  it("scopes the external legal-counsel domain to SENER only", () => {
    expect(scopeForEmail("dpineda@nhq.com.mx")).toBe("sener");
    expect(scopeForEmail("DPineda@NHQ.com.mx")).toBe("sener");
  });

  it("rejects every other domain, including look-alikes", () => {
    expect(scopeForEmail("someone@gmail.com")).toBeNull();
    expect(scopeForEmail("x@tisinsurance.net")).toBeNull();
    expect(scopeForEmail("x@evil-nhq.com.mx")).toBeNull();
    expect(scopeForEmail("x@nhq.com.mx.evil.com")).toBeNull();
    expect(scopeForEmail("no-at-sign")).toBeNull();
  });
});

describe("isSenerPath", () => {
  it.each(["/sener", "/sener/documents", "/api/sener/workspace", "/api/sener/files/abc", "/api/uploadthing", "/api/auth/session"])(
    "allows %s for SENER-scoped sessions",
    (path) => expect(isSenerPath(path)).toBe(true)
  );

  it.each(["/", "/argus-pricing", "/api/argus-pricing/profit", "/api/prices", "/ops-inventory/tickets", "/senerx", "/api/senerx"])(
    "blocks %s for SENER-scoped sessions",
    (path) => expect(isSenerPath(path)).toBe(false)
  );
});

describe("isSuperAdmin", () => {
  it("is case-insensitive and exact", () => {
    expect(isSuperAdmin("ITHOME@unilinkportal.com")).toBe(true);
    expect(isSuperAdmin("dpineda@nhq.com.mx")).toBe(false);
  });
});
