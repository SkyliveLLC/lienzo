import { styleTable as t } from './style.ts';

/** `--name` for a style-table rule, so renaming a var in the table renames it here too. */
const v = (rule: { readonly var: string }) => `--${rule.var}`;
const g = t.gradient.group;
const sh = t.shadow_custom.group;
const an = t.animation.group;

const fade = (colorVar: string) => `color-mix(in srgb,var(${colorVar}) calc(var(${v(t.background_opacity)},1) * 100%),transparent)`;
const u = (value: string) => `calc(${value} * var(--u))`;

/**
 * `lienzo.css`: every visual rule of a rendered page, static bytes. Pages add
 * only theme variables and one `#e-<id>{--x:..}` block per element.
 *
 * Two CSS facts carry the design. An unset custom property makes the
 * declaration using it compute to `unset`, so a style key that was never set
 * emits nothing. A custom property built from an unset one is itself unset,
 * so `var(--_border, fallback)` falls back to a type's own default (the
 * divider's top rule) only when no border was chosen.
 *
 * Mobile is a container query on `.lz-page`, not a media query, so the
 * editor's 390px frame and a 390px phone take the same path.
 */
export const stylesheet = [
    '.lz-page,.lz-page *{box-sizing:border-box}',
    'html:has(.lz-page){scroll-behavior:smooth}',
    '@media (prefers-reduced-motion:reduce){html:has(.lz-page){scroll-behavior:auto}}',
    '.lz-page{margin:0;container:lz/inline-size;background:var(--background);color:var(--text);font-family:var(--font-body)}',
    '.lz-notice{position:fixed;z-index:99;top:16px;left:50%;transform:translateX(-50%);background:var(--primary);color:var(--background);padding:12px 20px;border-radius:var(--radius);box-shadow:0 12px 32px rgba(15,23,42,.2)}',

    '.lz-section{position:relative;width:100%;scroll-margin-top:calc(var(--sticky,0) * 1px);background:var(--sbg,transparent)}',
    '.lz-section[data-fill=linear]{background:linear-gradient(calc(var(--sga,135) * 1deg),var(--sg1),var(--sg2))}',
    '.lz-section[data-fill=radial]{background:radial-gradient(circle at 50% 50%,var(--sg1),var(--sg2))}',
    '.lz-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
    // Browsers paint an image's pseudo-elements only when it failed to load: a broken background shows nothing, like a failed CSS background.
    ".lz-bg::before{content:'';position:absolute;inset:0;background:var(--background)}",
    // Parallax: the image is fixed to the viewport and clipped to its own box, not the section's, so a fixed navbar in the section stays visible.
    '.lz-parallax{position:absolute;inset:0;clip-path:inset(0)}',
    '.lz-parallax>.lz-bg{position:fixed}',
    '.lz-overlay{position:absolute;inset:0;background:rgb(0 0 0 / calc(var(--ov) * 100%))}',
    `.lz-frame{position:relative;height:${u('var(--fh)')}}`,
    '.lz-section>.lz-frame{margin:0 auto;max-width:var(--max-width);container-type:inline-size;--u:calc(min(100cqw,var(--ref) * 1px) / var(--ref))}',

    '.lz-el{position:absolute;margin:0;display:block;overflow-wrap:break-word;'
        + `left:calc(var(--x) * 1%);top:${u('var(--y)')};width:calc(var(--w) * 1%);height:${u('var(--h)')};z-index:var(--z);`
        + `--_border:${u(`var(${v(t.border_width)})`)} solid var(${v(t.border_color)},var(--text));`
        + `--_fill:${fade(v(t.background))};`
        + `--_rot:rotate(calc(var(${v(t.rotate)}) * 1deg));`
        + `--_blur:blur(${u(`var(${v(t.blur)})`)});`
        + `--_p:${u(`var(${v(t.padding)})`)};`
        + `color:var(${v(t.color)});background:var(--_fill);-webkit-backdrop-filter:var(--_blur);backdrop-filter:var(--_blur);`
        + `font-family:var(--font-body);font-size:${u(`var(${v(t.size)})`)};font-weight:var(${v(t.weight)});line-height:var(${v(t.line_height)});`
        + `border:var(--_border,0);border-radius:${u(`var(${v(t.radius)})`)};padding:var(--_p,0);opacity:var(${v(t.opacity)});`
        + 'transform:var(--_rot,) var(--_flip,) var(--_anim,)}',
    `.lz-el[data-${t.font.attr}=heading]{font-family:var(--font-heading)}`,
    ...['left', 'center', 'right'].map((align) => `.lz-el[data-${t.align.attr}=${align}]{text-align:${align}}`),
    `.lz-el[data-${g.type.attr}=linear]{background:linear-gradient(calc(var(${v(g.angle)},135) * 1deg),${fade(v(g.from))},${fade(v(g.to))})}`,
    `.lz-el[data-${g.type.attr}=radial]{background:radial-gradient(circle at 50% 50%,${fade(v(g.from))},${fade(v(g.to))})}`,
    `.lz-el[data-${t.shadow.attr}=sm]{box-shadow:0 1px 2px rgba(15,23,42,.08)}`,
    `.lz-el[data-${t.shadow.attr}=md]{box-shadow:0 8px 24px rgba(15,23,42,.12)}`,
    `.lz-el[data-${t.shadow.attr}=lg]{box-shadow:0 24px 48px rgba(15,23,42,.18)}`,
    `.lz-el[data-${t.shadow.attr}=custom]{box-shadow:${u(`var(${v(sh.x)},0)`)} ${u(`var(${v(sh.y)},12)`)} ${u(`var(${v(sh.blur)},32)`)} ${u(`var(${v(sh.spread)},0)`)} `
        + `color-mix(in srgb,var(${v(sh.color)},var(--secondary)) calc(var(${v(sh.opacity)},.2) * 100%),transparent)}`,
    `.lz-el[data-${t.clip.attr}]:not([data-${t.overflow.attr}]),.lz-el[data-${t.overflow.attr}=hidden]{overflow:hidden}`,
    `.lz-el[data-${t.overflow.attr}=scroll-x]{overflow-x:auto;overflow-y:hidden}`,
    `.lz-el[data-${t.overflow.attr}=scroll-y]{overflow-y:auto;overflow-x:hidden}`,
    `.lz-el[data-${t.flip_x.attr}],.lz-el[data-${t.flip_y.attr}]{--_flip:scale(var(--_fx,1),var(--_fy,1))}`,
    `.lz-el[data-${t.flip_x.attr}]{--_fx:-1}`,
    `.lz-el[data-${t.flip_y.attr}]{--_fy:-1}`,
    `@container lz not (max-width:640px){.lz-el[data-${t.visible_on.attr}=mobile]{display:none}}`,
    `.lz-accent{color:var(${v(t.accent_color)})}`,
    '@media (prefers-reduced-motion:no-preference){'
        + `.lz-el[data-${an.type.attr}]{opacity:0;transition:opacity calc(var(${v(an.duration)},.7) * 1s) ease calc(var(${v(an.delay)},0) * 1s),`
        + `transform calc(var(${v(an.duration)},.7) * 1s) cubic-bezier(.22,.61,.36,1) calc(var(${v(an.delay)},0) * 1s)}`
        + `.lz-el[data-${an.type.attr}=up]{--_anim:translateY(28px)}`
        + `.lz-el[data-${an.type.attr}=down]{--_anim:translateY(-28px)}`
        + `.lz-el[data-${an.type.attr}=left]{--_anim:translateX(-32px)}`
        + `.lz-el[data-${an.type.attr}=right]{--_anim:translateX(32px)}`
        + `.lz-el[data-${an.type.attr}=zoom]{--_anim:scale(.94)}`
        + `.lz-el[data-${an.type.attr}].is-in{opacity:var(${v(t.opacity)},1);--_anim:initial}}`,
    `@media (scripting:none){.lz-el[data-${an.type.attr}]{opacity:var(${v(t.opacity)},1)!important;--_anim:initial!important}}`,
    `.lz-el[data-${t.hover.attr}]{transition:transform .25s ease,box-shadow .25s ease,opacity .25s ease}`,
    '@media (hover:hover){'
        + `.lz-el[data-${t.hover.attr}=lift]:hover{transform:var(--_rot,) var(--_flip,) translateY(${u('-6')});box-shadow:0 18px 40px rgba(15,23,42,.18)}`
        + `.lz-el[data-${t.hover.attr}=grow]:hover{transform:var(--_rot,) var(--_flip,) scale(1.04)}`
        + `.lz-el[data-${t.hover.attr}=fade]:hover{opacity:.82}}`,

    `img.lz-el{object-fit:cover}`,
    `img.lz-el[data-${t.object_fit.attr}=contain]{object-fit:contain}`,
    'a.lz-el,button.lz-el{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}',
    // Chrome's own button padding, kept when the document sets none.
    'button.lz-el{cursor:pointer;padding:var(--_p,1px 6px)}',
    '.lz-divider{border:var(--_border,none);border-top:var(--_border,1px solid currentColor)}',
    '.lz-video iframe{width:100%;height:100%;border:0;border-radius:inherit}',
    '.lz-el[data-shape=ellipse]{border-radius:50%}',
    '.lz-el[data-shape=triangle]{clip-path:polygon(50% 0,100% 100%,0 100%)}',
    '.lz-el[data-shape=blob]{border-radius:42% 58% 63% 37% / 43% 38% 62% 57%}',
    '.lz-el[data-shape=arch]{border-radius:50% 50% 0 0 / 65% 65% 0 0}',
    '.lz-el[data-shape=diagonal]{clip-path:polygon(0 0,100% 0,100% 72%,0 100%)}',
    `.lz-el[data-shape=dots]{background-image:radial-gradient(currentColor ${u('1.6')},transparent ${u('1.7')});background-size:${u('16')} ${u('16')}}`,
    `.lz-el[data-shape=grid]{background-image:linear-gradient(currentColor ${u('1')},transparent ${u('1')}),linear-gradient(90deg,currentColor ${u('1')},transparent ${u('1')});background-size:${u('24')} ${u('24')}}`,
    '.lz-icon{display:grid;place-items:center}',
    '.lz-icon svg{width:100%;height:100%}',

    `.lz-navbar{display:flex;align-items:center;gap:${u('24')}}`,
    '.lz-navbar[data-sticky]{position:fixed;left:50%;translate:-50% 0;width:min(100%,var(--max-width));top:0;transition:background .25s ease,box-shadow .25s ease,height .25s ease,backdrop-filter .25s ease}',
    '.lz-navbar[data-scrolled]{box-shadow:0 8px 24px rgba(15,23,42,.1)}',
    '.lz-navbar[data-scrolled][data-scroll]{box-shadow:0 10px 30px rgba(15,23,42,.12)}',
    `.lz-navbar[data-scrolled]:is([data-scroll=solid],[data-scroll=compact]){background:var(${v(t.background)},var(--background));-webkit-backdrop-filter:none;backdrop-filter:none}`,
    `.lz-navbar[data-scrolled][data-scroll=compact]{height:calc(var(--h) * .78 * var(--u))}`,
    '.lz-navbar-brand{font-family:var(--font-heading);font-weight:700;font-size:1.15em;white-space:nowrap}',
    `.lz-navbar-links{display:flex;align-items:center;gap:${u('22')};margin-left:auto}`,
    '.lz-navbar[data-layout=left] .lz-navbar-links,.lz-navbar[data-layout=center] .lz-navbar-links{margin-left:0}',
    '.lz-navbar[data-layout=center]{justify-content:center}',
    '.lz-navbar a{color:inherit;text-decoration:none;white-space:nowrap}',
    '.lz-navbar a:hover{opacity:.7}',
    '.lz-navbar-menu{display:none;position:relative;margin-left:auto}',
    '.lz-navbar-menu summary{list-style:none;cursor:pointer;font-size:1.5em;line-height:1}',
    '.lz-navbar-menu summary::-webkit-details-marker{display:none}',
    '.lz-navbar-drop{position:absolute;z-index:60;top:100%;right:0;display:grid;gap:12px;min-width:160px;margin-top:8px;padding:14px 16px;background:var(--surface);color:var(--text);border-radius:var(--radius);box-shadow:0 12px 32px rgba(15,23,42,.18)}',

    '.lz-field{display:flex;flex-direction:column;gap:4px;justify-content:center;text-align:left}',
    '.lz-field>span{font-size:.78em;opacity:.75}',
    '.lz-field>span i{font-style:normal;color:#dc2626;margin-left:2px}',
    '.lz-field input,.lz-field select,.lz-field textarea{font:inherit;color:inherit;width:100%;flex:1;min-height:0;background:transparent;border:0;padding:0;outline:none;resize:none}',
    '.lz-field-check{flex-direction:row;justify-content:flex-start;align-items:center;gap:10px}',
    '.lz-field-check input{flex:0 0 auto;width:18px;height:18px;accent-color:var(--primary)}',
    '.lz-field-error{position:absolute;top:100%;left:0;margin-top:2px;font-size:12px;font-style:normal;color:#dc2626}',

    '.lz-stack-nav{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:24px 20px 0;background:var(--background)}',
    '.lz-stack-nav button{font:inherit;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border:1px solid color-mix(in srgb,var(--muted) 35%,transparent);border-radius:999px;background:transparent;color:var(--muted);transition:background .2s ease,color .2s ease}',
    '.lz-stack-nav button[aria-pressed=true]{background:var(--primary);border-color:var(--primary);color:var(--background)}',
    '.lz-stack-nav i{font-style:normal;display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:color-mix(in srgb,currentColor 18%,transparent);font-size:.8em}',
    '.lz-stack-panel{display:none}',
    '.lz-stack-panel[data-on]{display:block}',

    '.lz-modal{border:none;border-radius:var(--radius);padding:0;max-width:calc(100% - 2rem);max-height:calc(100dvh - 3rem);color:var(--text);font-family:var(--font-body);overflow:auto;'
        + 'width:min(calc(var(--dw) * 1px),calc(100vw - 2rem));--u:calc(min(100vw - 2rem,var(--dw) * 1px) / var(--dw));background:var(--dbg,var(--background))}',
    '.lz-modal[data-size=full]{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;--u:calc(min(100vw,var(--dw) * 1px) / var(--dw))}',
    '.lz-modal::backdrop{background:rgba(15,23,42,.5)}',
    '.lz-modal .lz-frame{overflow:hidden}',
    `.lz-modal-bar{display:flex;align-items:center;gap:${u('12')};padding:${u('8')} ${u('10')} ${u('8')} ${u('18')}}`,
    `.lz-modal-title{margin:0;font-family:var(--font-heading);font-size:${u('20')};font-weight:700}`,
    `.lz-modal-close{margin-left:auto;width:${u('34')};height:${u('34')};display:grid;place-items:center;font:inherit;font-size:${u('20')};line-height:1;color:var(--text);background:var(--surface);border:0;border-radius:999px;cursor:pointer}`,
    '.lz-modal-close:hover{opacity:.8}',
    '.lz-placeholder{display:grid;place-items:center;padding:8px;border:1px dashed currentColor;font:12px/1.3 system-ui,sans-serif;opacity:.6}',

    '@container lz (max-width:640px){'
        + '.lz-section>.lz-frame{--u:calc(min(100cqw,390px) / 390)}'
        + `.lz-frame{height:${u('var(--fmh)')}}`
        + '.lz-frame[data-stack]{height:auto;padding:32px 20px;display:flex;flex-direction:column;gap:20px}'
        + `.lz-frame:not([data-stack]) .lz-el{position:absolute;left:calc(var(--mx) * 1%);top:${u('var(--my)')};width:calc(var(--mw) * 1%);height:${u('var(--mh)')}}`
        + '.lz-frame[data-stack] .lz-el{position:static;width:auto;height:auto;order:var(--ord)}'
        + `.lz-el[data-${t.visible_on.attr}=desktop]{display:none}`
        + '.lz-parallax>.lz-bg{position:absolute}'
        + '.lz-navbar-links{display:none}'
        + '.lz-navbar-menu{display:block}'
        + '.lz-el{max-width:100%;min-width:0}'
        + 'img.lz-el{height:auto}'
        + '.lz-icon{width:max-content}'
        + `.lz-icon svg{width:${u('36')};height:${u('36')}}}`,
].join('\n') + '\n';
