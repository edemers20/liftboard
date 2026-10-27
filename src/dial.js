/* Scroll-wheel number picker in a bottom sheet. Replaces keyboard typing for numeric inputs.
   attachDials(root, cfgFor) makes every input cfgFor() returns a config for read-only and opens the
   wheel on tap / Enter / Space. Picking writes the value and fires input + change, so existing
   handlers run unchanged. Config: {label, min, max, step, unit, optional, start} */
const ITEM = 40;
let host = null, active = null;

function fmt(v, step) {
  const dec = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  return dec ? String(+v.toFixed(dec)) : String(Math.round(v));
}
function values(c) {
  const out = c.optional ? [null] : [];
  const n = Math.round((c.max - c.min) / c.step);
  for (let i = 0; i <= n; i++) out.push(+(c.min + i * c.step).toFixed(4));
  return out;
}
function ensureHost() {
  if (host) return host;
  host = document.createElement("div");
  host.id = "dial"; host.hidden = true;
  document.body.appendChild(host);
  return host;
}
export function closeDial(commit) {
  if (!active) return;
  const { el, vals, wheel, c } = active;
  if (commit) {
    const i = Math.max(0, Math.min(vals.length - 1, Math.round(wheel.scrollTop / ITEM)));
    const v = vals[i];
    el.value = v == null ? "" : fmt(v, c.step);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const h = host, target = el;
  active = null;
  h.classList.add("out");
  setTimeout(() => { h.hidden = true; h.innerHTML = ""; h.classList.remove("out"); }, 200);
  if (!commit) target.focus({ preventScroll: true });
}
export function openDial(el, c) {
  const h = ensureHost(), vals = values(c);
  const cur = parseFloat(el.value), start = isFinite(cur) ? cur : (isFinite(parseFloat(c.start)) ? parseFloat(c.start) : null);
  let idx = 0;
  if (start != null) { let best = Infinity; vals.forEach((v, i) => { if (v != null && Math.abs(v - start) < best) { best = Math.abs(v - start); idx = i; } }); }
  else if (c.optional) idx = 0;
  const u = c.unit ? `<small>${c.unit}</small>` : "";
  h.innerHTML = `<div class="ddim" data-cancel></div>
    <section class="dialsheet" role="dialog" aria-modal="true" aria-label="${c.label}">
      <div class="dtop"><span class="plab">${c.label}</span><button type="button" class="dx" data-cancel aria-label="Cancel"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
      <div class="wheelwrap"><div class="wband" aria-hidden="true"></div>
        <div class="wheel" tabindex="0" role="listbox" aria-label="${c.label}">
          <div class="wpad"></div>${vals.map((v, i) => `<div class="wi" role="option" data-i="${i}">${v == null ? "None" : fmt(v, c.step)}${v == null ? "" : u}</div>`).join("")}<div class="wpad"></div>
        </div></div>
      <button type="button" class="shbtn wide" data-done>Done</button>
    </section>`;
  h.hidden = false; h.classList.remove("out");
  const wheel = h.querySelector(".wheel"), items = [...h.querySelectorAll(".wi")];
  active = { el, vals, wheel, c };
  let raf = 0;
  const mark = () => { const i = Math.round(wheel.scrollTop / ITEM); items.forEach((x, j) => { const on = j === i; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); };
  wheel.scrollTop = idx * ITEM; mark();
  wheel.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(mark); }, { passive: true });
  items.forEach((x, j) => x.onclick = () => wheel.scrollTo({ top: j * ITEM, behavior: "smooth" }));
  wheel.onkeydown = e => {
    const i = Math.round(wheel.scrollTop / ITEM);
    const go = j => { e.preventDefault(); wheel.scrollTo({ top: Math.max(0, Math.min(vals.length - 1, j)) * ITEM, behavior: "smooth" }); };
    if (e.key === "ArrowDown") go(i + 1); else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "PageDown") go(i + 5); else if (e.key === "PageUp") go(i - 5);
    else if (e.key === "Enter") { e.preventDefault(); closeDial(true); }
  };
  h.querySelectorAll("[data-cancel]").forEach(b => b.onclick = () => closeDial(false));
  h.querySelector("[data-done]").onclick = () => closeDial(true);
  wheel.focus({ preventScroll: true });
}
export function attachDials(root, cfgFor) {
  root.querySelectorAll("input").forEach(el => {
    const c = cfgFor(el); if (!c) return;
    el.readOnly = true; el.setAttribute("inputmode", "none"); el.classList.add("dialin");
    el.setAttribute("aria-haspopup", "dialog");
    const open = e => { e.preventDefault(); openDial(el, c); };
    el.addEventListener("click", open);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") open(e); });
  });
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && active) { e.stopPropagation(); closeDial(false); } }, true);
