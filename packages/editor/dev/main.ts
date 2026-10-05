import { createApp, h } from 'vue';
import { LienzoEditor } from '../src/index.ts';

/** The Vue component on a hostile host page. `?locale=es` switches the editor language. */
const locale = new URLSearchParams(location.search).get('locale') ?? 'en';

createApp({ render: () => h(LienzoEditor, { endpoint: '/api', locale }) }).mount('#app');
