<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

use Closure;
use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Support\Js;

/** Link attributes for actions, from core's action table (`data.json`). */
final class Actions
{
    /**
     * Attributes for a link that performs `$action`, or null when it goes
     * nowhere. `$appAction` answers for app-registered types; unknown types render inert.
     *
     * @param  array{type?: ?string, value?: ?string}|null  $action
     * @param  Closure(array{type: string, value?: ?string}): ?string  $appAction
     * @return array<string, string|true>|null
     */
    public static function attrs(?array $action, string $base, Closure $appAction): ?array
    {
        $type = $action['type'] ?? 'none';
        $value = Js::trim($action['value'] ?? '');
        $rule = Assets::data()['actions'][$type] ?? null;

        if ($rule === null) {
            $href = $action === null ? null : $appAction([...$action, 'type' => $type]);

            return $href === null ? null : self::link($href);
        }

        switch ($rule['kind']) {
            case 'behavior':
                if ($rule['value'] === 'id' && $value === '') {
                    return null;
                }

                return ['href' => '#', "data-{$rule['attr']}" => match ($rule['value']) {
                    null => true,
                    'id' => Canvas::safeId($value),
                    default => $rule['value'],
                }];
            case 'link':
                if ($value === '' || (isset($rule['requires']) && ! str_starts_with($value, $rule['requires']))) {
                    return null;
                }

                $target = ($rule['lower'] ?? false) ? mb_strtolower($value, 'UTF-8') : $value;
                $target = isset($rule['keep']) ? (string) preg_replace("/[^{$rule['keep']}]/u", '', $target) : $target;
                $target = isset($rule['trim']) ? self::trimChars($target, $rule['trim']) : $target;

                return self::link((($rule['base'] ?? false) ? $base : '').$rule['prefix'].$target);
            default:
                return null;
        }
    }

    /** @return array<string, string> */
    private static function link(string $href): array
    {
        return preg_match('/^https?:\/\//', $href) === 1
            ? ['href' => $href, 'target' => '_blank', 'rel' => 'noopener noreferrer']
            : ['href' => $href];
    }

    private static function trimChars(string $value, string $chars): string
    {
        $start = 0;
        $end = strlen($value);

        while ($start < $end && str_contains($chars, $value[$start])) {
            $start++;
        }

        while ($end > $start && str_contains($chars, $value[$end - 1])) {
            $end--;
        }

        return substr($value, $start, $end - $start);
    }
}
