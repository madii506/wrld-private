import { startWorld } from './world.js';
const q = new URLSearchParams(location.search);
window.W = startWorld(document.getElementById('c'), { startShot: q.get('shot') || 'gate', fixedPr: 1 });
