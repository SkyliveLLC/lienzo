import { h, text } from '../html.ts';
import type { ElementRenderer } from './context.ts';

/**
 * Pictures shown one at a time, on a track that scrolls and snaps. Without
 * JavaScript it is still a scrollable strip; the runtime adds the arrows, the
 * dots and the moving by itself. Pictures with nothing behind them are skipped.
 */
export const slider: ElementRenderer = (element, context) => {
    const slides = (element.props.images ?? []).flatMap((source, index) => {
        const file = context.media(source);

        return file === null ? [] : [h('img', {
            class: 'lz-slide',
            src: file.url,
            srcset: file.thumb ? `${file.thumb} 480w, ${file.url} 1800w` : null,
            width: file.width ? file.width : null,
            height: file.width ? file.height : null,
            alt: element.props.alt ?? '',
            loading: index === 0 ? null : 'lazy',
            decoding: 'async',
        })];
    });

    const arrows = element.props.arrows !== false && slides.length > 1;
    const dots = element.props.dots !== false && slides.length > 1;

    return {
        tag: 'div',
        class: 'lz-slider',
        attrs: {
            'data-autoplay': element.props.autoplay === true && slides.length > 1 ? '' : null,
            'data-interval': element.props.interval === null || element.props.interval === undefined
                ? null
                : String(element.props.interval),
        },
        children: [
            h('div', { class: 'lz-slider-track' }, slides),
            arrows ? h('button', { type: 'button', class: 'lz-slider-arrow', 'data-to': 'previous', 'aria-label': context.t.previous }) : null,
            arrows ? h('button', { type: 'button', class: 'lz-slider-arrow', 'data-to': 'next', 'aria-label': context.t.next }) : null,
            dots
                ? h('div', { class: 'lz-slider-dots' }, slides.map((_, index) => h('button', {
                    type: 'button',
                    'data-at': String(index),
                    'aria-label': context.t.slide.replace('{n}', String(index + 1)),
                }, [text('')])))
                : null,
        ],
    };
};
