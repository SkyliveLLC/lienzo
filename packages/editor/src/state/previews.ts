import type { AppElement } from '@skylivellc/lienzo-core';
import { shallowRef, type ShallowRef } from 'vue';
import type { Client } from '../client.ts';

export type Preview = { status: 'loading' } | { status: 'ready'; html: string } | { status: 'failed' };

export type Previews = {
    /** The preview for this element's type and props, fetching it on a miss. */
    get(element: AppElement): Preview;
    /** Bumps whenever a preview arrives, so the canvas knows to render again. */
    readonly version: ShallowRef<number>;
};

/**
 * HTML of app elements, rendered by the backend. Cached by type and props:
 * moving, resizing or restyling an element never refetches, since box and
 * style live on the wrapper core renders around it. Misses are batched into
 * one `POST /preview` per `wait` ms.
 */
export function createPreviews(client: Client, wait = 250): Previews {
    const cache = new Map<string, Preview>();
    const queue = new Map<string, { id: string; type: string; props: Record<string, unknown> }>();
    const version = shallowRef(0);
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function flush() {
        const batch = [...queue.entries()];
        queue.clear();

        const result = await client('POST /preview', { elements: batch.map(([, element]) => element) });

        for (const [key, element] of batch) {
            const html = result.ok ? result.value[element.id] : undefined;
            cache.set(key, html === undefined ? { status: 'failed' } : { status: 'ready', html });
        }

        version.value++;
    }

    return {
        version,
        get(element) {
            const key = previewKey(element);
            const cached = cache.get(key);

            if (cached) {
                return cached;
            }

            cache.set(key, { status: 'loading' });
            queue.set(key, { id: element.id, type: element.type, props: { ...element.props } });
            clearTimeout(timer);
            timer = setTimeout(() => void flush(), wait);

            return { status: 'loading' };
        },
    };
}

/** Type plus props with sorted keys, so equal props share one preview whatever their key order. */
export function previewKey(element: Pick<AppElement, 'type' | 'props'>): string {
    const props = Object.keys(element.props).sort().map((key) => [key, element.props[key]]);

    return JSON.stringify([element.type, props]);
}
