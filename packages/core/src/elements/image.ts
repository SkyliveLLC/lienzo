import type { ElementRenderer } from './context.ts';

/**
 * An empty source or a deleted `media:<id>` renders `src=""`: no request, and
 * the browser shows the alt text instead of a broken reference.
 */
export const image: ElementRenderer = (element, context) => {
    const file = context.media(element.props.src);

    return {
        tag: 'img',
        attrs: {
            src: file?.url ?? '',
            srcset: file?.thumb ? `${file.thumb} 480w, ${file.url} 1800w` : null,
            sizes: file?.thumb ? `(max-width: 640px) 100vw, ${Math.trunc(element.layout.desktop.w)}vw` : null,
            width: file?.width ? file.width : null,
            height: file?.width ? file.height : null,
            alt: element.props.alt ?? '',
            loading: 'lazy',
            decoding: 'async',
            'data-shape': element.props.shape,
        },
    };
};
