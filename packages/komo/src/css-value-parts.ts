/** Split only at top level, preserving quoted commas, escapes and CSS functions. */
export function cssParts(value: string, comma = false): string[] {
  const parts: string[] = [];
  let start = 0, depth = 0, quote = "", escaped = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (quote) { if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (!depth && (comma ? c === "," : /\s/.test(c))) {
      if (value.slice(start, i).trim()) parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (value.slice(start).trim()) parts.push(value.slice(start).trim());
  return parts;
}
/** The first family of a font-family stack, unquoted and unescaped: `"Acme, Display", serif` → `Acme, Display`. */
export function primaryFamily(value: string): string {
  const first = cssParts(value, true)[0];
  if (!first) return value;
  const quoted = /^(['"])([\s\S]*)\1$/.exec(first);
  return (quoted ? quoted[2] : first.replace(/\s+/g, " ")).replace(/\\(.)/g, "$1");
}

const generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-(serif|sans-serif|monospace|rounded)|math|emoji|fangsong)$/i;

/**
 * What the Typography field shows for a font-family: the primary family the
 * page renders with, whether it is a generic family, or that the authored
 * variable does not resolve. The exact stack stays the field's value and title.
 */
export function fontView(authored: string, computed: string, variable: (name: string) => string): { label: string; note: string; title: string } {
  const missing = [...authored.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)].find(match => !match[2] && !variable(match[1]).trim())?.[1];
  const first = cssParts(computed, true)[0] ?? "";
  const title = authored && authored !== computed ? `${authored} → ${computed}` : computed;
  if (missing) return { label: `${missing} unresolved`, note: "", title: `${authored} does not resolve; the text renders with ${computed}` };
  return { label: primaryFamily(computed), note: generic.test(first) ? "generic" : "", title };
}

export type FontParts = { style: string; weight: string; size: string; lineHeight: string; family: string };
const fontPattern = /^\s*((?:(?:italic|oblique|normal|small-caps|bold|bolder|lighter|[1-9]00)\s+)*)([+-]?(?:\d*\.)?\d+[a-z%]*)(?:\s*\/\s*((?:\d*\.)?\d+[a-z%]*|normal))?(?:\s+([\s\S]+?))?\s*$/i;
/** A `font` shorthand as style, weight, size, line height and family; a token may leave the family out. */
export function fontParts(value: string): FontParts | undefined {
  const match = fontPattern.exec(value);
  if (!match) return;
  const words = match[1].trim().split(/\s+/).filter(Boolean);
  return {
    style: words.filter(word => /^(italic|oblique|small-caps)$/i.test(word)).join(" "),
    weight: words.find(word => /^(bold|bolder|lighter|[1-9]00)$/i.test(word)) ?? "",
    size: match[2], lineHeight: match[3] ?? "", family: match[4] ?? "",
  };
}
export function fontValue(font: FontParts): string {
  return [font.style, font.weight, font.size + (font.lineHeight ? `/${font.lineHeight}` : ""), font.family].filter(Boolean).join(" ");
}
