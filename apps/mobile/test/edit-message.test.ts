import { describe, expect, test } from "bun:test";
import { branchEntryId, messageBody } from "../src/edit-message.ts";

describe("messageBody", () => {
  test("drops the attribution line the server adds to a prompt", () => {
    expect(messageBody("[Luca]\nCiao Mots")).toBe("Ciao Mots");
  });

  test("keeps text that has no attribution line", () => {
    expect(messageBody("Ciao Mots")).toBe("Ciao Mots");
  });
});

describe("branchEntryId", () => {
  const entries = [{ id: 10 }, { id: 11 }, { id: 12 }];

  test("branches from the entry just before the edited message", () => {
    expect(branchEntryId(entries, 12)).toBe(11);
  });

  test("the first message has no branch point, so the branch starts empty", () => {
    expect(branchEntryId(entries, 10)).toBeUndefined();
  });

  test("an entry that is not listed has no branch point", () => {
    expect(branchEntryId(entries, 99)).toBeUndefined();
  });
});
