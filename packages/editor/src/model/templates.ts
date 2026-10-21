import type { Box, CoreElement, CoreElementType, Section } from '@skylivellc/lienzo-core';
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


const plan = (x: number, name: string, price: string, lines: string, featured: boolean): Part[] => [
    { type: 'shape', box: { x: x - 1.5, y: 150, w: 29, h: 330 }, props: { shape: 'rectangle' }, style: { background: featured ? 'secondary' : 'surface', radius: 18 } },
    { type: 'heading', box: { x, y: 182, w: 26, h: 34 }, props: { text: name, level: 3 }, style: { color: featured ? 'background' : 'secondary', font: 'heading', size: 19, weight: 700 } },
    { type: 'heading', box: { x, y: 220, w: 26, h: 56 }, props: { text: price, level: 3 }, style: { color: featured ? 'background' : 'secondary', font: 'heading', size: 40, weight: 700 } },
    { type: 'text', box: { x, y: 288, w: 26, h: 120 }, props: { text: lines }, style: { color: featured ? 'background' : 'muted', size: 15, line_height: 1.8, opacity: featured ? 0.85 : 1 } },
    {
        type: 'button', box: { x, y: 414, w: 26, h: 48 },
        props: { label: 'Choose this one', action: { type: 'anchor', value: '' } },
        style: { background: featured ? 'background' : 'primary', color: featured ? 'secondary' : 'background', radius: 12, weight: 600, size: 15 },
    },
];

const step = (x: number, number: string, title: string, text: string): Part[] => [
    { type: 'heading', box: { x, y: 150, w: 26, h: 60 }, props: { text: number, level: 3 }, style: { color: 'primary', font: 'heading', size: 46, weight: 700 } },
    { type: 'heading', box: { x, y: 216, w: 26, h: 34 }, props: { text: title, level: 3 }, style: { color: 'secondary', font: 'heading', size: 19, weight: 700 } },
    { type: 'text', box: { x, y: 254, w: 26, h: 90 }, props: { text }, style: { color: 'muted', size: 15, line_height: 1.6 } },
];

const person = (x: number, name: string, role: string): Part[] => [
    { type: 'image', box: { x, y: 150, w: 20, h: 200 }, props: { src: '', alt: name }, style: { radius: 16, object_fit: 'cover' } },
    { type: 'heading', box: { x, y: 362, w: 20, h: 30 }, props: { text: name, level: 3 }, style: { color: 'secondary', font: 'heading', size: 17, weight: 700 } },
    { type: 'text', box: { x, y: 394, w: 20, h: 28 }, props: { text: role }, style: { color: 'muted', size: 14 } },
];

