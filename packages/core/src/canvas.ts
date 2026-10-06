import { FIELD_TYPES, isCoreElement, type CoreElement, type Document, type Element, type Modal, type Section } from './document.ts';

/**
 * Consecutive sections sharing a group id show one at a time, as tabs or
 * steps. A lone section with a group id is just a section.
 */
export type Group =
    | { kind: 'single'; section: Section }
    | { kind: 'stack'; id: string; type: 'tabs' | 'steps'; sections: [Section, ...Section[]] };

export function groupSections(sections: readonly Section[]): Group[] {
    const runs: { id: string | null; sections: [Section, ...Section[]] }[] = [];

    for (const section of sections) {
        const id = section.group?.id || null;
        const last = runs.at(-1);

        if (id !== null && last?.id === id) {
            last.sections.push(section);
        } else {
            runs.push({ id, sections: [section] });
        }
    }

    return runs.map(({ id, sections: [first, ...rest] }): Group => (id !== null && rest.length > 0
        ? { kind: 'stack', id, type: first.group?.type ?? 'tabs', sections: [first, ...rest] }
        : { kind: 'single', section: first }));
}

/** One rule for ids in HTML, CSS selectors and field names. */
export const safeId = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, '') || 'x';

const fieldTypes: ReadonlySet<string> = new Set(FIELD_TYPES);
export const isField = (element: Element): element is CoreElement => isCoreElement(element) && fieldTypes.has(element.type);

/** A canvas with fields or a submit button is published inside a form. */
export const isForm = (canvas: Section | Modal): boolean =>
    canvas.elements.some((element) => isField(element) || (isCoreElement(element) && element.props.action?.type === 'submit'));

/** A steps group is one form across all its steps, so nothing typed in an earlier step is lost. */
export const isStepsForm = (group: Group): boolean => group.kind === 'stack' && group.type === 'steps' && group.sections.some(isForm);

/** On mobile a canvas keeps its own layout only if every element has a mobile box; otherwise it stacks. */
export const stacks = (canvas: Section | Modal): boolean => canvas.elements.some((element) => !element.layout.mobile);

/** Stacked order follows the desktop design: higher first, then further left. 1-based. */
export function stackOrder(elements: readonly Element[]): Map<Element, number> {
    const sorted = [...elements].sort((a, b) => a.layout.desktop.y - b.layout.desktop.y || a.layout.desktop.x - b.layout.desktop.x);

    return new Map(sorted.map((element, index) => [element, index + 1]));
}

export type FormField =
    | { kind: 'input'; name: string; label: string; required: boolean; inputType: 'text' | 'email' | 'tel' | 'number' | 'date' }
    | { kind: 'textarea' | 'checkbox'; name: string; label: string; required: boolean }
    | { kind: 'select'; name: string; label: string; required: boolean; options: string[]; multiple: boolean };

/** `source` is posted with the form: a section id, a modal id, or a steps group id. */
export type FormSpec = { source: string; fields: FormField[] };

/**
 * The forms a published document renders, with the fields each accepts.
 * A submission handler validates against this list from the published page,
 * never against whatever the browser posts. Field values arrive as `fields[<name>]`.
 */
export function formFields(document: Document): FormSpec[] {
    const spec = (source: string, canvases: readonly (Section | Modal)[]): FormSpec => ({
        source,
        fields: canvases.flatMap((canvas) => canvas.elements.filter(isField).map(field)),
    });

    return [
        ...groupSections(document.sections).flatMap((group) => {
            if (group.kind === 'single') {
                return isForm(group.section) ? [spec(group.section.id, [group.section])] : [];
            }

            return isStepsForm(group) ? [spec(group.id, group.sections)] : group.sections.filter(isForm).map((section) => spec(section.id, [section]));
        }),
        ...(document.modals ?? []).filter(isForm).map((modal) => spec(modal.id, [modal])),
    ];
}

function field(element: CoreElement): FormField {
    const base = { name: safeId(element.id), label: (element.props.label ?? '').trim(), required: element.props.required === true };

    switch (element.type) {
        case 'select':
            return { kind: 'select', ...base, options: element.props.options ?? [], multiple: element.props.multiple === true };
        case 'textarea':
        case 'checkbox':
            return { kind: element.type, ...base };
        default:
            return { kind: 'input', ...base, inputType: element.props.input_type ?? 'text' };
    }
}
