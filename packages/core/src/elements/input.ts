import { h } from '../html.ts';
import { fieldError, fieldKey, fieldLabel, fieldName, type ElementRenderer } from './context.ts';

export const input: ElementRenderer = (element, context) => ({
    tag: 'label',
    class: 'lz-field',
    children: [
        fieldLabel(element),
        h('input', {
            type: element.props.input_type ?? 'text',
            name: fieldName(element),
            value: context.form?.old(fieldKey(element)),
            placeholder: element.props.placeholder,
            required: element.props.required === true,
        }),
        fieldError(element, context),
    ],
});
