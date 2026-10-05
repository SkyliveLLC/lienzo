(() => {
    const track = (name) => document.dispatchEvent(new CustomEvent('lienzo:track', { detail: { name } }));
    const panelsOf = (stack) => Array.from(stack.querySelectorAll(':scope > .lz-stack-panels > .lz-stack-panel'));
    const buttonsOf = (stack) => Array.from(stack.querySelectorAll(':scope > .lz-stack-nav > button'));
    const go = (stack, index) => {
        const panels = panelsOf(stack);
        if (index < 0 || index >= panels.length) {
            return false;
        }
        buttonsOf(stack).forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
        panels.forEach((panel, position) => panel.toggleAttribute('data-on', position === index));
        stack.dataset.current = String(index);
        return true;
    };
    const current = (stack) => Number(stack.dataset.current ?? 0);
    const reveal = (node) => {
        const stack = node.closest('.lz-stack');
        const panel = node.closest('.lz-stack-panel');
        if (stack && panel) {
            go(stack, panelsOf(stack).indexOf(panel));
        }
    };
    const controls = (root) => Array.from(root.querySelectorAll('input, select, textarea'));
    const step = (trigger) => {
        const stack = trigger.closest('.lz-stack');
        if (!stack) {
            return;
        }
        const forward = trigger.dataset.step === 'next';
        const panel = panelsOf(stack)[current(stack)];
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
        const trigger = target.closest('[data-go], [data-step], [data-modal], [data-close], [data-top], [data-back]');
        if (!trigger) {
            return;
        }
        event.preventDefault();
        trigger.closest('details[open]')?.removeAttribute('open');
        const { go: index, modal } = trigger.dataset;
        if (index !== undefined) {
            const stack = trigger.closest('.lz-stack');
            if (stack) {
                go(stack, Number(index));
            }
        }
        else if (trigger.dataset.step !== undefined) {
            step(trigger);
        }
        else if (modal !== undefined) {
            document.getElementById(`m-${modal}`)?.closest('dialog')?.showModal();
        }
        else if (trigger.hasAttribute('data-close')) {
            trigger.closest('dialog')?.close();
        }
        else if (trigger.hasAttribute('data-top')) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        else if (history.length > 1) {
            history.back();
        }
        else {
            window.location.href = '/';
        }
    });
    document.addEventListener('submit', (event) => {
        if (event.target instanceof HTMLFormElement && event.target.method === 'post') {
            track('lead');
        }
    });
    document.addEventListener('invalid', (event) => {
        const field = event.target;
        const panel = field instanceof Element ? field.closest('.lz-stack-panel') : null;
        if (field instanceof Element && panel && !panel.hasAttribute('data-on')) {
            const stack = field.closest('.lz-stack');
            const shown = stack ? panelsOf(stack)[current(stack)] : undefined;
            if (!shown || controls(shown).every((control) => control.validity.valid)) {
                reveal(field);
            }
        }
    }, true);
    document.querySelectorAll('.lz-stack').forEach((stack) => {
        const error = stack.querySelector('.lz-field-error');
        if (error) {
            reveal(error);
        }
    });
    document.querySelectorAll('dialog.lz-modal[data-open]').forEach((dialog) => dialog.showModal());
    const bars = document.querySelectorAll('nav.lz-navbar[data-sticky]');
    if (bars.length > 0) {
        const mark = () => bars.forEach((bar) => bar.toggleAttribute('data-scrolled', window.scrollY > 16));
        mark();
        window.addEventListener('scroll', mark, { passive: true });
    }
    const animated = document.querySelectorAll('[data-anim]');
    const show = (node) => node.classList.add('is-in');
    if (animated.length > 0 && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
            if (entry.isIntersecting) {
                show(entry.target);
                observer.unobserve(entry.target);
            }
        }), { threshold: 0.01 });
        animated.forEach((node) => observer.observe(node));
    }
    setTimeout(() => animated.forEach(show), animated.length > 0 && 'IntersectionObserver' in window ? 3000 : 0);
})();
