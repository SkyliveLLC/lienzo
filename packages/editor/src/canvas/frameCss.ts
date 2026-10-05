/**
 * Editor-only rules layered over `lienzo.css` inside the canvas iframe. They
 * change behavior, never looks: links and embeds go inert, sticky navbars
 * and parallax images stay in place, and empty media show what to do.
 */
export const frameCss = `
html,body{margin:0}
body{overflow:hidden}
.lz-el{cursor:default;user-select:none;-webkit-user-select:none}
.lz-el[contenteditable]{cursor:text;user-select:text;-webkit-user-select:text;outline:none}
.lz-el iframe,.lz-el input,.lz-el select,.lz-el textarea,.lz-el summary,.lz-el a,.lz-el button{pointer-events:none}
.lz-navbar[data-sticky]{position:absolute;translate:none;left:calc(var(--x) * 1%);top:calc(var(--y) * var(--u));width:calc(var(--w) * 1%)}
@container lz (max-width:640px){
.lz-frame:not([data-stack]) .lz-navbar[data-sticky]{left:calc(var(--mx) * 1%);top:calc(var(--my) * var(--u));width:calc(var(--mw) * 1%)}
.lz-frame[data-stack] .lz-navbar[data-sticky]{position:static;width:auto}
}
.lz-parallax>.lz-bg{position:absolute}
.lz-stack-nav button{cursor:pointer}
img.lz-el[src=""]::before,.lz-video:empty::before{position:absolute;inset:0;display:grid;place-items:center;padding:8px;text-align:center;border:1px dashed #94a3b8;border-radius:inherit;background:#f8fafc;color:#64748b;font:12px/1.3 system-ui,sans-serif}
img.lz-el[src=""]::before{content:var(--lze-empty-image)}
.lz-frame[data-stack] img.lz-el[src=""]{position:relative;min-height:120px}
.lz-video:empty::before{content:var(--lze-empty-video)}
.lze-app-placeholder{display:grid;place-items:center;height:100%;padding:8px;text-align:center;border:1px dashed #94a3b8;border-radius:inherit;background:#f8fafc;color:#64748b;font:12px/1.3 system-ui,sans-serif}
.lze-app-placeholder[data-status=loading]{animation:lze-pulse 1.2s ease-in-out infinite}
@keyframes lze-pulse{50%{opacity:.55}}
body[data-lze-modal] .lz-section,body[data-lze-modal] .lz-stack,body[data-lze-modal] .lz-notice{display:none}
body[data-lze-modal] dialog.lz-modal[data-lze-open]{display:block;position:static;margin:16px auto;max-height:none;overflow:visible;box-shadow:0 12px 40px rgba(15,23,42,.18)}
body[data-lze-modal] dialog.lz-modal[data-lze-open][data-size=full]{margin:0}
`;
