<link rel="stylesheet" href="{{ $style }}" @if ($nonce) nonce="{{ $nonce }}" @endif>
<script type="module" src="{{ $script }}" @if ($nonce) nonce="{{ $nonce }}" @endif></script>
<lienzo-editor endpoint="{{ $endpoint }}" locale="{{ $editorLocale }}" headers="{{ $headers }}" {{ $attributes }}></lienzo-editor>
