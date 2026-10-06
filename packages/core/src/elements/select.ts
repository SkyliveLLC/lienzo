import { h, text } from '../html.ts';
import { fieldError, fieldKey, fieldLabel, fieldName, type ElementRenderer } from './context.ts';

export const select: ElementRenderer = (element, context) => {
    const options = element.props.options ?? [];
    const key = fieldKey(element);

    // Several answers: a list of checkboxes, because a native multiple select
    // is hard to use on a phone. One answer: the dropdown.
    if (element.props.multiple === true) {
        const chosen = new Set(options.map((_, index) => context.form?.old(`${key}.${index}`)).filter((value) => typeof value === 'string'));

        return {
            tag: 'div',
            class: 'lz-field lz-choices',
            children: [
                fieldLabel(element),
                h(
                    'div',
                    { class: 'lz-choices-list' },
                    options.map((option) =>
                        h('label', {}, [
                            h('input', { type: 'checkbox', name: `${fieldName(element)}[]`, value: option, checked: chosen.has(option) }),
                            h('span', {}, [text(option)]),
                        ]),
                    ),
                ),
                fieldError(element, context),
            ],
        };
    }

    const old = context.form?.old(key) ?? null;

    return {
        tag: 'label',
        class: 'lz-field',
        children: [
            fieldLabel(element),
            h('select', { name: fieldName(element), required: element.props.required === true }, [
                h('option', { value: '' }, [text(element.props.placeholder || context.t.choose)]),
                ...options.map((option) => h('option', { value: option, selected: old === option }, [text(option)])),
            ]),
            fieldError(element, context),
        ],
    };
};
