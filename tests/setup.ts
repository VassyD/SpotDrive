import { vi } from "vitest";

if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom");

  // Mock window.Notification for push notification tests
  global.Notification = {
    permission: "default",
    requestPermission: vi.fn().mockResolvedValue("granted"),
  } as unknown as typeof Notification;

  // Mock window.history for email confirmation tests
  Object.defineProperty(window, "history", {
    value: { replaceState: vi.fn() },
    writable: true,
  });
}

// Silence console.error in tests unless it's a real failure
const originalError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning:") || args[0].includes("act("))
    ) return;
    originalError(...args);
  };
});
afterEach(() => {
  console.error = originalError;
});