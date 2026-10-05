import {
    DocumentError,
    parseDocument,
    parseSiteSettings,
    type Catalog,
    type Document,
    type Element,
    type Issue,
    type Modal,
    type Parsed,
    type Section,
    type Seo,
    type SiteSettings,
    type Theme,
} from '@skylivellc/lienzo-core';
import type { Asset, PageState, PageSummary, PageVersion, SiteUpdate, Workspace } from '@skylivellc/lienzo-core/protocol';
import { computed, inject, reactive, shallowRef, watch, type InjectionKey, type WritableComputedRef } from 'vue';
import type { Client, Failure } from '../client.ts';
import type { Translator } from '../i18n/index.ts';
import {
    boxOf,
    canvasesOf,
    canvasHeight,
    copyElement,
    emptyModal,
    emptySection,
    findCanvas,
    isModal,
    MOBILE_WIDTH,
    newId,
    plain,
    stacksOnMobile,
    writeBox,
    type Canvas,
    type Device,
} from '../model/document.ts';
import { createElement, kindOf, type Insertable } from '../model/elements.ts';
import {
    alignInCanvas,
    alignTogether,
    backLayer,
    clampBox,
    distribute,
    fitHeight,
    frontLayer,
    snap,
    stackForMobile,
    type Alignment,
} from '../model/geometry.ts';
import { createHistory } from '../model/history.ts';
import { buildPageTemplate, type PageTemplateKey } from '../model/templates.ts';
import { createAutosave } from './autosave.ts';
import { createPreviews } from './previews.ts';

/** What the canvas shows: the page's sections, or one modal's content. */
export type View = { kind: 'page' } | { kind: 'modal'; id: string };

/**
 * What is selected. Elements always belong to one canvas; the active one is
 * the element the settings panel edits (the last one clicked).
 */
export type Selection =
    | { kind: 'none' }
    | { kind: 'canvas'; canvas: string }
    | { kind: 'elements'; canvas: string; ids: string[]; active: string };

export type Dialog = 'newPage' | 'versions' | 'theme' | 'site' | 'submissions' | 'conflict' | null;

export type Toast = { id: number; tone: 'info' | 'error'; text: string };

/** The page being edited, minus its draft. */
export type OpenPage = { id: number; slug: string; title: string; publishedAt: string | null; seo: { title: string; description: string }; versions: PageVersion[] };

export type Load = { kind: 'loading' } | { kind: 'failed'; message: string } | { kind: 'empty' } | { kind: 'ready' };

const CLIPBOARD_KEY = 'lienzo-editor-clipboard';

export type EditorDeps = { client: Client; i18n: Translator };

export type Editor = ReturnType<typeof createEditor>;

export const editorKey: InjectionKey<Editor> = Symbol('lienzo-editor');

export function useEditor(): Editor {
    const editor = inject(editorKey);

    if (!editor) {
        throw new Error('useEditor() outside <LienzoEditor>');
    }

    return editor;
}

export type EditorState = {
    load: Load;
    workspace: Workspace;
    page: OpenPage | null;
    draft: Document;
    revision: number;
    device: Device;
    view: View;
    selection: Selection;
    previewing: boolean;
    dialog: Dialog;
    /** The media library, open on top of anything else; picking calls `onPick`. */
    library: { onPick: ((ref: string) => void) | null } | null;
    /** Theme being edited in the theme dialog: the canvas shows it live until saved or cancelled. */
    themeDraft: Theme | null;
    /** Visible panel per tab or step group on the canvas. */
    panels: Record<string, number>;
    /** Issues of a draft that does not parse, so the canvas shows the last good render. */
    renderIssues: Issue[];
    publishing: boolean;
    toasts: Toast[];
};

/**
 * All editor state and the operations on it. Panels and canvas gestures
 * edit the draft in place and call `commit` to record an undo step;
 * structural changes (adding, removing, moving things) go through these methods.
 */
