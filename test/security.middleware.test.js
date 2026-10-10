import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const protect = jest.fn();
const withRule = jest.fn(() => ({ protect }));
const arcjetClient = { withRule };
const logError = jest.fn();
const logWarn = jest.fn();
const slidingWindow = jest.fn((rule) => rule);

jest.unstable_mockModule("#config/arcjet.js", () => ({
  default: arcjetClient,
}));
jest.unstable_mockModule("#config/logger.js", () => ({
  logger: { error: logError, warn: logWarn },
}));
jest.unstable_mockModule("@arcjet/node", () => ({
  slidingWindow,
}));

const { default: securityMiddleware } =
  await import("../src/middleware/security.middleware.js");

const createRequest = (role = undefined) => ({
  get: jest.fn(() => "test-agent"),
  ip: "127.0.0.1",
  path: "/test",
  method: "GET",
  user: role ? { role } : undefined,
});

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const allowed = () => ({
  isDenied: () => false,
  reason: {},
});

const deniedFor = (reasonName) => ({
  isDenied: () => true,
  reason: {
    isBot: () => reasonName === "bot",
    isShield: () => reasonName === "shield",
    isRateLimit: () => reasonName === "rateLimit",
  },
});

describe("security middleware", () => {
  beforeEach(() => {
    protect.mockReset().mockResolvedValue(allowed());
    withRule.mockClear();
    slidingWindow.mockClear();
    logError.mockClear();
    logWarn.mockClear();
  });

  test.each([
    ["guest", undefined, 5],
    ["user", "user", 10],
    ["admin", "admin", 20],
  ])("applies the %s rate limit", async (name, role, max) => {
    const req = createRequest(role);
    const res = createResponse();
    const next = jest.fn();

    await securityMiddleware(req, res, next);

    expect(slidingWindow).toHaveBeenCalledWith(
      expect.objectContaining({ max, interval: 1, mode: "LIVE" })
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test.each([
    ["bot", "Access denied: Bot detected"],
    ["shield", "Access denied: Shield detected"],
    ["rateLimit", "Access denied: Rate limit exceeded"],
  ])("rejects Arcjet %s decisions", async (reasonName, message) => {
    protect.mockResolvedValue(deniedFor(reasonName));
    const req = createRequest("user");
    const res = createResponse();
    const next = jest.fn();

    await securityMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message });
    expect(next).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  test("forwards Arcjet failures to centralized error handling", async () => {
    const error = new Error("Arcjet unavailable");
    protect.mockRejectedValue(error);
    const res = createResponse();
    const next = jest.fn();

    await securityMiddleware(createRequest(), res, next);

    expect(logError).toHaveBeenCalledWith("Security middleware failed", {
      error,
    });
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
