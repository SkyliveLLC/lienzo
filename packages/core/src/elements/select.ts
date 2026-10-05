import { h, text } from '../html.ts';
import { fieldError, fieldKey, fieldLabel, fieldName, type ElementRenderer } from './context.ts';

export const select: ElementRenderer = (element, context) => {
    const old = context.form?.old(fieldKey(element)) ?? null;

    return {
        tag: 'label',
        class: 'lz-field',
        children: [
            fieldLabel(element),
            h('select', { name: fieldName(element), required: element.props.required === true }, [
                h('option', { value: '' }, [text(element.props.placeholder || context.t.choose)]),
                ...(element.props.options ?? []).map((option) => h('option', { value: option, selected: old === option }, [text(option)])),
            ]),
            fieldError(element, context),
        ],
    };
};
