/**
 * The serializer every byte of public markup passes through. Canonical output
 * rules (shared with every other backend, checked by the render goldens):
 * attributes sorted by name, no whitespace between tags, numbers through
 * `num`, and text escaped exactly like PHP's
 * `htmlspecialchars(ENT_QUOTES | ENT_SUBSTITUTE)`.
 */

declare const trusted: unique symbol;
/** Markup that is safe to emit as-is: built by this serializer or by developer code. Never user input. */
export type TrustedHtml = string & { readonly [trusted]: true };

/** Marks markup produced by developer code (an app element, a head hook). */
export function trustedHtml(html: string): TrustedHtml {
    return html as TrustedHtml;
}

/** Every tag the renderer may emit. Anything else does not compile. */
export type Tag =
    | 'a' | 'button' | 'circle' | 'details' | 'dialog' | 'div' | 'em' | 'form' | 'h1' | 'h2' | 'h3' | 'h4' | 'hr' | 'i'
    | 'iframe' | 'img' | 'input' | 'label' | 'line' | 'link' | 'meta' | 'nav' | 'option' | 'p' | 'path' | 'rect'
    | 'section' | 'select' | 'span' | 'summary' | 'svg' | 'textarea';
const VOID: ReadonlySet<Tag> = new Set(['hr', 'img', 'input', 'link', 'meta']);

export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Readonly<Record<string, AttrValue>>;
/** Text goes in through `text()`, so plain strings cannot reach the output unescaped. */
export type Child = TrustedHtml | null | undefined | false;

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };

export const escape = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

export const text = (value: string): TrustedHtml => trustedHtml(escape(value));

const ATTRIBUTE = /^[a-zA-Z][a-zA-Z0-9-]*$/;
const URL_ATTRIBUTES: ReadonlySet<string> = new Set(['action', 'href', 'src']);
/** An empty URL is allowed: it is how an image with nothing to show says so. */
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#|$)/;

/**
 * One element. `true` renders a bare attribute, `false`/null/undefined drop it.
 * URL attributes must use an allowed scheme: a violation is a renderer bug and throws.
 */
export function h(tag: Tag, attrs: Attrs = {}, children: readonly Child[] = []): TrustedHtml {
    let html = `<${tag}`;

    for (const name of Object.keys(attrs).sort()) {
        const value = attrs[name];

        if (value === false || value === null || value === undefined) {
            continue;
        }

        if (!ATTRIBUTE.test(name)) {
            throw new Error(`Refusing attribute name ${JSON.stringify(name)}`);
        }

        if (value === true) {
            html += ` ${name}`;
            continue;
        }

        const text = typeof value === 'number' ? num(value) : value;
        assertSafeUrl(name, text);
        html += ` ${name}="${escape(text)}"`;
    }

    if (VOID.has(tag)) {
        return trustedHtml(`${html}>`);
    }

    return trustedHtml(`${html}>${children.map(child).join('')}</${tag}>`);
}

export const fragment = (children: readonly Child[]): TrustedHtml => trustedHtml(children.map(child).join(''));

function child(value: Child): string {
    return value === null || value === undefined || value === false ? '' : value;
}

function assertSafeUrl(name: string, value: string): void {
    if (name === 'srcset') {
        value.split(',').forEach((candidate) => assertSafeUrl('src', candidate.trim().split(/\s+/)[0] ?? ''));

        return;
    }

    if (URL_ATTRIBUTES.has(name) && !SAFE_URL.test(value)) {
        throw new Error(`Refusing ${name}=${JSON.stringify(value)}`);
    }
}

/**
 * Canonical number: the shortest round-trip decimal, rounded half away from
 * zero to 3 decimals, trailing zeros stripped. Rounding works on the decimal
 * digits, not on binary floats, so 1.0005 becomes 1.001 in every language.
 */
export function num(value: number): string {
    if (!Number.isFinite(value)) {
        throw new Error(`Refusing non-finite number ${value}`);
    }

    const [whole = '0', fraction = ''] = plainDecimal(Math.abs(value)).split('.');
    let digits = whole + fraction.slice(0, 3).padEnd(3, '0');

    if ((fraction[3] ?? '0') >= '5') {
        digits = increment(digits);
    }

    const integer = digits.slice(0, -3).replace(/^0+(?=\d)/, '') || '0';
    const decimals = digits.slice(-3).replace(/0+$/, '');
    const result = decimals === '' ? integer : `${integer}.${decimals}`;

    return value < 0 && result !== '0' ? `-${result}` : result;
}

function plainDecimal(value: number): string {
    const text = String(value);
    const match = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(text);

    if (!match) {
        return text;
    }

    const digits = `${match[1]}${match[2] ?? ''}`;
    const exponent = Number(match[3]);

    return exponent < 0
        ? `0.${'0'.repeat(-exponent - 1)}${digits}`
        : digits.padEnd(exponent + 1, '0').replace(new RegExp(`^(\\d{${exponent + 1}})(\\d+)$`), '$1.$2');
}

function increment(digits: string): string {
    const chars = digits.split('');

    for (let index = chars.length - 1; index >= 0; index--) {
        if (chars[index] !== '9') {
            chars[index] = String(Number(chars[index]) + 1);

            return chars.join('');
        }

        chars[index] = '0';
    }

    return `1${chars.join('')}`;
}
