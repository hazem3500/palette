import { button, el } from "./dom.js";
import { imageDataUrl } from "./snapshot.js";

type Point = { x: number; y: number };
type Tool = "pen" | "arrow" | "rectangle" | "highlight";
type Mark = {
  tool: Tool;
  color: string;
  points: [Point, ...Point[]];
};
export type ImageMarkup = { source: string; marks: Mark[] };

const tools: [Tool, string][] = [
  ["pen", "Pen"], ["arrow", "Arrow"], ["rectangle", "Rectangle"], ["highlight", "Highlight"],
];
const colors = [
  ["Red", "#fa5252"], ["Yellow", "#ffd43b"], ["Blue", "#4dabf7"], ["Green", "#51cf66"],
] as const;

function paint(ctx: CanvasRenderingContext2D, mark: Mark, weight: number) {
  const { points: [start, ...rest], tool, color } = mark;
  const end = rest.at(-1) ?? start;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = weight;
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.beginPath();
  if (tool === "rectangle") {
    const width = Math.abs(end.x - start.x), height = Math.abs(end.y - start.y);
    ctx.roundRect(Math.min(start.x, end.x), Math.min(start.y, end.y), width, height, Math.min(weight, width / 2, height / 2));
    ctx.stroke();
  } else if (tool === "arrow") {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const size = Math.min(4.5 * weight, Math.hypot(end.x - start.x, end.y - start.y) * 0.6);
    const base = { x: end.x - size * Math.cos(angle), y: end.y - size * Math.sin(angle) };
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(base.x, base.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    for (const side of [-1, 1])
      ctx.lineTo(base.x + side * size * 0.42 * Math.sin(angle), base.y - side * size * 0.42 * Math.cos(angle));
    ctx.closePath();
    ctx.fill();
  } else {
    if (tool === "highlight") {
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = weight * 5;
    }
    ctx.moveTo(start.x, start.y);
    if (rest.length) {
      for (let index = 0; index < rest.length - 1; index++) {
        const point = rest[index]!, next = rest[index + 1]!;
        ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
      }
      ctx.lineTo(end.x, end.y);
    } else ctx.lineTo(start.x + 0.1, start.y);
    ctx.stroke();
  }
  ctx.restore();
}

const styles = `
.palette-snapshot-viewer.palette-markup{box-sizing:border-box;width:min(1040px,calc(100vw - 32px));padding:0;background:#1b1b1d;color:#f4f4f5}
.palette-markup header{padding:10px 14px;margin:0;border-bottom:1px solid #ffffff14}
.palette-markup h2{font-size:14px;padding:0}
.palette-markup .palette-markup-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:2px 14px 4px}
.palette-markup-tools,.palette-markup-colors,.palette-markup-history{display:flex;align-items:center;gap:3px}
.palette-markup-tools{background:#ffffff0a;border:1px solid #ffffff0d;border-radius:9px;padding:2px}
.palette-markup .palette-markup-control{border:0;border-radius:6px;background:transparent;color:#d4d4d8;padding:0 9px;min-height:34px;font:inherit;cursor:pointer}
.palette-markup .palette-markup-control[aria-pressed=true]{background:#ffffff1a;color:#fff}
.palette-markup .palette-markup-control:disabled{opacity:.36;cursor:default}
.palette-markup .palette-markup-control:focus-visible,.palette-markup-swatch:focus-visible{outline:2px solid var(--accent,#bda6ef);outline-offset:2px}
.palette-markup-swatch{display:grid;place-items:center;width:30px;height:34px;padding:0;background:none;border:0;border-radius:6px;cursor:pointer}
.palette-markup-swatch::before{content:"";width:13px;height:13px;border-radius:50%;background:var(--swatch)}
.palette-markup-swatch[aria-pressed=true]::before{outline:1px solid currentColor;outline-offset:3px}
.palette-markup .palette-markup-done{background:#e6dcfb;color:#26212e;font-weight:600}
.palette-markup .palette-markup-history{margin-left:auto}
.palette-markup-stage{display:grid;place-items:center;min-width:0;padding:20px;overflow:hidden;background:#101012;border-block-start:1px solid #ffffff12}
.palette-markup-stage canvas{display:block;max-width:100%;height:auto;border-radius:4px;touch-action:none;cursor:crosshair}
.palette-markup-stage canvas[data-tool=highlight]{cursor:cell}
.palette-markup-status:not(:empty){margin:0;padding:0 14px 10px;color:#fda4af}
@media(hover:hover){.palette-markup .palette-markup-control:enabled:hover{background:#ffffff19;color:#fff}.palette-markup .palette-markup-done:enabled:hover{background:#f0e9ff;color:#26212e}}
@media(pointer:coarse){.palette-markup .palette-markup-control,.palette-markup-swatch{min-height:44px}.palette-markup-swatch{width:44px}}
@media(max-width:520px){.palette-snapshot-viewer.palette-markup{width:calc(100vw - 16px);max-width:calc(100vw - 16px)}.palette-markup header,.palette-markup .palette-markup-toolbar{padding-inline:10px}.palette-markup .palette-markup-history{margin-left:0}.palette-markup-stage{padding:12px}}
`;

export async function annotateImage(
  root: ShadowRoot,
  src: string,
  limit: number,
  previousMarkup: ImageMarkup | undefined,
  signal: AbortSignal,
  save: (src: string, markup: ImageMarkup) => void,
) {
  if (root.querySelector(".palette-markup[open]")) return;
  const source = previousMarkup?.source ?? src;
  const image = new Image();
  image.src = source;
  await image.decode();
  if (signal.aborted || !root.host.isConnected || root.querySelector(".palette-markup[open]")) return;

  const previous = root.activeElement as HTMLElement | null;
  const dialog = el("dialog", "palette-snapshot-viewer palette-markup");
  dialog.setAttribute("aria-label", "Image preview");
  const sheet = el("style", "", styles);
  const header = el("header");
  const toolbar = el("div", "palette-markup-toolbar");
  toolbar.setAttribute("aria-label", "Image annotation tools");
  toolbar.setAttribute("role", "toolbar");
  const toolGroup = el("div", "palette-markup-tools");
  const swatches = el("div", "palette-markup-colors");
  const history = el("div", "palette-markup-history");
  const stage = el("div", "palette-markup-stage");
  const canvas = el("canvas");
  canvas.setAttribute("aria-label", "Image with annotations");
  canvas.setAttribute("role", "img");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.style.width = `min(100%, calc(max(60px, 100dvh - 220px) * ${canvas.width / canvas.height}))`;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  const marks = [...previousMarkup?.marks ?? []];
  const undone: Mark[] = [];
  let tool: Tool = "pen";
  let color: string = colors[0][1];
  let pointer: number | null = null;
  let active: Mark | null = null;
  let drawing = 0;
  let saving = false;
  const weight = Math.max(2, canvas.width / 180);

  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    for (const item of marks) paint(context, item, weight);
    if (active) paint(context, active, weight);
  };
  const redraw = () => {
    drawing ||= requestAnimationFrame(() => {
      drawing = 0;
      draw();
    });
  };
  const point = (event: PointerEvent): Point => {
    const box = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - box.left) * canvas.width / box.width)),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - box.top) * canvas.height / box.height)),
    };
  };
  const toolButtons = tools.map(([kind, label]) => button(label, () => {
    tool = kind;
    if (kind === "highlight") color = colors[1][1];
    sync();
  }, "palette-markup-control"));
  const colorButtons = colors.map(([label, value]) => {
    const swatch = button(label, () => { color = value; sync(); }, "palette-markup-swatch");
    swatch.textContent = "";
    swatch.style.setProperty("--swatch", value);
    return swatch;
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || pointer !== null || saving) return;
    canvas.setPointerCapture(event.pointerId);
    pointer = event.pointerId;
    active = { tool, color, points: [point(event)] };
    sync();
    redraw();
  });
  const extend = (event: PointerEvent) => {
    if (!active) return;
    const next = point(event);
    if (active.tool === "arrow" || active.tool === "rectangle") active.points[1] = next;
    else active.points.push(next);
  };
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer) return;
    extend(event);
    redraw();
  });
  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointer || !active) return;
    extend(event);
    marks.push(active);
    undone.length = 0;
    active = null;
    pointer = null;
    sync();
    redraw();
  });
  const cancelStroke = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    active = null;
    sync();
    redraw();
  };
  canvas.addEventListener("pointercancel", cancelStroke);
  canvas.addEventListener("lostpointercapture", cancelStroke);

  const undo = button("Undo", () => {
    const mark = marks.pop();
    if (mark) undone.push(mark);
    sync();
    redraw();
  }, "palette-markup-control");
  const redo = button("Redo", () => {
    const mark = undone.pop();
    if (mark) marks.push(mark);
    sync();
    redraw();
  }, "palette-markup-control");
  const status = el("p", "palette-markup-status");
  status.setAttribute("role", "status");
  const done = button("Done", () => {
    if (active || saving) return;
    const original = previousMarkup?.marks ?? [];
    if (marks.length === original.length && marks.every((mark, index) => mark === original[index])) {
      dialog.close();
      return;
    }
    saving = true;
    sync();
    draw();
    void imageDataUrl(canvas, { x: 0, y: 0, width: canvas.width, height: canvas.height }, limit)
      .then((result) => {
        if (!dialog.open) return;
        dialog.close();
        save(result, { source, marks });
      }, () => {
        status.textContent = "Could not save the image.";
        saving = false;
        sync();
      });
  }, "palette-markup-control palette-markup-done");

  function sync() {
    canvas.dataset.tool = tool;
    toolButtons.forEach((node, index) => node.setAttribute("aria-pressed", String(tool === tools[index]![0])));
    colorButtons.forEach((node, index) => node.setAttribute("aria-pressed", String(color === colors[index]![1])));
    undo.disabled = !marks.length || !!active || saving;
    redo.disabled = !undone.length || !!active || saving;
    done.disabled = !!active || saving;
  }
  toolGroup.append(...toolButtons);
  swatches.append(...colorButtons);
  history.append(undo, redo);
  toolbar.append(toolGroup, swatches, history);
  const close = button("Close image preview", () => dialog.close(), "icon", "close");
  header.append(el("h2", "", "Image preview"), done, close);
  stage.append(canvas);
  dialog.append(sheet, header, toolbar, stage, status);
  const listeners = new AbortController();
  window.addEventListener("keydown", (event) => {
    if (!dialog.open) return;
    const key = event.key.toLowerCase();
    const historyKey = (event.metaKey || event.ctrlKey) && (key === "z" || key === "y");
    if (key === "escape" || historyKey) {
      event.preventDefault();
      if (key === "escape") dialog.close();
      else (key === "y" || event.shiftKey ? redo : undo).click();
    }
    event.stopImmediatePropagation();
  }, { capture: true, signal: listeners.signal });
  const closeOnDestroy = () => {
    listeners.abort();
    dialog.close();
  };
  signal.addEventListener("abort", closeOnDestroy, { once: true });
  dialog.addEventListener("close", () => {
    signal.removeEventListener("abort", closeOnDestroy);
    listeners.abort();
    cancelAnimationFrame(drawing);
    dialog.remove();
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }, { once: true });
  root.append(dialog);
  sync();
  draw();
  dialog.showModal();
}
