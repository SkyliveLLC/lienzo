<script type="module" src="{{ $script }}" @if ($nonce) nonce="{{ $nonce }}" @endif></script>
<lienzo-editor endpoint="{{ $endpoint }}" locale="{{ $editorLocale }}" {{ $attributes }}></lienzo-editor>
