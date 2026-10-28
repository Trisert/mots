import { describe, expect, test } from "bun:test";
import {
  InvalidClientCommand,
  MAX_IMAGE_BASE64_CHARACTERS,
  MAX_PROMPT_IMAGES,
  parseClientCommand,
} from "../src/index.ts";

const image = { mimeType: "image/jpeg" as const, data: "/9j/4AAQSkZJRg==" };

const submit = (fields: Record<string, unknown>) =>
  JSON.stringify({ type: "prompt.submit", requestId: "req-img", conversationId: 1, ...fields });

describe("prompt.submit with images", () => {
  test("keeps the attached pictures on a valid command", () => {
    expect(parseClientCommand(submit({ content: "Cosa vedi?", images: [image] }))).toEqual({
      type: "prompt.submit",
      requestId: "req-img",
      conversationId: 1,
      content: "Cosa vedi?",
      images: [image],
    });
  });

  test("a picture may be sent without text", () => {
    expect(parseClientCommand(submit({ content: "", images: [image] }))).toMatchObject({
      type: "prompt.submit",
      content: "",
      images: [image],
    });
  });

  test("text is still required when no picture is attached", () => {
    expect(() => parseClientCommand(submit({ content: " " }))).toThrow(InvalidClientCommand);
    expect(() => parseClientCommand(submit({ content: "", images: [] }))).toThrow(
      InvalidClientCommand,
    );
  });

  test("a command without images stays exactly as before", () => {
    expect(parseClientCommand(submit({ content: "Ciao" }))).toEqual({
      type: "prompt.submit",
      requestId: "req-img",
      conversationId: 1,
      content: "Ciao",
    });
  });

  test("refuses a picture type the model layer does not accept", () => {
    expect(() =>
      parseClientCommand(submit({ content: "x", images: [{ ...image, mimeType: "image/gif" }] })),
    ).toThrow(InvalidClientCommand);
    expect(() =>
      parseClientCommand(submit({ content: "x", images: [{ ...image, mimeType: "text/plain" }] })),
    ).toThrow(InvalidClientCommand);
  });

  test("refuses data that is not base64 or is too large", () => {
    expect(() =>
      parseClientCommand(submit({ content: "x", images: [{ ...image, data: "data:image/jpeg;base64,AAAA" }] })),
    ).toThrow(InvalidClientCommand);
    expect(() =>
      parseClientCommand(
        submit({
          content: "x",
          images: [{ ...image, data: "A".repeat(MAX_IMAGE_BASE64_CHARACTERS + 1) }],
        }),
      ),
    ).toThrow(InvalidClientCommand);
  });

  test("caps the number of pictures per message", () => {
    const images = Array.from({ length: MAX_PROMPT_IMAGES + 1 }, () => image);
    expect(() => parseClientCommand(submit({ content: "x", images }))).toThrow(
      InvalidClientCommand,
    );
    expect(() => parseClientCommand(submit({ content: "x", images: "nope" }))).toThrow(
      InvalidClientCommand,
    );
  });
});
