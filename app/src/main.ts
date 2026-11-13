// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { mount } from 'svelte';
import App from './ui/App.svelte';
import './ui/app.css';

const target = document.getElementById('app');
if (!target) throw new Error('missing #app element');

export default mount(App, { target });
