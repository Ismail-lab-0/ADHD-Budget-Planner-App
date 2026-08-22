// A tiny DOM-building helper — not a component framework, just removes
// repetitive createElement/appendChild boilerplate. See
// docs/ARCHITECTURE.md §2 ("no framework ... small hand-written helper
// utilities for rendering if repetitive patterns emerge").

/**
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {(Node|string|null|Array<Node|string|null>)} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    // These must go through setAttribute, never a direct property
    // assignment: aria-*/data-*/role have no IDL property at all, and
    // `list` (an <input>'s associated <datalist>) is a *read-only* IDL
    // property that reflects the resolved element, not the attribute
    // string — `node.list = 'someId'` throws a TypeError in strict-mode
    // ES modules (which this codebase always runs as) in at least Safari,
    // silently doing nothing everywhere else. A Node-based DOM shim can't
    // catch this class of bug: it doesn't model real getter-only IDL
    // semantics, only a real browser does — found via manual QA, not
    // automated testing (see git history).
    else if (key.startsWith('aria-') || key.startsWith('data-') || key === 'role' || key === 'list') node.setAttribute(key, value);
    else node[key] = value;
  }

  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}
