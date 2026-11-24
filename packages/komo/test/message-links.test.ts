// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { appendMessageLinks, appendRichComment } from "../src/message-links.js";

describe("comment message links", () => {
  const render = (text: string) => {
    const element = document.createElement("p");
    appendMessageLinks(element, text);
    return element;
  };

  it("autolinks bare URLs and retains adjacent punctuation", () => {
    const element = render(
      "See https://example.com/a(b), then http://example.org!",
    );
    expect([...element.querySelectorAll("a")].map((link) => link.href)).toEqual(
      ["https://example.com/a(b)", "http://example.org/"],
    );
    expect(element.textContent).toBe(
      "See https://example.com/a(b), then http://example.org!",
    );
  });

  it("supports simple Markdown links and escapes label text", () => {
    const element = render("[<roadmap>](https://example.com/roadmap)");
    expect(element.querySelector("a")?.textContent).toBe("<roadmap>");
    expect(element.querySelector("a")?.rel).toBe("noopener noreferrer");
    expect(element.querySelector("a")?.target).toBe("_blank");
    expect(element.children).toHaveLength(1);
  });

  it("does not link credentials or non-HTTP schemes", () => {
    const element = render("https://user:pass@example.com javascript:alert(1)");
    expect(element.querySelectorAll("a")).toHaveLength(0);
    expect(element.textContent).toBe(
      "https://user:pass@example.com javascript:alert(1)",
    );
  });
});

it("renders formatting and code without interpreting HTML or code as links", () => {
  const node = document.createElement("div");
  appendRichComment(node, "**Review** *this* \`https://example.test\` [page](https://example.test) <img>\n\`\`\`ts\nconst safe = '<script>';\n\`\`\`");
  expect(node.querySelector("strong")?.textContent).toBe("Review");
  expect(node.querySelector("em")?.textContent).toBe("this");
  expect(node.querySelector("code")?.textContent).toBe("https://example.test");
  expect(node.querySelectorAll("a")).toHaveLength(1);
  expect(node.querySelector("pre code")?.textContent).toBe("const safe = '<script>';");
  expect(node.querySelector("img,script")).toBeNull();
});
