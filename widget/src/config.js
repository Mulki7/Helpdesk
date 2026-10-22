/**
 * src/config.js
 * Reads widget configuration from the <script> tag's data attributes.
 *
 * IMPORTANT: This is executed synchronously during script evaluation,
 * before any async operation, so document.currentScript is still valid.
 *
 * Supported attributes on <script src="/widget.js">:
 *   data-server  — backend origin (default: origin of widget.js itself)
 *   data-title   — panel header title (default: "Hubungi Kami")
 *   data-color   — primary accent colour (default: "#2563eb")
 */

// Capture currentScript immediately — it becomes null after the script finishes loading
const _script = document.currentScript;

function deriveServer(scriptEl) {
  if (!scriptEl) return window.location.origin;

  const attr = scriptEl.getAttribute('data-server');
  if (attr && attr.trim() !== '') return attr.trim().replace(/\/$/, '');

  // Derive from the script's own src URL
  try {
    const url = new URL(scriptEl.src, window.location.href);
    return url.origin;
  } catch {
    return window.location.origin;
  }
}

export const config = Object.freeze({
  server: deriveServer(_script),
  title: (_script && _script.getAttribute('data-title')) || 'Hubungi Kami',
  color: (_script && _script.getAttribute('data-color')) || '#2563eb',
});
