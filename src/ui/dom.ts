export type Child = Node | string | number | null | undefined | false | Child[];
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') (el as any)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}
export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}
export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

let toastTimer: number | undefined;
export function toast(msg: string, ms = 2600) {
  let t = document.querySelector('.toast') as HTMLElement | null;
  if (!t) { t = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { if (t) t.style.display = 'none'; }, ms);
}

export function seg<T extends string | number>(options: { v: T; label: string }[], value: T, onChange: (v: T) => void, aria?: string) {
  const wrap = h('div', { class: 'seg-ctl', role: 'radiogroup', 'aria-label': aria });
  const render = (cur: T) => {
    wrap.innerHTML = '';
    for (const o of options) wrap.appendChild(h('button', { class: o.v === cur ? 'on' : '', role: 'radio', 'aria-checked': String(o.v === cur), onclick: () => { onChange(o.v); render(o.v); } }, o.label));
  };
  render(value);
  return wrap;
}
export function toggle(label: string, value: boolean, onChange: (v: boolean) => void) {
  const inp = h('input', { type: 'checkbox', checked: value, onchange: () => onChange(inp.checked) });
  return h('label', { class: 'toggle' }, inp, label);
}
export function slider(label: string, min: number, max: number, step: number, value: number, fmt: (v: number) => string, onInput: (v: number) => void, onChange?: (v: number) => void) {
  const out = h('output', {}, fmt(value));
  const inp = h('input', { type: 'range', min, max, step, value, 'aria-label': label, 'aria-valuetext': fmt(value) });
  inp.addEventListener('input', () => { const v = Number(inp.value); out.textContent = fmt(v); inp.setAttribute('aria-valuetext', fmt(v)); onInput(v); });
  if (onChange) inp.addEventListener('change', () => onChange(Number(inp.value)));
  const row = h('div', { class: 'knobrow' }, h('span', {}, label), inp, out);
  (row as any).set = (v: number) => { inp.value = String(v); out.textContent = fmt(v); inp.setAttribute('aria-valuetext', fmt(v)); };
  return row as unknown as HTMLElement & { set(v: number): void };
}
