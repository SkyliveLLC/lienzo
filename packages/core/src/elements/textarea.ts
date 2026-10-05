import { h, text } from '../html.ts';
import { fieldError, fieldKey, fieldLabel, fieldName, type ElementRenderer } from './context.ts';

export const textarea: ElementRenderer = (element, context) => ({
    tag: 'label',
    class: 'lz-field',
    children: [
        fieldLabel(element),
        h('textarea', {
            name: fieldName(element),
            placeholder: element.props.placeholder,
            required: element.props.required === true,
        }, [text(context.form?.old(fieldKey(element)) ?? '')]),
        fieldError(element, context),
    ],
});