const question = (y: number, ask: string, answer: string): Part[] => [
    { type: 'heading', box: { x: 6, y, w: 42, h: 32 }, props: { text: ask, level: 3 }, style: { color: 'secondary', font: 'heading', size: 18, weight: 700 } },
    { type: 'text', box: { x: 52, y, w: 42, h: 76 }, props: { text: answer }, style: { color: 'muted', size: 15, line_height: 1.6 } },
    { type: 'divider', box: { x: 6, y: y + 88, w: 88, h: 2 }, props: {}, style: { color: 'muted', opacity: 0.25 } },
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

    heroCentered: () => build(620, color('background'), [
        {
            type: 'heading', box: { x: 18, y: 170, w: 64, h: 150 },
            props: { text: 'One line that says what you do', level: 1 },
            style: { color: 'secondary', font: 'heading', size: 52, weight: 700, align: 'center', line_height: 1.1 },
        },
        {
            type: 'text', box: { x: 26, y: 336, w: 48, h: 80 },
            props: { text: 'A second line for who it is for and what they get.' },
            style: { color: 'muted', size: 18, align: 'center', line_height: 1.6 },
        },
        {
            type: 'button', box: { x: 34, y: 440, w: 15, h: 54 },
            props: { label: 'Get started', action: { type: 'anchor', value: '' } },
            style: { background: 'primary', color: 'background', radius: 14, weight: 700, size: 16 },
        },
        {
            type: 'button', box: { x: 51, y: 440, w: 15, h: 54 },
            props: { label: 'See how it works', action: { type: 'anchor', value: '' } },
            style: { background: '', color: 'secondary', border_width: 1, border_color: 'muted', radius: 14, weight: 600, size: 16 },
        },
    ]),
    heroSlider: () => build(640, color('surface'), [
        {
            type: 'heading', box: { x: 6, y: 180, w: 38, h: 160 },
            props: { text: 'Show the work, not a promise', level: 1 },
            style: { color: 'secondary', font: 'heading', size: 46, weight: 700, line_height: 1.1 },
        },
        {
            type: 'text', box: { x: 6, y: 356, w: 32, h: 80 },
            props: { text: 'Pictures move by themselves, or the reader moves them.' },
            style: { color: 'muted', size: 17, line_height: 1.6 },
        },
        { type: 'slider', box: { x: 46, y: 120, w: 48, h: 400 }, props: { images: [], autoplay: true, interval: 5 }, style: { radius: 20, object_fit: 'cover' } },
    ]),
    logos: () => build(300, color('background'), [
        {
            type: 'text', box: { x: 6, y: 72, w: 88, h: 34 },
            props: { text: 'Teams that work with us' },
            style: { color: 'muted', size: 15, align: 'center' },
        },
        { type: 'gallery', box: { x: 6, y: 128, w: 88, h: 110 }, props: { images: [], layout: 'strip' }, style: { radius: 8 } },
    ]),
    testimonial: () => build(460, color('secondary'), [
        {
            type: 'heading', box: { x: 12, y: 130, w: 76, h: 170 },
            props: { text: '"They shipped in three weeks what we had been postponing for a year."', level: 2 },
            style: { color: 'background', font: 'heading', size: 36, weight: 700, align: 'center', line_height: 1.3 },
        },
        {
            type: 'text', box: { x: 26, y: 326, w: 48, h: 60 },
            props: { text: 'Name Surname, role at Company' },
            style: { color: 'background', size: 15, align: 'center', opacity: 0.75 },
        },
    ]),
    stats: () => ({
        ...build(340, color('surface'), [
            { type: 'heading', box: { x: 6, y: 0, w: 100, h: 44 }, props: { text: 'Three numbers worth knowing', level: 2 }, style: { color: 'secondary', font: 'heading', size: 30, weight: 700 } },
            { type: 'heading', box: { x: 6, y: 80, w: 28, h: 80 }, props: { text: '600', level: 3 }, style: { color: 'primary', font: 'heading', size: 54, weight: 700 } },
            { type: 'heading', box: { x: 36, y: 80, w: 28, h: 80 }, props: { text: '23 %', level: 3 }, style: { color: 'primary', font: 'heading', size: 54, weight: 700 } },
            { type: 'heading', box: { x: 66, y: 80, w: 28, h: 80 }, props: { text: '0', level: 3 }, style: { color: 'primary', font: 'heading', size: 54, weight: 700 } },
        ]),
        flow: 'row' as const,
        flow_gap: 32,
        flow_align: 'between' as const,
    }),
    gallery: () => ({
        ...build(520, color('background'), [
            { type: 'heading', box: { x: 6, y: 0, w: 60, h: 46 }, props: { text: 'A look at the work', level: 2 }, style: { color: 'secondary', font: 'heading', size: 32, weight: 700 } },
            { type: 'gallery', box: { x: 6, y: 80, w: 88, h: 320 }, props: { images: [], layout: 'grid', columns: 3 }, style: { radius: 12 } },
        ]),
        flow: 'column' as const,
        flow_gap: 24,
    }),
    steps: () => build(440, color('background'), [
        { type: 'heading', box: { x: 6, y: 72, w: 60, h: 46 }, props: { text: 'How it works', level: 2 }, style: { color: 'secondary', font: 'heading', size: 32, weight: 700 } },
        ...step(6, '1', 'You write to us', 'Tell us what you need and when you need it.'),
        ...step(37, '2', 'We answer with a plan', 'A date, a price and what is included.'),
        ...step(68, '3', 'We start', 'You see progress every week, not at the end.'),
    ]),
    pricing: () => build(560, color('background'), [
        { type: 'heading', box: { x: 6, y: 72, w: 60, h: 46 }, props: { text: 'Plans', level: 2 }, style: { color: 'secondary', font: 'heading', size: 32, weight: 700 } },
        ...plan(8, 'Start', '$19', 'One site\nOne editor\nEmail support', false),
        ...plan(38, 'Studio', '$49', 'Five sites\nFive editors\nSupport in a day', true),
        ...plan(68, 'Agency', '$99', 'Sites without a limit\nYour own domain\nSupport in an hour', false),
    ]),
    team: () => build(500, color('surface'), [
        { type: 'heading', box: { x: 6, y: 72, w: 60, h: 46 }, props: { text: 'Who you will work with', level: 2 }, style: { color: 'secondary', font: 'heading', size: 32, weight: 700 } },
        ...person(6, 'Name Surname', 'What they do'),
        ...person(29, 'Name Surname', 'What they do'),
        ...person(52, 'Name Surname', 'What they do'),
        ...person(75, 'Name Surname', 'What they do'),
    ]),
    faq: () => build(620, color('background'), [
        { type: 'heading', box: { x: 6, y: 72, w: 60, h: 46 }, props: { text: 'Questions people ask', level: 2 }, style: { color: 'secondary', font: 'heading', size: 32, weight: 700 } },
        ...question(160, 'How long does it take?', 'Two to four weeks, counted from the day the content is ready.'),
        ...question(270, 'What do you need from me?', 'Texts, pictures and someone who can decide.'),
        ...question(380, 'Can I edit it later?', 'Yes. The site is yours and it is edited here, without us.'),
        ...question(490, 'What if I do not like it?', 'You see it before it is published, and we change it.'),
    ]),
    newsletter: () => build(360, color('primary'), [
        {
            type: 'heading', box: { x: 6, y: 110, w: 42, h: 90 },
            props: { text: 'News, once a month', level: 2 },
            style: { color: 'background', font: 'heading', size: 34, weight: 700, line_height: 1.2 },
        },
        {
            type: 'text', box: { x: 6, y: 208, w: 36, h: 60 },
            props: { text: 'What we made, what we learned. Nothing else.' },
            style: { color: 'background', size: 16, opacity: 0.85 },
        },
        {
            type: 'input', box: { x: 52, y: 140, w: 28, h: 78 },
            props: { label: 'Email', placeholder: 'you@example.com', required: true, input_type: 'email' },
            style: { color: 'background', background: '', border_width: 1, border_color: 'background', radius: 12, padding: 14 },
        },
        {
            type: 'button', box: { x: 82, y: 156, w: 12, h: 50 },
            props: { label: 'Sign up', action: { type: 'submit', value: '' } },
            style: { background: 'background', color: 'primary', radius: 12, weight: 700, size: 15 },
        },
    ]),
    footerBig: () => build(420, color('secondary'), [
        { type: 'heading', box: { x: 6, y: 72, w: 24, h: 46 }, props: { text: 'Your brand', level: 3 }, style: { color: 'background', font: 'heading', size: 26, weight: 700 } },
        {
            type: 'text', box: { x: 6, y: 128, w: 24, h: 90 },
            props: { text: 'One line about what you do and where you are.' },
            style: { color: 'background', size: 15, line_height: 1.6, opacity: 0.7 },
        },
        { type: 'text', box: { x: 38, y: 72, w: 18, h: 150 }, props: { text: 'Site\nHome\nWork\nPrices\nContact' }, style: { color: 'background', size: 15, line_height: 2, opacity: 0.8 } },
        { type: 'text', box: { x: 58, y: 72, w: 18, h: 150 }, props: { text: 'Company\nAbout us\nTeam\nNews' }, style: { color: 'background', size: 15, line_height: 2, opacity: 0.8 } },
        { type: 'text', box: { x: 78, y: 72, w: 18, h: 150 }, props: { text: 'Write to us\nhello@example.com\n+00 000 000 0000' }, style: { color: 'background', size: 15, line_height: 2, opacity: 0.8 } },
        { type: 'divider', box: { x: 6, y: 300, w: 88, h: 2 }, props: {}, style: { color: 'background', opacity: 0.25 } },
        { type: 'text', box: { x: 6, y: 324, w: 50, h: 40 }, props: { text: 'All rights reserved' }, style: { color: 'background', size: 13, opacity: 0.6 } },
    ]),
} satisfies Record<string, () => Section>;

