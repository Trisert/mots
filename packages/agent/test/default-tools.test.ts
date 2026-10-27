import { describe, expect, test } from "bun:test";
import { createMotsHarnessOptions } from "../src/chat.ts";
import { DEFAULT_TOOL_NAMES } from "../src/default-tools.ts";
import { createStubModels } from "../src/stub-models.ts";

describe("default tools", () => {
  test("the list stored on new conversations is the list chat offers", async () => {
    const options = await createMotsHarnessOptions(async () => {}, { models: createStubModels() });
    const offered = (options.settings?.extensions ?? []).flatMap((extension) =>
      typeof extension === "string" ? [] : (extension.tools ?? []).map((tool) => tool.name),
    );
    expect([...offered].sort()).toEqual([...DEFAULT_TOOL_NAMES].sort());
  });
});