export function createEditor({ client, i18n }: EditorDeps) {
    const t = i18n.t;
    const state = reactive<EditorState>({
        load: { kind: 'loading' },
        workspace: {
            site: parseSiteSettings({ name: 'Lienzo' }),
            meta: {},
            publicUrl: null,
            pages: [],
            catalog: { elements: [], actions: [] },
            assets: [],
            quota: { used: 0, limit: 0 },
        },
        page: null,
        draft: { sections: [] },
        revision: 0,
        device: 'desktop',
        view: { kind: 'page' },
        selection: { kind: 'none' },
        previewing: false,
        dialog: null,
        library: null,
        themeDraft: null,
        panels: {},
        renderIssues: [],
        publishing: false,
        toasts: [],
    });

    const history = createHistory('');
    const historyTick = shallowRef(0);
    const previews = createPreviews(client);

    /** Everything autosaved: the open page's title, SEO and draft. */
    const autosave = createAutosave({
        read: () => plain({ page: state.page?.id ?? null, title: state.page?.title ?? '', seo: state.page?.seo ?? { title: '', description: '' }, draft: state.draft }),
        async save(value) {
            if (value.page === null) {
                return { ok: true };
            }

            const result = await client('PUT /pages/:id', { id: value.page }, {
                baseRevision: state.revision,
                title: value.title,
                seo: blankToNull(value.seo),
                draft: value.draft,
            });

            // Another page may have opened meanwhile; its revision is not this one's.
            if (state.page?.id !== value.page) {
                return { ok: true };
            }

            if (result.ok) {
                state.revision = result.value.revision;

                return { ok: true };
            }

            if (result.failure.kind === 'conflict') {
                state.dialog = 'conflict';
            }

            return result;
        },
    });

    watch(() => [state.page?.title, state.page?.seo, state.draft], () => autosave.changed(), { deep: true });
    // The page list follows title edits of the open page.
    watch(() => state.page?.title, syncSummary);

    const catalog = computed<Catalog>(() => state.workspace.catalog);
    /**
     * Site settings as core renders them, with the theme being edited, if any.
     * A half-typed color does not parse; the last valid settings stay until it does.
     */
    const site = computed<Parsed<SiteSettings>>((previous) => {
        try {
            return parseSiteSettings({ ...state.workspace.site, theme: state.themeDraft ?? state.workspace.site.theme });
        } catch (error) {
            if (error instanceof DocumentError && previous) {
                return previous;
            }

            throw error;
        }
    });
    const theme = computed<Theme>(() => site.value.theme);

    /** Canvases on screen: the page's sections, or the open modal. */
    const canvases = computed<Canvas[]>(() => {
        if (state.view.kind === 'modal') {
            const modal = state.draft.modals?.find((candidate) => candidate.id === (state.view.kind === 'modal' ? state.view.id : ''));

            return modal ? [modal] : [];
        }

        return state.draft.sections;
    });

    const activeModal = computed<Modal | null>(() => {
        const view = state.view;

        return view.kind === 'modal' ? (state.draft.modals?.find((modal) => modal.id === view.id) ?? null) : null;
    });

    /** The canvas new elements go to: the selected one, else the first on screen. */
    const currentCanvas = computed<Canvas | null>(() => {
        const selection = state.selection;
        const selected = selection.kind === 'none' ? null : findCanvas(state.draft, selection.canvas);

        return selected ?? canvases.value[0] ?? null;
    });

    const selectedElements = computed<Element[]>(() => {
        const selection = state.selection;

        if (selection.kind !== 'elements') {
            return [];
        }

        return findCanvas(state.draft, selection.canvas)?.elements.filter((element) => selection.ids.includes(element.id)) ?? [];
    });

    const activeElement = computed<Element | null>(() => {
        const selection = state.selection;

        return selection.kind === 'elements' ? (selectedElements.value.find((element) => element.id === selection.active) ?? null) : null;
    });

    /** Design width of the frame on screen. */
    const frameWidth = computed(() => {
        const modal = activeModal.value;

        if (state.device === 'mobile') {
            return MOBILE_WIDTH;
        }

        return modal ? modal.width + (modal.size === 'full' ? 0 : 32) : theme.value.max_width;
    });

    let toastId = 0;

    function notify(text: string, tone: Toast['tone'] = 'info') {
        const toast = { id: ++toastId, tone, text };
        state.toasts.push(toast);
        setTimeout(() => dismiss(toast.id), tone === 'error' ? 8000 : 3500);
    }

    function dismiss(id: number) {
        state.toasts = state.toasts.filter((toast) => toast.id !== id);
    }

    const failureText = (failure: Failure): string => (failure.kind === 'offline' ? t('load.offline') : failure.message);

    async function load() {
        state.load = { kind: 'loading' };
        const result = await client('GET /');

        if (!result.ok) {
            state.load = { kind: 'failed', message: failureText(result.failure) };

            return;
        }

        try {
            parseSiteSettings(result.value.site);
        } catch (error) {
            if (error instanceof DocumentError) {
                state.load = { kind: 'failed', message: issueText(error.issues[0]) };

                return;
            }

            throw error;
        }

        state.workspace = result.value;
        const first = result.value.pages[0];

        if (!first) {
            state.load = { kind: 'empty' };
            state.dialog = 'newPage';

            return;
        }

        await openPage(first.id);
    }

    /** Loads a page into the editor, replacing the draft and its history. */
    async function loadPage(id: number): Promise<boolean> {
        const result = await client('GET /pages/:id', { id });

        if (!result.ok) {
            state.load = { kind: 'failed', message: failureText(result.failure) };

            return false;
        }

        return adoptPage(result.value);
    }

    function adoptPage(page: PageState): boolean {
        let draft: Document;

        try {
            draft = plain(parseDocument(page.draft, catalog.value));
        } catch (error) {
            if (error instanceof DocumentError) {
                state.load = { kind: 'failed', message: t('load.invalidDraft', { issue: issueText(error.issues[0]) }) };

                return false;
            }

            throw error;
        }

        state.page = {
            id: page.id,
            slug: page.slug,
            title: page.title,
            publishedAt: page.publishedAt,
            seo: { title: page.seo.title ?? '', description: page.seo.description ?? '' },
            versions: page.versions,
        };
        state.draft = draft;
        state.revision = page.revision;
        state.view = { kind: 'page' };
        state.selection = draft.sections[0] ? { kind: 'canvas', canvas: draft.sections[0].id } : { kind: 'none' };
        state.panels = {};
        state.load = { kind: 'ready' };
        history.reset(JSON.stringify(draft));
        historyTick.value++;
        autosave.reset();
        syncSummary();

        return true;
    }

    /** Keeps the page list in step with the open page's title, address and publish date. */
    function syncSummary() {
        const page = state.page;

        if (!page) {
            return;
        }

        state.workspace.pages = state.workspace.pages.map((summary): PageSummary =>
            summary.id === page.id ? { id: page.id, slug: page.slug, title: page.title, publishedAt: page.publishedAt } : summary);
    }

    /** Switching pages saves what is pending first; if that fails, the editor stays put. */
    async function openPage(id: number) {
        if (state.page?.id === id) {
            return;
        }

        if (state.page && !(await autosave.flush())) {
            notify(t('save.failed', { message: saveProblem() }), 'error');

            return;
        }

        await loadPage(id);
    }

    function saveProblem(): string {
        const current = autosave.state.value;

        switch (current.kind) {
            case 'offline':
                return t('load.offline');
            case 'failed':
            case 'invalid':
                return current.message;
            case 'conflict':
                return t('save.conflict');
            default:
                return '';
        }
    }

    async function reloadPage() {
        if (state.page) {
            state.dialog = null;
            await loadPage(state.page.id);
        }
    }

    /** Records the draft after a discrete edit, for undo. Saving follows the draft by itself. */
    function commit() {
        if (history.push(JSON.stringify(state.draft))) {
            historyTick.value++;
        }
    }

    function restoreFrom(json: string | null) {
        if (json === null) {
            return;
        }

        state.draft = JSON.parse(json) as Document;
        historyTick.value++;
        keepSelectionValid();
    }

    const canUndo = computed(() => historyTick.value >= 0 && history.canUndo);
    const canRedo = computed(() => historyTick.value >= 0 && history.canRedo);

    /** After undo or a restore, drops selected things that no longer exist. */
    function keepSelectionValid() {
        const selection = state.selection;

        if (selection.kind === 'none') {
            return;
        }

        const canvas = findCanvas(state.draft, selection.canvas);

        if (!canvas) {
            state.selection = { kind: 'none' };
        } else if (selection.kind === 'elements') {
            const ids = selection.ids.filter((id) => canvas.elements.some((element) => element.id === id));
            state.selection = ids.length === 0
                ? { kind: 'canvas', canvas: canvas.id }
                : { kind: 'elements', canvas: canvas.id, ids, active: ids.includes(selection.active) ? selection.active : ids[0]! };
        }

        if (state.view.kind === 'modal' && !activeModal.value) {
            state.view = { kind: 'page' };
        }
    }

    function selectCanvas(canvasId: string) {
        state.selection = { kind: 'canvas', canvas: canvasId };
        revealSection(canvasId);
    }

    /** Selects an element (and its group). With `additive`, toggles it in the current selection. */
    function select(canvasId: string, elementId: string, additive = false) {
        const canvas = findCanvas(state.draft, canvasId);
        const clicked = canvas?.elements.find((element) => element.id === elementId);

        if (!canvas || !clicked) {
            return;
        }

        const family = clicked.group ? canvas.elements.filter((element) => element.group === clicked.group).map((element) => element.id) : [elementId];
        const current = state.selection.kind === 'elements' && state.selection.canvas === canvasId ? state.selection.ids : [];
        const ids = !additive
            ? family
            : current.includes(elementId)
                ? current.filter((id) => !family.includes(id))
                : [...new Set([...current, ...family])];

        state.selection = ids.length === 0
            ? { kind: 'canvas', canvas: canvasId }
            : { kind: 'elements', canvas: canvasId, ids, active: ids.includes(elementId) ? elementId : ids[0]! };
        revealSection(canvasId);
    }

    function clearSelection() {
        const selection = state.selection;
        state.selection = selection.kind === 'elements' ? { kind: 'canvas', canvas: selection.canvas } : selection;
    }

    /** A section inside a tab or step group shows its panel when selected. */
    function revealSection(canvasId: string) {
        const sections = state.draft.sections;
        const index = sections.findIndex((section) => section.id === canvasId);
        const groupId = sections[index]?.group?.id;

        if (index < 0 || !groupId) {
            return;
        }

        let start = index;

        while (start > 0 && sections[start - 1]?.group?.id === groupId) {
            start--;
        }

        state.panels = { ...state.panels, [groupId]: index - start };
    }

    /** Adds an element to the current canvas, or at a drop point in a given canvas. */
    function addElement(insertable: Insertable, at?: { canvas: string; x: number; y: number }, src?: string) {
        const target = at ? findCanvas(state.draft, at.canvas) : currentCanvas.value;

        if (!target) {
            return;
        }

        const element = createElement(insertable, at ? at.y : target.elements.length * 24 + 40, t);

        if (src) {
            element.props = { ...element.props, src };
        }

        if (at) {
            element.layout.desktop = { ...element.layout.desktop, x: Math.round(at.x * 2) / 2, y: snap(at.y) };
        }

        element.z = target.elements.length + 1;
        target.elements.push(element);
        state.selection = { kind: 'elements', canvas: target.id, ids: [element.id], active: element.id };
        commit();
    }

    function removeSelected() {
        const selection = state.selection;

        if (selection.kind !== 'elements') {
            return;
        }

        const canvas = findCanvas(state.draft, selection.canvas);

        if (canvas) {
            canvas.elements = canvas.elements.filter((element) => !selection.ids.includes(element.id) || element.locked === true);
            state.selection = { kind: 'canvas', canvas: canvas.id };
            commit();
        }
    }

    function duplicateSelected() {
        const selection = state.selection;
        const canvas = selection.kind === 'elements' ? findCanvas(state.draft, selection.canvas) : undefined;

        if (!canvas || selectedElements.value.length === 0) {
            return;
        }

        pasteInto(canvas, selectedElements.value);
    }

    /** Copies get new ids, their own groups and the top layers, so they never tie back to the originals. */
    function pasteInto(canvas: Canvas, elements: readonly Element[]) {
        const groups = new Map<string, string>();
        const top = Math.max(0, ...canvas.elements.map((element) => element.z));
        const copies = elements.map((element, index) => {
            const copy = copyElement(element);
            const group = copy.group ? (groups.get(copy.group) ?? groups.set(copy.group, newId('group')).get(copy.group)) : null;

            return { ...copy, group, z: Math.min(999, top + index + 1) };
        });
        canvas.elements.push(...copies);
        state.selection = { kind: 'elements', canvas: canvas.id, ids: copies.map((copy) => copy.id), active: copies[0]!.id };
        commit();
    }

    /** The clipboard lives in the browser, so it works across sections and pages. */
    function copySelected() {
        const elements = selectedElements.value;

        if (elements.length === 0) {
            return;
        }

        try {
            window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(elements));
            notify(elements.length === 1 ? t('toast.copied') : t('toast.copiedMany', { n: elements.length }));
        } catch {
            notify(t('toast.copyFailed'), 'error');
        }
    }

    function paste() {
        const target = currentCanvas.value;
        let elements: Element[] = [];

        try {
            const stored: unknown = JSON.parse(window.localStorage.getItem(CLIPBOARD_KEY) ?? '[]');
            elements = Array.isArray(stored) ? stored.filter((candidate) => parsesAsElement(candidate, catalog.value)) : [];
        } catch {
            elements = [];
        }

        if (!target || elements.length === 0) {
            return;
        }

        pasteInto(target, elements);
        notify(t('toast.pasted'));
    }

    function layer(step: 'front' | 'back') {
        const element = activeElement.value;
        const canvas = currentCanvas.value;

        if (!element || !canvas) {
            return;
        }

        const others = canvas.elements.filter((other) => other.id !== element.id).map((other) => other.z);
        element.z = step === 'front' ? frontLayer(others) : backLayer(others);
        commit();
    }

    /** One element aligns inside its canvas; several align against their joint box. */
    function align(where: Alignment) {
        const elements = selectedElements.value;
        const canvas = currentCanvas.value;

        if (elements.length === 0 || !canvas) {
            return;
        }

        if (elements.length === 1) {
            writeBox(elements[0]!, state.device, alignInCanvas(boxOf(elements[0]!, state.device), where, canvasHeight(canvas, state.device)));
        } else {
            alignTogether(elements.map((element) => boxOf(element, state.device)), where)
                .forEach((box, index) => writeBox(elements[index]!, state.device, box));
        }

        commit();
    }

    function distributeSelected(axis: 'x' | 'y') {
        const elements = selectedElements.value;

        distribute(elements.map((element) => boxOf(element, state.device)), axis)
            .forEach((box, index) => writeBox(elements[index]!, state.device, box));
        commit();
    }

    function groupSelected() {
        const id = newId('group');
        selectedElements.value.forEach((element) => (element.group = id));
        commit();
    }

    function ungroupSelected() {
        selectedElements.value.forEach((element) => (element.group = null));
        commit();
    }

    function toggleLock() {
        const elements = selectedElements.value;
        const locking = elements.some((element) => !element.locked);
        elements.forEach((element) => (element.locked = locking));
        commit();
    }

    /** Arrow keys: 1 design pixel down or up, 0.5% across; callers pass ten steps with Shift. Like dragging, not where phones stack. */
    function nudge(dx: number, dy: number) {
        const canvas = currentCanvas.value;

        if (!canvas || (state.device === 'mobile' && stacksOnMobile(canvas))) {
            return;
        }

        const elements = selectedElements.value.filter((element) => !element.locked);

        for (const element of elements) {
            const box = boxOf(element, state.device);
            writeBox(element, state.device, clampBox({ ...box, x: box.x + dx * 0.5, y: box.y + dy }));
        }

        if (elements.length > 0) {
            commit();
        }
    }

    /** Writes boxes a canvas gesture produced, then records one undo step. */
    function placeElements(boxes: readonly { id: string; box: Element['layout']['desktop'] }[]) {
        const canvas = currentCanvas.value;

        for (const { id, box } of boxes) {
            const element = canvas?.elements.find((candidate) => candidate.id === id);

            if (element) {
                writeBox(element, state.device, box);
            }
        }

        commit();
    }

    function addSection(section: Section = emptySection()) {
        state.draft.sections.push(section);
        state.view = { kind: 'page' };
        state.selection = { kind: 'canvas', canvas: section.id };
        commit();
    }

    /** Starts the page from a full template, replacing its sections. */
    function applyPageTemplate(key: PageTemplateKey) {
        const sections = buildPageTemplate(key);
        state.draft.sections = sections;
        state.selection = { kind: 'canvas', canvas: sections[0]!.id };
        commit();
    }

    function removeSection(id: string) {
        if (state.draft.sections.length <= 1) {
            return;
        }

        state.draft.sections = state.draft.sections.filter((section) => section.id !== id);
        state.selection = { kind: 'canvas', canvas: state.draft.sections[0]!.id };
        commit();
    }

    function moveSection(index: number, step: -1 | 1) {
        const sections = state.draft.sections;
        const target = index + step;
        const [moving, other] = [sections[index], sections[target]];

        if (!moving || !other) {
            return;
        }

        sections.splice(index, 1, other);
        sections.splice(target, 1, moving);
        commit();
    }

    /**
     * Chains a section to the one before it as a tab or a step. When the one
     * before is not grouped yet, the group starts with both. A group has one
     * type, so choosing tabs or steps sets it for the whole group. An empty
     * label renders as "Tab n" or "Step n" by position.
     */
    function setSectionGroup(section: Section, mode: 'alone' | 'tabs' | 'steps') {
        const sections = state.draft.sections;
        const index = sections.indexOf(section);

        if (mode === 'alone') {
            section.group = null;
            commit();

            return;
        }

        const previous = sections[index - 1];
        const id = previous?.group?.id || newId('group');

        if (previous && !previous.group?.id) {
            previous.group = { id, type: mode, label: '' };
        }

        section.group = { id, type: mode, label: section.group?.id === id ? (section.group.label ?? '') : '' };
        sections.filter((candidate) => candidate.group?.id === id).forEach((member) => {
            member.group = { ...member.group, id, type: mode };
        });
        commit();
    }

    function fitCanvas(canvas: Canvas) {
        canvas.height.desktop = Math.min(isModal(canvas) ? 2000 : 3000, fitHeight(canvas.elements.map((element) => element.layout.desktop)));
        commit();
    }

    /** Gives every element of the canvas its own phone box, stacked in reading order. */
    function generateMobile(canvas: Canvas) {
        const reference = isModal(canvas) ? canvas.width : theme.value.max_width;
        const { boxes, height } = stackForMobile(
            canvas.elements.map((element) => ({ desktop: element.layout.desktop, text: element.type === 'text' })),
            reference,
            MOBILE_WIDTH,
        );

        canvas.elements.forEach((element, index) => (element.layout.mobile = boxes[index] ?? null));
        canvas.height.mobile = Math.min(isModal(canvas) ? 2400 : 4000, height);
        commit();
        notify(t('toast.mobileGenerated'));
    }

    function addModal() {
        const modal = emptyModal(t('modals.defaultTitle'));
        state.draft.modals = [...(state.draft.modals ?? []), modal];
        commit();
        openModal(modal.id);
    }

    function openModal(id: string | null) {
        state.view = id ? { kind: 'modal', id } : { kind: 'page' };
        state.selection = id ? { kind: 'canvas', canvas: id } : state.draft.sections[0] ? { kind: 'canvas', canvas: state.draft.sections[0].id } : { kind: 'none' };
    }

    function removeModal(id: string) {
        state.draft.modals = (state.draft.modals ?? []).filter((modal) => modal.id !== id);

        if (state.view.kind === 'modal' && state.view.id === id) {
            openModal(null);
        }

        commit();
    }

    const undo = () => restoreFrom(history.undo());
    const redo = () => restoreFrom(history.redo());

    /** Saves now; the toolbar shows how it went. */
    async function saveNow() {
        await autosave.flush();
    }

    async function publish() {
        const page = state.page;

        if (!page || state.publishing) {
            return;
        }

        state.publishing = true;

        try {
            if (!(await autosave.flush())) {
                notify(t('publish.failed', { message: saveProblem() }), 'error');

                return;
            }

            const result = await autosave.exclusive(async () => {
                const response = await client('POST /pages/:id/publish', { id: page.id }, { revision: state.revision });

                if (response.ok) {
                    page.publishedAt = response.value.publishedAt;
                    page.versions = response.value.versions;
                }

                return response;
            });

            if (!result.ok) {
                if (result.failure.kind === 'conflict') {
                    state.dialog = 'conflict';
                } else {
                    notify(t('publish.failed', { message: failureText(result.failure) }), 'error');
                }

                return;
            }

            syncSummary();
            notify(t('publish.done'));
        } finally {
            state.publishing = false;
        }
    }

    /** Brings a published version back into the draft. Undo returns to what was there. */
    async function restoreVersion(version: number) {
        const page = state.page;

        if (!page) {
            return;
        }

        // The new draft and revision land before any autosave can run again.
        const problem = await autosave.exclusive(async (): Promise<string | null> => {
            const result = await client('POST /pages/:id/versions/:version/restore', { id: page.id, version });

            if (!result.ok) {
                return failureText(result.failure);
            }

            try {
                state.draft = plain(parseDocument(result.value.draft, catalog.value));
            } catch (error) {
                if (error instanceof DocumentError) {
                    return issueText(error.issues[0]);
                }

                throw error;
            }

            state.revision = result.value.revision;
            page.versions = result.value.versions;
            autosave.reset();

            return null;
        });

        if (problem !== null) {
            notify(t('toast.failed', { message: problem }), 'error');

            return;
        }

        commit();
        keepSelectionValid();
        state.dialog = null;
        notify(t('versions.restored'));
    }

    async function createPage(title: string, slug: string): Promise<Issue[]> {
        if (state.page && !(await autosave.flush())) {
            return [{ path: 'title', code: 'type', message: saveProblem() }];
        }

        const result = await client('POST /pages', { title, slug });

        if (!result.ok) {
            return result.failure.kind === 'invalid' ? result.failure.issues : [{ path: 'title', code: 'type', message: failureText(result.failure) }];
        }

        state.workspace.pages = [...state.workspace.pages, { id: result.value.id, slug: result.value.slug, title: result.value.title, publishedAt: result.value.publishedAt }];
        adoptPage(result.value);
        state.dialog = null;
        notify(t('toast.pageCreated'));

        return [];
    }

    /** Saves a new address for the open page. Returns the problems, if any. */
    async function renamePage(slug: string): Promise<Issue[]> {
        const page = state.page;

        if (!page) {
            return [];
        }

        const result = await autosave.exclusive(async () => {
            const response = await client('PUT /pages/:id', { id: page.id }, { baseRevision: state.revision, title: page.title, slug });

            if (response.ok) {
                state.revision = response.value.revision;
                page.slug = slug;
            }

            return response;
        });

        if (!result.ok) {
            if (result.failure.kind === 'conflict') {
                state.dialog = 'conflict';
            }

            return result.failure.kind === 'invalid' ? result.failure.issues : [{ path: 'slug', code: 'type', message: failureText(result.failure) }];
        }

        syncSummary();
        notify(t('page.addressSaved'));

        return [];
    }

    async function deletePage() {
        const page = state.page;

        if (!page) {
            return;
        }

        const result = await autosave.exclusive(async () => {
            const response = await client('DELETE /pages/:id', { id: page.id });

            if (response.ok) {
                state.page = null;
            }

            return response;
        });

        if (!result.ok) {
            notify(t('toast.failed', { message: failureText(result.failure) }), 'error');

            return;
        }

        state.workspace.pages = state.workspace.pages.filter((summary) => summary.id !== page.id);
        notify(t('page.deleted'));
        const next = state.workspace.pages[0];

        if (next) {
            await loadPage(next.id);
        } else {
            state.load = { kind: 'empty' };
        }
    }

    /** Saves site settings. Returns the problems, if any. */
    async function updateSite(update: SiteUpdate): Promise<Issue[]> {
        const result = await client('PUT /site', update);

        if (!result.ok) {
            return result.failure.kind === 'invalid' ? result.failure.issues : [{ path: '', code: 'type', message: failureText(result.failure) }];
        }

        state.workspace = { ...result.value, pages: state.workspace.pages };

        return [];
    }

    async function uploadAsset(file: File): Promise<Asset | null> {
        const body = new FormData();
        body.append('file', file);
        const result = await client('POST /assets', body);

        if (!result.ok) {
            notify(t('library.uploadFailed', { message: failureText(result.failure) }), 'error');

            return null;
        }

        state.workspace.assets = [result.value, ...state.workspace.assets];
        void refreshQuota();

        return result.value;
    }

    async function deleteAsset(asset: Asset) {
        const result = await client('DELETE /assets/:id', { id: asset.id });

        if (!result.ok) {
            notify(t('library.deleteFailed', { message: failureText(result.failure) }), 'error');

            return;
        }

        state.workspace.assets = state.workspace.assets.filter((candidate) => candidate.id !== asset.id);
        void refreshQuota();
    }

    /** The backend measures the quota (bytes, files, whatever it counts), so ask it again. */
    async function refreshQuota() {
        const result = await client('GET /');

        if (result.ok) {
            state.workspace.quota = result.value.quota;
        }
    }

    /** `v-model:open` for a dialog: open while `state.dialog` names it; closing clears it. */
    function dialogModel(name: Exclude<Dialog, null>): WritableComputedRef<boolean> {
        return computed({
            get: () => state.dialog === name,
            set: (open) => {
                if (open) {
                    state.dialog = name;
                } else if (state.dialog === name) {
                    state.dialog = null;
                }
            },
        });
    }

    function openLibrary(onPick: ((ref: string) => void) | null = null) {
        state.library = { onPick };
    }

    return {
        state,
        i18n,
        t,
        client,
        previews,
        saveState: autosave.state,
        catalog,
        site,
        theme,
        canvases,
        activeModal,
        currentCanvas,
        selectedElements,
        activeElement,
        frameWidth,
        canUndo,
        canRedo,
        kindOf: (element: Element) => kindOf(element, catalog.value),
        notify,
        failureText,
        dismiss,
        load,
        openPage,
        reloadPage,
        commit,
        undo,
        redo,
        select,
        selectCanvas,
        clearSelection,
        addElement,
        removeSelected,
        duplicateSelected,
        copySelected,
        paste,
        layer,
        align,
        distributeSelected,
        groupSelected,
        ungroupSelected,
        toggleLock,
        nudge,
        placeElements,
        addSection,
        applyPageTemplate,
        removeSection,
        moveSection,
        setSectionGroup,
        fitCanvas,
        generateMobile,
        addModal,
        openModal,
        removeModal,
        saveNow,
        publish,
        restoreVersion,
        createPage,
        renamePage,
        deletePage,
        updateSite,
        uploadAsset,
        deleteAsset,
        openLibrary,
        dialogModel,
        dispose: () => autosave.dispose(),
    };
}

export const issueText = (issue: Issue | undefined): string => (issue ? `${issue.path}: ${issue.message}` : '');

const blankToNull = (seo: { title: string; description: string }): Seo => ({
    title: seo.title.trim() === '' ? null : seo.title,
    description: seo.description.trim() === '' ? null : seo.description,
});

/**
 * Pasted data comes from local storage, which anything could have written,
 * possibly another site with other app elements: only what this catalog parses goes in.
 */
function parsesAsElement(value: unknown, catalog: Catalog): value is Element {
    try {
        parseDocument({ sections: [{ ...emptySection(), elements: [value] }] }, catalog);

        return true;
    } catch (error) {
        if (error instanceof DocumentError) {
            return false;
        }

        throw error;
    }
}

