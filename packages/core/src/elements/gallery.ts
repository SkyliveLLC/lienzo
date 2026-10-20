import { h } from '../html.ts';
import type { ElementRenderer } from './context.ts';

/**
 * A row of pictures: a grid that wraps, or a strip that scrolls sideways and
 * snaps. Pictures with nothing behind them are skipped, so a deleted upload
 * leaves a shorter gallery instead of a broken frame.
 */
export const gallery: ElementRenderer = (element, context) => {
    const pictures = (element.props.images ?? []).flatMap((source) => {
        const file = context.media(source);

        return file === null ? [] : [h('img', {
            class: 'lz-gallery-item',
            src: file.url,
            srcset: file.thumb ? `${file.thumb} 480w, ${file.url} 1800w` : null,
            width: file.width ? file.width : null,
            height: file.width ? file.height : null,
            alt: element.props.alt ?? '',
            loading: 'lazy',
            decoding: 'async',
        })];
    });

    return {
        tag: 'div',
        class: 'lz-gallery',
        attrs: {
            'data-layout': element.props.layout === 'strip' ? 'strip' : 'grid',
            'data-cols': String(element.props.columns ?? 3),
        },
        children: pictures,
    };
};
