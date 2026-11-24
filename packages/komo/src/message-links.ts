/** Append safe HTTP(S) links while leaving all unmatched text as text nodes. */
export function appendMessageLinks(element: HTMLElement, text: string): void {
  // Markdown links are deliberately limited to a single-line label and URL.
  const pattern =
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>]+/gi;
  let offset = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset)
      element.append(document.createTextNode(text.slice(offset, index)));

    const markdown = match[1] !== undefined;
    const rawUrl = markdown ? match[2] : match[0];
    const { url, trailing } = trimUrlPunctuation(rawUrl);
    const safe = safeHttpUrl(url);
    if (safe) {
      if (markdown) {
        const link = document.createElement("a");
        link.href = safe;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = match[1];
        element.append(link);
      } else {
        const link = document.createElement("a");
        link.href = safe;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = url;
        element.append(link);
      }
      if (trailing) element.append(document.createTextNode(trailing));
    } else {
      element.append(document.createTextNode(match[0]));
    }
    offset = index + match[0].length;
  }

  if (offset < text.length)
    element.append(document.createTextNode(text.slice(offset)));
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function trimUrlPunctuation(value: string): { url: string; trailing: string } {
  let end = value.length;
  while (end > 0 && /[.,!?;:]$/.test(value.slice(0, end))) end--;
  for (const [open, close] of [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ] as const) {
    while (end > 0 && value[end - 1] === close) {
      const segment = value.slice(0, end);
      const opens = [...segment].filter((char) => char === open).length;
      const closes = [...segment].filter((char) => char === close).length;
      if (closes <= opens) break;
      end--;
    }
  }
  return { url: value.slice(0, end), trailing: value.slice(end) };
}

/** Render a small Markdown subset with DOM nodes, including code without linkifying it. */
export function appendRichComment(element: HTMLElement, text: string): void {
  const inline = (value: string) => {
    const pattern = /\x60([^\x60\n]+)\x60|\*\*([^*\n]+)\*\*|(?<![\w*])\*([^*\n]+)\*(?![\w*])|\[([^\]\n]+)\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>]+/gi;
    let offset = 0;
    for (const match of value.matchAll(pattern)) {
      const index = match.index!;
      element.append(document.createTextNode(value.slice(offset, index)));
      const [token, code, strong, emphasis] = match;
      if (code || strong || emphasis) {
        const styled = document.createElement(code ? "code" : strong ? "strong" : "em");
        if (code) styled.textContent = code;
        else appendMessageLinks(styled, strong ?? emphasis);
        element.append(styled);
      } else appendMessageLinks(element, token);
      offset = index + token.length;
    }
    element.append(document.createTextNode(value.slice(offset)));
  };

  const fences = /^\x60{3}[\w-]*[ \t]*\r?\n([\s\S]*?)^\x60{3}[ \t]*$/gm;
  let offset = 0;
  for (const match of text.matchAll(fences)) {
    inline(text.slice(offset, match.index));
    const block = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = match[1].replace(/\r?\n$/, "");
    block.append(code);
    element.append(block);
    offset = match.index! + match[0].length;
  }
  inline(text.slice(offset));
}
