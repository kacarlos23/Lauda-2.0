import { GenericContainer, StartedTestContainer } from "testcontainers";
import { RedisRateLimitStore } from "../../security/rateLimitStore";

describe("RedisRateLimitStore", () => {
  let container: StartedTestContainer;
  let first: RedisRateLimitStore;
  let second: RedisRateLimitStore;

  beforeAll(async () => {
    container = await new GenericContainer("redis:7.4-alpine")
      .withExposedPorts(6379)
      .start();
    const url = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
    first = new RedisRateLimitStore(url);
    second = new RedisRateLimitStore(url);
  }, 120_000);

  afterAll(async () => {
    await Promise.all([first?.close(), second?.close()]);
    await container?.stop();
  });

  it("shares atomic counters across independent application instances", async () => {
    const key = `rl:test:${Date.now()}`;

    await expect(first.consume(key, 30_000)).resolves.toMatchObject({ count: 1 });
    await expect(second.consume(key, 30_000)).resolves.toMatchObject({ count: 2 });
    await expect(first.consume(`${key}:other`, 30_000)).resolves.toMatchObject({ count: 1 });
  });
});
