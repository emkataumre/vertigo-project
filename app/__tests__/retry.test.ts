/**
 * @jest-environment node
 */
import { withRetry } from "../lib/retry";

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("withRetry", () => {
  it("returns the result immediately when the first attempt succeeds", async () => {
    const fn = jest.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, "test");

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not log on first-attempt success", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await withRetry(fn, "test");

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("retries after failure and returns result on second attempt", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce("ok");
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const promise = withRetry(fn, "test", { delayMs: 1000 });
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[test] Attempt 1/2 failed, retrying in 1000ms:"),
      expect.any(Error)
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[test] Succeeded on retry (attempt 2/2)")
    );
    warnSpy.mockRestore();
  });

  it("throws the final error when all attempts fail", async () => {
    const error = new Error("permanent");
    const fn = jest.fn().mockRejectedValue(error);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const promise = withRetry(fn, "test", { delayMs: 1000 });
    promise.catch(() => {}); // prevent unhandled rejection warning while timers run
    await jest.runAllTimersAsync();

    await expect(promise).rejects.toBe(error); // preserves exact error identity
    expect(fn).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it("does not retry when attempts is 1", async () => {
    const error = new Error("fail");
    const fn = jest.fn().mockRejectedValue(error);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(withRetry(fn, "test", { attempts: 1 })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled(); // no retry warning when nothing to retry
    warnSpy.mockRestore();
  });

  it("does not log a warning on the final failed attempt", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const promise = withRetry(fn, "test", { delayMs: 1000 });
    promise.catch(() => {}); // prevent unhandled rejection warning while timers run
    await jest.runAllTimersAsync();
    await promise.catch(() => {});

    // warn only for non-final failures — 1 warning for attempt 1, none for attempt 2
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("waits delayMs between attempts", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const promise = withRetry(fn, "test", { delayMs: 500 });

    // After first failure, fn called once — delay hasn't elapsed yet
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance by less than the delay — retry must not have fired
    await jest.advanceTimersByTimeAsync(499);
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance past the delay — retry fires
    await jest.advanceTimersByTimeAsync(1);
    await promise;
    expect(fn).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });

  it("respects custom attempts count", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const promise = withRetry(fn, "test", { attempts: 3, delayMs: 100 });
    promise.catch(() => {}); // prevent unhandled rejection warning while timers run
    await jest.runAllTimersAsync();
    await promise.catch(() => {});

    expect(fn).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledTimes(2); // warn for attempts 1 and 2, not 3
    warnSpy.mockRestore();
  });
});
