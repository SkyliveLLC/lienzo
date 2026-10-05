import type { Box, CoreElement, CoreElementType, Section } from '@skylive/lienzo-core';
import { createTranslator, type MessageKey } from '../i18n/index.ts';
import { newId } from './document.ts';
import { coreSpecs } from './elements.ts';

/**
 * Ready-made sections and pages. They are only a starting point: they are
 * made of ordinary elements, edited like any other. Colors are theme tokens
 * so they follow the palette. Copy is neutral English, meant to be replaced.
 */
type Part = { type: CoreElementType; box: Box; props?: CoreElement['props']; style?: CoreElement['style'] };

const english = createTranslator('en').t;

function build(height: number, background: Section['background'], parts: readonly Part[]): Section {
    return {
        id: newId('section'),
        height: { desktop: height, mobile: Math.round(height * 1.3) },
        background,
        elements: parts.map((part, index) => {
            const defaults = coreSpecs[part.type].create(english);

            return {
                id: newId(part.type),
                type: part.type,
                z: index + 1,
                layout: { desktop: { ...part.box }, mobile: null },
                props: { ...defaults.props, ...part.props },
                style: { ...defaults.style, ...part.style },
            };
        }),
    };
}

const color = (token: string): Section['background'] => ({ type: 'color', color: token });

const field = { color: 'secondary', background: 'background', border_width: 1, border_color: 'muted', radius: 12, padding: 12 } as const;

const feature = (y: number, icon: string, title: string, text: string): Part[] => [
    { type: 'icon', box: { x: 43, y: y + 2, w: 3.5, h: 40 }, props: { icon, stroke: 2 }, style: { color: 'primary' } },
    { type: 'heading', box: { x: 49, y, w: 42, h: 30 }, props: { text: title, level: 3 }, style: { color: 'secondary', font: 'heading', size: 20, weight: 700, line_height: 1.3 } },
    { type: 'text', box: { x: 49, y: y + 32, w: 42, h: 44 }, props: { text }, style: { color: 'muted', size: 15, line_height: 1.5 } },
];