export type SectionTemplateKey = keyof typeof sections;

export type TemplateGroup = 'open' | 'tell' | 'convince' | 'close';

export const SECTION_TEMPLATES: readonly { key: SectionTemplateKey; name: MessageKey; group: TemplateGroup }[] = [
    { key: 'hero', name: 'template.hero', group: 'open' },
    { key: 'heroCentered', name: 'template.heroCentered', group: 'open' },
    { key: 'heroSlider', name: 'template.heroSlider', group: 'open' },
    { key: 'features', name: 'template.features', group: 'tell' },
    { key: 'about', name: 'template.about', group: 'tell' },
    { key: 'steps', name: 'template.steps', group: 'tell' },
    { key: 'gallery', name: 'template.gallery', group: 'tell' },
    { key: 'faq', name: 'template.faq', group: 'tell' },
    { key: 'logos', name: 'template.logos', group: 'convince' },
    { key: 'testimonial', name: 'template.testimonial', group: 'convince' },
    { key: 'stats', name: 'template.stats', group: 'convince' },
    { key: 'team', name: 'template.team', group: 'convince' },
    { key: 'pricing', name: 'template.pricing', group: 'convince' },
    { key: 'cta', name: 'template.cta', group: 'close' },
    { key: 'newsletter', name: 'template.newsletter', group: 'close' },
    { key: 'contact', name: 'template.contact', group: 'close' },
    { key: 'footer', name: 'template.footer', group: 'close' },
    { key: 'footerBig', name: 'template.footerBig', group: 'close' },
];

export const TEMPLATE_GROUPS: readonly { key: TemplateGroup; name: MessageKey }[] = [
    { key: 'open', name: 'template.group.open' },
    { key: 'tell', name: 'template.group.tell' },
    { key: 'convince', name: 'template.group.convince' },
    { key: 'close', name: 'template.group.close' },
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
