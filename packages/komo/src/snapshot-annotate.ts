import { button, el } from "./dom.js";
import { imageDataUrl } from "./snapshot.js";

type Point = { x: number; y: number };

export async function annotateImage(
  root: ShadowRoot,
  src: string,
  limit: number,
  save: (src: string) => void,
) {
  const image = new Image();
  image.src = src;
  await image.decode();
  if (!root.host.isConnected) return;

  const previous = root.activeElement as HTMLElement | null;
  const dialog = el("dialog", "palette-snapshot-viewer");
  dialog.setAttribute("aria-label", "Annotate image");
  const header = el("header");
  const tools = el("div", "row");
  const canvas = el("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.style.cssText =
    `display:block;max-width:100%;width:min(${canvas.width}px,calc((100dvh - 150px) * ${canvas.width / canvas.height}));height:auto;margin:auto;touch-action:none;cursor:crosshair`;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  const strokes: Point[][] = [];
  let pointer: number | null = null;
  let active: Point[] | null = null;

  context.strokeStyle = "#f04444";
  context.lineWidth = Math.max(2, canvas.width / 180);
  context.lineCap = context.lineJoin = "round";
  const line = (from: Point, to: Point) => {
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  };
  const redraw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    for (const stroke of strokes) {
      for (let index = 1; index < stroke.length; index++)
        line(stroke[index - 1]!, stroke[index]!);
    }
  };
  const point = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) * canvas.width / box.width, y: (event.clientY - box.top) * canvas.height / box.height };
  };
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || pointer !== null) return;
    canvas.setPointerCapture(event.pointerId);
    pointer = event.pointerId;
    const start = point(event);
    active = [start, { x: start.x + 0.1, y: start.y }];
    line(active[0]!, active[1]!);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer || !active) return;
    const next = point(event);
    line(active.at(-1)!, next);
    active.push(next);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointer || !active) return;
    const end = point(event);
    line(active.at(-1)!, end);
    active.push(end);
    strokes.push(active);
    active = null;
    pointer = null;
    undo.disabled = apply.disabled = false;
  });
  const cancelStroke = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    active = null;
    pointer = null;
    redraw();
  };
  canvas.addEventListener("pointercancel", cancelStroke);
  canvas.addEventListener("lostpointercapture", cancelStroke);
  const undo = button("Undo stroke", () => {
    strokes.pop();
    undo.disabled = apply.disabled = !strokes.length;
    redraw();
  }, "secondary");
  const status = el("p");
  status.setAttribute("role", "status");
  const apply = button("Save annotation", () => {
    apply.disabled = undo.disabled = true;
    void imageDataUrl(canvas, { x: 0, y: 0, width: canvas.width, height: canvas.height }, limit)
      .then((result) => {
        if (!dialog.isConnected) return;
        dialog.close();
        save(result);
      }, () => {
        status.textContent = "Could not save the annotation.";
        apply.disabled = undo.disabled = false;
      });
  }, "primary");
  undo.disabled = apply.disabled = true;
  const cancel = button("Cancel", () => dialog.close(), "secondary");
  tools.append(undo, cancel, apply);
  header.append(el("h2", "", "Annotate image"), tools);
  dialog.append(header, canvas, status);
  const listeners = new AbortController();
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dialog.close();
  }, { capture: true, signal: listeners.signal });
  dialog.addEventListener("close", () => {
    listeners.abort();
    dialog.remove();
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }, { once: true });
  root.append(dialog);
  dialog.showModal();
  redraw();
}
