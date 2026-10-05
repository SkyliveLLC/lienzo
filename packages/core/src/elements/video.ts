import { h } from '../html.ts';
import type { ElementRenderer } from './context.ts';

/** YouTube and Vimeo links become their privacy-friendly embed URL; anything else embeds nothing. */
export function videoEmbed(url: string): string | null {
    const youtube = /youtu(?:\.be\/|be\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{6,20})/.exec(url);

    if (youtube) {
        return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;
    }

    const vimeo = /vimeo\.com\/(?:video\/)?([0-9]{6,12})/.exec(url);

    return vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
}

export const video: ElementRenderer = (element, context) => {
    const embed = videoEmbed(element.props.url ?? '');

    return {
        tag: 'div',
        class: 'lz-video',
        children: [embed === null ? null : h('iframe', { src: embed, title: element.props.alt ?? context.t.video, loading: 'lazy', allowfullscreen: true })],
    };
};
