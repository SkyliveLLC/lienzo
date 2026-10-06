import { h, text } from '../html.ts';
import type { ElementRenderer } from './context.ts';

export const navbar: ElementRenderer = (element, context) => {
    const { brand, links = [], layout, template, sticky, scroll_style: scroll } = element.props;
    const anchors = (links ?? []).map((link) => h('a', context.action(link.action) ?? { href: '#' }, [text(link.label)]));

    return {
        tag: 'nav',
        class: 'lz-navbar',
        attrs: {
            'data-layout': layout ?? 'split',
            'data-template': template && template !== 'plain' ? template : null,
            'data-sticky': sticky === true,
            'data-scroll': sticky && scroll && scroll !== 'same' ? scroll : null,
        },
        children: [
            (brand ?? '').trim() !== '' && h('span', { class: 'lz-navbar-brand' }, [text(brand ?? '')]),
            h('div', { class: 'lz-navbar-links' }, anchors),
            anchors.length > 0 && h('details', { class: 'lz-navbar-menu' }, [
                h('summary', { 'aria-label': context.t.menu }, [text('☰')]),
                h('div', { class: 'lz-navbar-drop' }, anchors),
            ]),
        ],
    };
};
