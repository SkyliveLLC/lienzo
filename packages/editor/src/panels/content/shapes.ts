import type { CoreProps } from '@skylive/lienzo-core';
import type { Translator } from '../../i18n/index.ts';

type Shape = NonNullable<CoreProps['shape']>;

const SHAPES = ['rectangle', 'ellipse', 'triangle', 'blob', 'arch', 'diagonal', 'dots', 'grid'] as const satisfies readonly Shape[];

/** Shapes of a shape element, which are also the crops of an image. */
export const shapeOptions = (t: Translator['t']): { value: Shape; label: string }[] => SHAPES.map((value) => ({ value, label: t(`shape.${value}`) }));