const sections = {
    hero: () => build(680, color('background'), [
        { type: 'shape', box: { x: 52, y: 120, w: 42, h: 400 }, props: { shape: 'blob' }, style: { background: 'surface' } },
        { type: 'image', box: { x: 50, y: 96, w: 40, h: 380 }, props: { src: '', alt: 'Product photo' }, style: { radius: 22, object_fit: 'cover', shadow: 'lg' } },
        {
            type: 'heading', box: { x: 6, y: 140, w: 40, h: 180 },
            props: { text: 'Build something people remember', level: 1 },
            style: { color: 'secondary', font: 'heading', size: 48, weight: 700, line_height: 1.1 },
        },
        {
            type: 'text', box: { x: 6, y: 336, w: 36, h: 90 },
            props: { text: "Tell visitors what you offer, who it is for and what happens next, in two short lines." },
            style: { color: 'muted', size: 18, line_height: 1.6 },
        },
        {
            type: 'button', box: { x: 6, y: 456, w: 16, h: 54 },
            props: { label: 'Get started', action: { type: 'anchor', value: '' } },
            style: { background: 'primary', color: 'background', radius: 14, weight: 600 },
        },
    ]),
    features: () => build(460, color('surface'), [
        { type: 'shape', box: { x: 39, y: 72, w: 56, h: 316 }, props: { shape: 'rectangle' }, style: { background: 'background', radius: 24, shadow: 'sm' } },
        { type: 'heading', box: { x: 6, y: 92, w: 30, h: 70 }, props: { text: 'What we do', level: 2 }, style: { color: 'secondary', font: 'heading', size: 38, weight: 700 } },
        {
            type: 'text', box: { x: 6, y: 172, w: 28, h: 110 },
            props: { text: 'Three reasons people choose us, each in a single sentence.' },
            style: { color: 'muted', size: 17, line_height: 1.6 },
        },
        ...feature(100, 'star', 'Clear from the start', 'You know what you get and what it costs before anything begins.'),
        ...feature(190, 'clock', 'On time', 'We agree on dates up front and keep you posted at every step.'),
        ...feature(280, 'heart', 'Here afterwards', 'Questions after the work is done get the same attention.'),
    ]),
    about: () => build(480, color('background'), [
        { type: 'image', box: { x: 6, y: 80, w: 32, h: 320 }, props: { src: '', alt: 'Our team' }, style: { radius: 22, object_fit: 'cover' } },
        { type: 'heading', box: { x: 44, y: 90, w: 40, h: 70 }, props: { text: 'Who we are', level: 2 }, style: { color: 'secondary', font: 'heading', size: 38, weight: 700 } },
        {
            type: 'text', box: { x: 44, y: 172, w: 40, h: 80 },
            props: { text: 'A small team that cares about the details. The same people follow your project from the first call to the last.' },
            style: { color: 'muted', size: 17, line_height: 1.6 },
        },
        { type: 'heading', box: { x: 44, y: 284, w: 20, h: 50 }, props: { text: '12 years', level: 3 }, style: { color: 'primary', font: 'heading', size: 32, weight: 700 } },
        { type: 'text', box: { x: 44, y: 336, w: 20, h: 40 }, props: { text: 'in business' }, style: { color: 'muted', size: 15 } },
        { type: 'heading', box: { x: 66, y: 284, w: 24, h: 50 }, props: { text: '1,200+', level: 3 }, style: { color: 'primary', font: 'heading', size: 32, weight: 700 } },
        { type: 'text', box: { x: 66, y: 336, w: 24, h: 40 }, props: { text: 'happy customers' }, style: { color: 'muted', size: 15 } },
    ]),
    cta: () => build(300, color('primary'), [
        {
            type: 'heading', box: { x: 6, y: 80, w: 48, h: 110 },
            props: { text: 'Ready to get started?', level: 2 },
            style: { color: 'background', font: 'heading', size: 34, weight: 700, line_height: 1.15 },
        },
        {
            type: 'text', box: { x: 6, y: 196, w: 40, h: 56 },
            props: { text: 'It takes two minutes to tell us what you need, and we answer the same day.' },
            style: { color: 'background', size: 16, line_height: 1.6, opacity: 0.9 },
        },
        {
            type: 'button', box: { x: 66, y: 110, w: 28, h: 56 },
            props: { label: 'Contact us', action: { type: 'anchor', value: '' } },
            style: { background: 'background', color: 'primary', radius: 14, weight: 700 },
        },
    ]),
    contact: () => build(520, color('surface'), [
        { type: 'heading', box: { x: 6, y: 80, w: 32, h: 120 }, props: { text: 'Get in touch', level: 2 }, style: { color: 'secondary', font: 'heading', size: 38, weight: 700 } },
        {
            type: 'text', box: { x: 6, y: 190, w: 30, h: 110 },
            props: { text: "Leave your details and we'll get back to you within one business day." },
            style: { color: 'muted', size: 17, line_height: 1.6 },
        },
        { type: 'input', box: { x: 44, y: 80, w: 24, h: 78 }, props: { label: 'Name', placeholder: 'Your name', required: true, input_type: 'text' }, style: field },
        { type: 'input', box: { x: 70, y: 80, w: 24, h: 78 }, props: { label: 'Email', placeholder: 'you@example.com', required: true, input_type: 'email' }, style: field },
        {
            type: 'select', box: { x: 44, y: 172, w: 50, h: 78 },
            props: { label: 'Topic', placeholder: '', required: true, options: ['General question', 'Pricing', 'Support', 'Other'] },
            style: field,
        },
        { type: 'textarea', box: { x: 44, y: 264, w: 50, h: 110 }, props: { label: 'Message', placeholder: 'Optional', required: false }, style: field },
        { type: 'checkbox', box: { x: 44, y: 388, w: 50, h: 34 }, props: { label: 'I agree to be contacted about my request', required: true }, style: { color: 'muted', size: 14 } },
        {
            type: 'button', box: { x: 44, y: 434, w: 50, h: 54 },
            props: { label: 'Send', action: { type: 'submit', value: '' } },
            style: { background: 'primary', color: 'background', radius: 14, weight: 700, size: 17 },
        },
    ]),
    footer: () => build(280, color('secondary'), [
        { type: 'heading', box: { x: 6, y: 64, w: 26, h: 50 }, props: { text: 'Your brand', level: 3 }, style: { color: 'background', font: 'heading', size: 24, weight: 700 } },
        {
            type: 'text', box: { x: 6, y: 122, w: 26, h: 100 },
            props: { text: 'Street and number\nCity, Country' },
            style: { color: 'background', size: 15, line_height: 1.7, opacity: 0.75 },
        },
        {
            type: 'text', box: { x: 38, y: 64, w: 26, h: 160 },
            props: { text: 'Hours\nMonday to Friday, 9:00 to 18:00\nSaturday, 9:00 to 13:00' },
            style: { color: 'background', size: 15, line_height: 1.8, opacity: 0.75 },
        },
        {
            type: 'button', box: { x: 70, y: 64, w: 24, h: 48 },
            props: { label: 'Contact us', action: { type: 'anchor', value: '' } },
            style: { background: 'primary', color: 'background', radius: 12, weight: 600 },
        },
    ]),
} satisfies Record<string, () => Section>;

export type SectionTemplateKey = keyof typeof sections;

export const SECTION_TEMPLATES: readonly { key: SectionTemplateKey; name: MessageKey }[] = [
    { key: 'hero', name: 'template.hero' },
    { key: 'features', name: 'template.features' },
    { key: 'about', name: 'template.about' },
    { key: 'cta', name: 'template.cta' },
    { key: 'contact', name: 'template.contact' },
    { key: 'footer', name: 'template.footer' },
];

const pages = {
    full: ['hero', 'features', 'about', 'cta', 'footer'],
    simple: ['hero', 'features', 'contact', 'footer'],
    landing: ['hero', 'cta', 'contact', 'footer'],
} as const satisfies Record<string, readonly SectionTemplateKey[]>;

export type PageTemplateKey = keyof typeof pages;

export const PAGE_TEMPLATES: readonly { key: PageTemplateKey; name: MessageKey; note: MessageKey }[] = [
    { key: 'full', name: 'pageTemplate.full', note: 'pageTemplate.full.note' },
    { key: 'simple', name: 'pageTemplate.simple', note: 'pageTemplate.simple.note' },
    { key: 'landing', name: 'pageTemplate.landing', note: 'pageTemplate.landing.note' },
];

export const buildSectionTemplate = (key: SectionTemplateKey): Section => sections[key]();

export const buildPageTemplate = (key: PageTemplateKey): Section[] => pages[key].map((section) => sections[section]());
