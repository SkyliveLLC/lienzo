import * as z from 'zod';
import { coreActions } from './actions.ts';
import {
    CORE_ELEMENT_TYPES,
    corePropsSchema,
    defaultTheme,
    documentSchema,
    FIELD_TYPES,
    OPAQUE_PROPS_MAX_BYTES,
    siteSettingsSchema,
    styleSchema,
    THEME_TOKENS,
    themeSchema,
} from './document.ts';
import icons from './icons.json' with { type: 'json' };
import { messages } from './messages.ts';
import { runtimeScript } from './runtime.generated.ts';
import { styleTable } from './style.ts';
import { stylesheet } from './stylesheet.ts';

const jsonSchema = (schema: z.ZodType, reused: 'ref' | 'inline' = 'inline') => {
    const { $schema: _, ...rest } = z.toJSONSchema(schema, { io: 'output', reused });

    return rest;
};

/** The static files a backend needs besides its own port of the renderer, keyed by file name. */
export function assets(): Record<'lienzo.css' | 'runtime.js' | 'schema.json' | 'data.json', string> {
    // The root is the document; shared pieces of it are referenced from the root `$defs`.
    const { $defs: documentDefs, ...document } = jsonSchema(documentSchema, 'ref');
    const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $comment: 'Validation contract for Lienzo documents. Unknown keys are stripped, not rejected (additionalProperties:false means "drop"). '
            + 'A blank string in a typed optional field means null. An empty JSON array where an object is expected means an empty object. '
            + 'Element props are checked by type: CoreProps for core types, the app field list for catalog types, and only a size limit otherwise.',
        ...document,
        $defs: {
            ...documentDefs,
            CoreProps: jsonSchema(corePropsSchema),
            Style: jsonSchema(styleSchema),
            Theme: jsonSchema(themeSchema),
            SiteSettings: jsonSchema(siteSettingsSchema),
        },
    };

    const data = {
        elementTypes: CORE_ELEMENT_TYPES,
        fieldTypes: FIELD_TYPES,
        themeTokens: THEME_TOKENS,
        defaultTheme,
        opaquePropsMaxBytes: OPAQUE_PROPS_MAX_BYTES,
        styleTable,
        actions: coreActions,
        messages,
        icons,
    };

    return {
        'lienzo.css': stylesheet,
        'runtime.js': runtimeScript,
        'schema.json': `${JSON.stringify(schema, null, 2)}\n`,
        'data.json': `${JSON.stringify(data, null, 2)}\n`,
    };
}
