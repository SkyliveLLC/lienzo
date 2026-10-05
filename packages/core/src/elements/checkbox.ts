import { h } from '../html.ts';
import { fieldError, fieldKey, fieldLabel, fieldName, type ElementRenderer } from './context.ts';

export const checkbox: ElementRenderer = (element, context) => ({
    tag: 'label',
    class: 'lz-field lz-field-check',
    children: [
        h('input', {
            type: 'checkbox',
            name: fieldName(element),
            value: '1',
            checked: Boolean(context.form?.old(fieldKey(element))),
            required: element.props.required === true,
        }),
        fieldLabel(element),
        fieldError(element, context),
    ],
});
