/**
 * Behaviour of a published page, shipped as the static `runtime.js`: tabs and
 * steps, modals, back to top and back, the sticky navbar's scrolled state,
 * and entrance animations. Everything is delegated from `document`, so a
 * navbar link or an icon works exactly like a button.
 *
 * Analytics stay with the host: the page dispatches `lienzo:track` with
 * `{ name: 'contact' | 'lead' }` and the host forwards it wherever it wants.
 */
(() => {
    const track = (name: 'contact' | 'lead') => document.dispatchEvent(new CustomEvent('lienzo:track', { detail: { name } }));

    const panelsOf = (stack: Element) => Array.from(stack.querySelectorAll(':scope > .lz-stack-panels > .lz-stack-panel'));
    const buttonsOf = (stack: Element) => Array.from(stack.querySelectorAll(':scope > .lz-stack-nav > button'));

    const go = (stack: HTMLElement, index: number) => {
        const panels = panelsOf(stack);

        if (index < 0 || index >= panels.length) {
            return false;
        }

        buttonsOf(stack).forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
        panels.forEach((panel, position) => panel.toggleAttribute('data-on', position === index));
        stack.dataset.current = String(index);

        return true;
    };

    const current = (stack: HTMLElement) => Number(stack.dataset.current ?? 0);

    /** Moves to the step holding `node`, if it sits in a hidden one. */
    const reveal = (node: Element) => {
        const stack = node.closest<HTMLElement>('.lz-stack');
        const panel = node.closest('.lz-stack-panel');

        if (stack && panel) {
            go(stack, panelsOf(stack).indexOf(panel));
        }
    };

    const controls = (root: Element) => Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));

    const step = (trigger: HTMLElement) => {
        const stack = trigger.closest<HTMLElement>('.lz-stack');

        if (!stack) {
            return;
        }

        const forward = trigger.dataset.step === 'next';
        const panel = panelsOf(stack)[current(stack)];

        // A steps group is one form: check the visible step before leaving it.
        if (forward && panel && !controls(panel).every((control) => control.reportValidity())) {
            return;
        }

        if (go(stack, current(stack) + (forward ? 1 : -1))) {
            stack.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    document.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        if (target instanceof HTMLDialogElement && target.classList.contains('lz-modal')) {
            target.close();

            return;
        }

        if (target.closest('a[href^="https://wa.me"], a[href^="tel:"]')) {
            track('contact');
        }

        const trigger = target.closest<HTMLElement>('[data-go], [data-step], [data-modal], [data-close], [data-top], [data-back]');

        if (!trigger) {
            return;
        }

        event.preventDefault();
        trigger.closest('details[open]')?.removeAttribute('open');
        const { go: index, modal } = trigger.dataset;

        if (index !== undefined) {
            const stack = trigger.closest<HTMLElement>('.lz-stack');

            if (stack) {
                go(stack, Number(index));
            }
        } else if (trigger.dataset.step !== undefined) {
            step(trigger);
        } else if (modal !== undefined) {
            document.getElementById(`m-${modal}`)?.closest('dialog')?.showModal();
        } else if (trigger.hasAttribute('data-close')) {
            trigger.closest('dialog')?.close();
        } else if (trigger.hasAttribute('data-top')) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (history.length > 1) {
            history.back();
        } else {
            window.location.href = '/';
        }
    });

    document.addEventListener('submit', (event) => {
        if (event.target instanceof HTMLFormElement && event.target.method === 'post') {
            track('lead');
        }
    });

    // The browser cannot focus an invalid field in a hidden step, so show that step first.
    document.addEventListener('invalid', (event) => {
        const field = event.target;
        const panel = field instanceof Element ? field.closest('.lz-stack-panel') : null;

        if (field instanceof Element && panel && !panel.hasAttribute('data-on')) {
            const stack = field.closest<HTMLElement>('.lz-stack');
            const shown = stack ? panelsOf(stack)[current(stack)] : undefined;

            if (!shown || controls(shown).every((control) => control.validity.valid)) {
                reveal(field);
            }
        }
    }, true);

    // After a failed submission: show the step with the first error and reopen the modal that was sent.
    document.querySelectorAll('.lz-stack').forEach((stack) => {
        const error = stack.querySelector('.lz-field-error');

        if (error) {
            reveal(error);
        }
    });
    document.querySelectorAll<HTMLDialogElement>('dialog.lz-modal[data-open]').forEach((dialog) => dialog.showModal());

    const bars = document.querySelectorAll('nav.lz-navbar[data-sticky]');

    if (bars.length > 0) {
        const mark = () => bars.forEach((bar) => bar.toggleAttribute('data-scrolled', window.scrollY > 16));
        mark();
        window.addEventListener('scroll', mark, { passive: true });
    }

    // Sliders: the arrows and the dots move the track, and autoplay waits for the reader.
    const sliders = document.querySelectorAll<HTMLElement>('.lz-slider');

    if (sliders.length > 0) {
        const trackOf = (slider: Element) => slider.querySelector<HTMLElement>('.lz-slider-track');
        const slidesOf = (slider: Element) => Array.from(slider.querySelectorAll('.lz-slide'));
        const at = (track: HTMLElement) => Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));

        const mark = (slider: Element) => {
            const track = trackOf(slider);
            const dots = Array.from(slider.querySelectorAll('.lz-slider-dots button'));

            if (track) {
                dots.forEach((dot, index) => dot.toggleAttribute('data-on', index === at(track)));
            }
        };

        const move = (slider: Element, to: number) => {
            const track = trackOf(slider);
            const count = slidesOf(slider).length;

            if (track && count > 0) {
                track.scrollTo({ left: ((to % count) + count) % count * track.clientWidth });
            }
        };

        document.addEventListener('click', (event) => {
            const button = event.target instanceof Element ? event.target.closest<HTMLElement>('.lz-slider-arrow,.lz-slider-dots button') : null;
            const slider = button?.closest('.lz-slider');
            const track = slider ? trackOf(slider) : null;

            if (!button || !slider || !track) {
                return;
            }

            const step = button.dataset.to === 'next' ? 1 : button.dataset.to === 'previous' ? -1 : 0;

            move(slider, step === 0 ? Number(button.dataset.at ?? 0) : at(track) + step);
        });

        sliders.forEach((slider) => {
            mark(slider);
            trackOf(slider)?.addEventListener('scroll', () => mark(slider), { passive: true });

            if (!slider.hasAttribute('data-autoplay') || window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
                return;
            }

            const every = Math.max(Number(slider.dataset.interval ?? 5), 2) * 1000;
            let timer = setInterval(() => move(slider, at(trackOf(slider)!) + 1), every);
            const stop = () => clearInterval(timer);
            const start = () => {
                stop();
                timer = setInterval(() => move(slider, at(trackOf(slider)!) + 1), every);
            };

            slider.addEventListener('pointerenter', stop);
            slider.addEventListener('focusin', stop);
            slider.addEventListener('pointerleave', start);
            slider.addEventListener('focusout', start);
        });
    }

    const animated = document.querySelectorAll('[data-anim]');
    const show = (node: Element) => node.classList.add('is-in');

    if (animated.length > 0 && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
            if (entry.isIntersecting) {
                show(entry.target);
                observer.unobserve(entry.target);
            }
        }), { threshold: 0.01 });

        animated.forEach((node) => observer.observe(node));
    }

    // Nothing may stay invisible, not even on a page too short to scroll.
    setTimeout(() => animated.forEach(show), animated.length > 0 && 'IntersectionObserver' in window ? 3000 : 0);
})();
