export function reviewLayer(host: HTMLElement, signal: AbortSignal) {
  const document = host.ownerDocument;
  const canPromote = typeof host.showPopover === "function";
  const supportsModal = typeof CSS !== "undefined" && CSS.supports?.("selector(:modal)");
  const sync = () => {
    const modal = supportsModal ? [...document.querySelectorAll("dialog:modal")].at(-1) : undefined;
    const popover = canPromote && [...(modal ?? document).querySelectorAll("[popover]:popover-open")]
      .reverse().find((layer) => layer !== host);
    const parent = popover || modal || document.body;
    if (host.parentElement === parent && (!canPromote || !!host.getAttribute("popover") === (parent !== document.body))) return;

    // Native dialogs make siblings inert. Keeping Palette inside the app's layer
    // also lets native light dismissal recognise a comment as inside the popover.
    host.removeAttribute("popover");
    parent.append(host);
    if (canPromote && parent !== document.body) {
      host.popover = "manual";
      host.showPopover();
    }
  };
  const layerChanged = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && target !== host && target.matches("dialog,[popover]")) sync();
  };
  document.addEventListener("toggle", layerChanged, { capture: true, signal });
  document.addEventListener("close", layerChanged, { capture: true, signal });
  sync();
  return sync;
}
