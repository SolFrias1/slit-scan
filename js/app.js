/* Tiempo e imagen: Slit Scan
 * Carga un video, extrae sus frames y los apila en Z con three.js.
 * Escala, giro, opacidad y edge fade se calculan desde el frame seleccionado hacia los extremos;
 * el procesamiento de imagen y la animación por keyframes se aplican sobre la pila.
 */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const deg = d => d * Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n, d = 1) => Number(n).toLocaleString('es-CL', { maximumFractionDigits: d });
const MAX_FRAMES = 900;
const AUTO_PIXELS = 40e6;      // píxeles totales de la pila en modo Auto
let pending = false;

const S = {
  fps: 10, tStart: 0, tEnd: 0, maxW: 480, work: 'auto',
  spacing: 12, from: 1, to: 1,
  selected: 1, zone: 0,
  scaleMode: 'const', scale: 1, sCenter: 1, sEdge: 0.3, amp: 40, cycles: 2, phase: 0,
  twist: 0,
  opCenter: 1, opEdge: 1, efCenter: 0, efEdge: 0, noise: 0,
  keyMode: 'none', lumaThr: 0.12, lumaSoft: 0.08, chromaTol: 0.25, chromaSoft: 0.1,
  motionThr: 0.08, motionSoft: 0.08, tintAmt: 0,
  animDur: 5,
  frames: [], frameH: 56.25, view: 'free', anchor: -1,
  bgMode: 'black', bg: '#000000'
};

/* ---------- aviso breve ---------- */
let toastT;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- sliders con valor exacto ---------- */
const controls = {};
const EXTRACT_KEYS = new Set(['fps', 'tStart', 'tEnd', 'maxW']);
function slider(box, key, label, min, max, step, unit){
  const id = 'c-' + key;
  const w = document.createElement('div');
  w.className = 'ctl';
  w.innerHTML = `<label for="${id}">${label}</label>
    <span class="numwrap"><input type="number" id="${id}-n" aria-label="${label}, valor exacto" min="${min}" max="${max}" step="${step}"><span class="unit">${unit}</span></span>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}">`;
  $(box).appendChild(w);
  const r = w.querySelector('input[type=range]'), n = w.querySelector('input[type=number]');
  const dec = (String(step).split('.')[1] || '').length;
  const show = v => { r.value = v; n.value = +(+v).toFixed(dec); };
  const set = v => {
    v = +v; if (isNaN(v)) { show(S[key]); return; }
    const mn = +r.min;
    v = +(Math.round((v - mn) / step) * step + mn).toFixed(dec);
    v = clamp(v, mn, +r.max);
    S[key] = v; show(v);
    onChange(key);
  };
  r.addEventListener('input', () => set(r.value));
  n.addEventListener('change', () => set(n.value));
  n.addEventListener('keydown', e => { if (e.key === 'Enter') set(n.value); });
  show(S[key]);
  controls[key] = {
    set,
    range(mn, mx){ r.min = n.min = mn; r.max = n.max = mx; },
    silent(v){ S[key] = v; show(v); }
  };
}

slider('#box-extract', 'fps', 'Frames por segundo a extraer', 0.5, 60, 0.5, 'fps');
slider('#box-extract', 'tStart', 'Desde', 0, 0, 0.01, 's');
slider('#box-extract', 'tEnd', 'Hasta', 0, 0, 0.01, 's');
slider('#box-extract', 'maxW', 'Ancho de cada imagen', 120, 1920, 10, 'px');

slider('#box-order', 'spacing', 'Distancia entre frames', 0, 200, 0.5, 'u');
slider('#box-order', 'from', 'Primer frame', 1, 1, 1, '');
slider('#box-order', 'to', 'Último frame', 1, 1, 1, '');

slider('#box-ref', 'selected', 'Frame seleccionado', 1, 1, 1, '');
slider('#box-ref', 'zone', 'Zona sin cambios alrededor', 0, 95, 1, '%');

slider('#box-scale-base', 'scale', 'Escala', 0.1, 3, 0.05, '×');
slider('#box-scale-lin', 'sCenter', 'Escala en el seleccionado', 0.05, 3, 0.05, '×');
slider('#box-scale-lin', 'sEdge', 'Escala en los extremos', 0.05, 3, 0.05, '×');
slider('#box-scale-wave', 'amp', 'Amplitud', 0, 100, 1, '%');
slider('#box-scale-wave', 'cycles', 'Ondas hasta el extremo más lejano', 0.25, 20, 0.25, '');
slider('#box-scale-wave', 'phase', 'Desfase', -180, 180, 1, '°');

slider('#box-rot', 'twist', 'Giro acumulado por frame', -45, 45, 1, '°');

slider('#box-look', 'opCenter', 'Opacidad en el seleccionado', 0, 1, 0.01, '');
slider('#box-look', 'opEdge', 'Opacidad en los extremos', 0, 1, 0.01, '');
slider('#box-look', 'efCenter', 'Edge fade en el seleccionado', 0, 50, 0.5, '%');
slider('#box-look', 'efEdge', 'Edge fade en los extremos', 0, 50, 0.5, '%');
slider('#box-look', 'noise', 'Irregularidad del borde', 0, 100, 1, '%');

slider('#box-luma', 'lumaThr', 'Umbral de brillo', 0, 1, 0.01, '');
slider('#box-luma', 'lumaSoft', 'Suavidad', 0, 0.5, 0.01, '');
slider('#box-chroma', 'chromaTol', 'Tolerancia', 0, 1, 0.01, '');
slider('#box-chroma', 'chromaSoft', 'Suavidad', 0, 0.5, 0.01, '');
slider('#box-motion', 'motionThr', 'Umbral de cambio', 0, 0.5, 0.005, '');
slider('#box-motion', 'motionSoft', 'Suavidad', 0, 0.5, 0.005, '');
slider('#box-tint', 'tintAmt', 'Intensidad del teñido', 0, 1, 0.01, '');


slider('#box-anim', 'animDur', 'Duración', 1, 60, 0.5, 's');

function onChange(key){
  if (EXTRACT_KEYS.has(key)) { updateEstimate(); return; }
  if (key === 'animDur') { animUI(); return; }
  if (key === 'selected') markThumb();
  layout();
}

/* grupos de botones exclusivos */
function segSet(attr, val){ $$(`[data-${attr}]`).forEach(x => x.setAttribute('aria-pressed', x.dataset[attr] === val)); }
function onSeg(attr, fn){ $$(`[data-${attr}]`).forEach(b => b.addEventListener('click', () => fn(b.dataset[attr]))); }

const SCALE_HINTS = {
  const: 'Todos los frames tienen el mismo tamaño.',
  lin: 'El tamaño cambia en línea recta desde el seleccionado hasta cada extremo.',
  wave: 'El tamaño sube y baja como una onda que nace en el seleccionado y avanza hacia los extremos.'
};
function setScaleMode(mode){
  S.scaleMode = mode; segSet('scale', mode);
  $('#box-scale-base').hidden = mode === 'lin';
  $('#box-scale-lin').hidden = mode !== 'lin';
  $('#box-scale-wave').hidden = mode !== 'wave';
  $('#scaleHint').textContent = SCALE_HINTS[mode];
  layout();
}
onSeg('scale', setScaleMode);
$('#zero').addEventListener('click', () => controls.twist.set(0));

function setKeyMode(m){
  S.keyMode = m; segSet('key', m);
  $('#box-luma').hidden = m !== 'luma';
  $('#box-chroma').hidden = m !== 'chroma';
  layout();
}
onSeg('key', setKeyMode);
$('#motionOn').addEventListener('change', () => { $('#box-motion').hidden = !$('#motionOn').checked; });

/* ---------- three.js ---------- */
const vp = $('#viewport');
let renderer, glOK = true;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 1);
  $('#gl').appendChild(renderer.domElement);
} catch (e) { glOK = false; }

const scene = new THREE.Scene();
const camP = new THREE.PerspectiveCamera(40, 1, 0.5, 400000);
const camO = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1e6);
const root = new THREE.Group(); scene.add(root);
const outlineMat = new THREE.LineBasicMaterial({ color: 0xD99A00 });
const U = { noise: { value: 0 }, hw: { value: 9 / 16 } };

/* uniforms compartidos del procesamiento de imagen */
const PU = {
  keyMode: { value: 0 }, lumaThr: { value: 0 }, lumaSoft: { value: 0 }, lumaInv: { value: 0 },
  chromaTol: { value: 0 }, chromaSoft: { value: 0 }, keyColor: { value: new THREE.Color('#00ff00') },
  motionOn: { value: 0 }, motionThr: { value: 0 }, motionSoft: { value: 0 },
  tintAmt: { value: 0 }, tintA: { value: new THREE.Color() }, tintB: { value: new THREE.Color() }
};

const PROC = `
uniform float keyMode, lumaThr, lumaSoft, lumaInv, chromaTol, chromaSoft, motionOn, motionThr, motionSoft, tintAmt;
uniform vec3 keyColor, tintA, tintB;
vec4 proc(vec3 c, vec3 pv, float tt){
  float a = 1.0;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (keyMode > 0.5 && keyMode < 1.5) {
    float k = smoothstep(lumaThr - lumaSoft, lumaThr + lumaSoft + 0.0001, l);
    a *= lumaInv > 0.5 ? 1.0 - k : k;
  } else if (keyMode > 1.5) {
    a *= smoothstep(chromaTol, chromaTol + chromaSoft + 0.0001, distance(c, keyColor));
  }
  if (motionOn > 0.5) a *= smoothstep(motionThr, motionThr + motionSoft + 0.0001, length(c - pv));
  if (tintAmt > 0.0) {
    vec3 g = mix(tintA, tintB, clamp(tt, 0.0, 1.0));
    c = mix(c, clamp(g * l * 1.4, 0.0, 1.0), tintAmt);
  }
  return vec4(c, a);
}
`;

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = `
uniform sampler2D map; uniform sampler2D prevMap;
uniform float opacity; uniform float fade; uniform float noise; uniform float hw; uniform float seed; uniform float tpos;
varying vec2 vUv;
${PROC}
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21) + seed * 0.013); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec4 c = texture2D(map, vUv);
  vec4 pr = proc(c.rgb, texture2D(prevMap, vUv).rgb, tpos);
  float e = 1.0;
  if (fade > 0.0) {
    float d = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y) * hw);
    float n = hash(floor(vUv * vec2(360.0, 360.0 * hw)));
    e = smoothstep(0.0, fade, d - n * noise * fade);
  }
  float a = c.a * pr.a * opacity * e;
  if (a < 0.004) discard;
  gl_FragColor = vec4(pr.rgb, a);
}`;


let geo, outline;
function buildGeo(aspectHW){
  if (geo) geo.dispose();
  S.frameH = 100 * aspectHW; U.hw.value = aspectHW;
  geo = new THREE.PlaneGeometry(100, S.frameH);
  if (outline) { if (outline.parent) outline.parent.remove(outline); outline.geometry.dispose(); }
  outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo), outlineMat);
  outline.renderOrder = 100000;
}
buildGeo(9 / 16);
function markColor(){
  const c = getComputedStyle(document.documentElement).getPropertyValue('--mark').trim();
  try { outlineMat.color.set(c); } catch (e) {}
  requestRender();
}
markColor();
const mq = matchMedia('(prefers-color-scheme: dark)');
if (mq.addEventListener) mq.addEventListener('change', markColor);

/* ---------- cámaras ---------- */
const O = { theta: deg(38), phi: deg(66), r: 420 };
let frontZoom = 1, isoZoom = 1;
const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();
const activeCam = () => S.view === 'iso' ? camO : camP;

function visibleIdx(){
  const out = [], n = S.frames.length;
  if (!n) return out;
  const a = clamp(Math.min(S.from, S.to), 1, n) - 1, b = clamp(Math.max(S.from, S.to), 1, n) - 1;
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
function nearestK(vis, idx){
  let best = 0, bd = Infinity;
  vis.forEach((i, k) => { const d = Math.abs(i - idx); if (d < bd) { bd = d; best = k; } });
  return best;
}
function maxScale(){
  if (S.scaleMode === 'lin') return Math.max(S.sCenter, S.sEdge);
  if (S.scaleMode === 'wave') return S.scale * (1 + S.amp / 100);
  return S.scale;
}
function stackExtent(){
  const n = Math.max(visibleIdx().length, 1), ms = maxScale();
  return Math.max((n - 1) * S.spacing, 100 * ms, S.frameH * ms);
}
function anchorMesh(){ const f = S.frames[S.anchor]; return f ? f.mesh : null; }

let recSize = null;   // tamaño fijo del lienzo mientras se graba un video
function updateCamera(){
  const aspect = recSize ? recSize[0] / recSize[1] : vp.clientWidth / Math.max(1, vp.clientHeight);
  camP.aspect = aspect;
  if (S.view === 'free') {
    camP.near = 0.5; camP.up.set(0, 1, 0);
    camP.position.set(
      O.r * Math.sin(O.phi) * Math.sin(O.theta),
      O.r * Math.cos(O.phi),
      O.r * Math.sin(O.phi) * Math.cos(O.theta)
    );
    camP.lookAt(0, 0, 0);
  } else if (S.view === 'front') {
    const m = anchorMesh();
    const z = m ? m.position.z : 0, s = m ? m.scale.x : 1;
    const t = Math.tan(deg(camP.fov / 2));
    const D = Math.max((S.frameH * s / 2) / t, (100 * s / 2) / (t * aspect)) * 1.12 * frontZoom;
    const a = ($('#frontSpin').checked && m) ? m.rotation.z : 0;
    camP.position.set(0, 0, z + D);
    camP.up.set(-Math.sin(a), Math.cos(a), 0);
    camP.lookAt(0, 0, z);
    camP.near = $('#frontClip').checked ? Math.max(0.5, D - 0.45 * Math.max(S.spacing, 0.02)) : 0.5;
  } else {
    const ext = stackExtent(), half = ext * 0.62 / isoZoom, R = ext * 4 + 2000;
    camO.left = -half * aspect; camO.right = half * aspect; camO.top = half; camO.bottom = -half;
    camO.near = 1; camO.far = R * 3;
    camO.position.copy(ISO_DIR).multiplyScalar(R);
    camO.up.set(0, 1, 0);
    camO.lookAt(0, 0, 0);
    camO.updateProjectionMatrix();
  }
  camP.updateProjectionMatrix();
  drawGizmo();
  requestRender();
}

/* referencia de ejes en la esquina superior derecha */
const gizmo = $('#gizmo');
const GZ = [
  { v: new THREE.Vector3(1, 0, 0), c: '#E5484D', l: 'X' },
  { v: new THREE.Vector3(0, 1, 0), c: '#30A46C', l: 'Y' },
  { v: new THREE.Vector3(0, 0, 1), c: '#3E63DD', l: 'Z' }
];
function drawGizmo(){
  const show = $('#axes').checked && S.frames.length > 0;
  gizmo.hidden = !show; if (!show) return;
  const q = activeCam().quaternion.clone().invert(), R = 22, items = [];
  GZ.forEach(a => {
    const p = a.v.clone().applyQuaternion(q);
    items.push({ x: p.x * R, y: -p.y * R, z: p.z, c: a.c, l: a.l, pos: true });
    items.push({ x: -p.x * R, y: p.y * R, z: -p.z, c: a.c, pos: false });
  });
  items.sort((a, b) => a.z - b.z);
  gizmo.innerHTML = items.map(it => it.pos
    ? `<line x1="0" y1="0" x2="${it.x.toFixed(2)}" y2="${it.y.toFixed(2)}" stroke="${it.c}" stroke-width="2.2" stroke-linecap="round"/><circle cx="${it.x.toFixed(2)}" cy="${it.y.toFixed(2)}" r="6.5" fill="${it.c}"/><text x="${it.x.toFixed(2)}" y="${it.y.toFixed(2)}">${it.l}</text>`
    : `<circle cx="${it.x.toFixed(2)}" cy="${it.y.toFixed(2)}" r="3.5" fill="${it.c}" opacity=".45"/>`
  ).join('');
}

function requestRender(){
  if (!glOK || pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; renderer.render(scene, activeCam()); });
}
function resize(){
  if (!glOK || recSize) return;
  renderer.setSize(vp.clientWidth, vp.clientHeight, false);
  updateCamera();
}
new ResizeObserver(resize).observe(vp);

function fitView(){
  const ext = stackExtent();
  O.r = clamp(ext * 1.35 + 90, 60, 300000);
  frontZoom = 1; isoZoom = 1;
  updateCamera();
}
function zoomBy(f){
  if (S.view === 'free') O.r = clamp(O.r * f, 20, 300000);
  else if (S.view === 'front') frontZoom = clamp(frontZoom * f, 0.1, 40);
  else isoZoom = clamp(isoZoom / f, 0.05, 60);
  updateCamera();
}

const VIEW_HINTS = {
  free: 'Arrastra para orbitar, rueda o pellizco para acercar',
  front: 'Vista frontal: la cámara sigue al frame seleccionado. Rueda para acercar',
  iso: 'Vista isométrica. Rueda o pellizco para acercar'
};
function setView(v){
  S.view = v; segSet('view', v);
  vp.classList.toggle('front', v === 'front');
  vp.classList.toggle('iso', v === 'iso');
  $('#orbitHint').textContent = VIEW_HINTS[v];
  layout();
}
onSeg('view', setView);


/* ---------- uniforms desde el estado ---------- */
function procAlpha(){ return S.keyMode !== 'none' || $('#motionOn').checked; }
function syncUniforms(){
  PU.keyMode.value = { none: 0, luma: 1, chroma: 2 }[S.keyMode];
  PU.lumaThr.value = S.lumaThr; PU.lumaSoft.value = S.lumaSoft; PU.lumaInv.value = $('#lumaInv').checked ? 1 : 0;
  PU.chromaTol.value = S.chromaTol; PU.chromaSoft.value = S.chromaSoft; PU.keyColor.value.set($('#keyColor').value);
  PU.motionOn.value = $('#motionOn').checked ? 1 : 0; PU.motionThr.value = S.motionThr; PU.motionSoft.value = S.motionSoft;
  PU.tintAmt.value = S.tintAmt; PU.tintA.value.set($('#tintA').value); PU.tintB.value.set($('#tintB').value);
}

/* ---------- disposición de la pila ---------- */
function layout(){
  const vis = visibleIdx(), n = vis.length, N = S.frames.length;
  const inStack = new Set(vis);
  const additive = $('#additive').checked;
  const dir = $('#invert').checked ? -1 : 1;
  const pa = procAlpha();
  U.noise.value = S.noise / 100;
  S.frames.forEach(f => { f.mesh.visible = false; });

  const kc = n ? nearestK(vis, S.selected - 1) : 0;
  S.anchor = n ? vis[kc] : -1;
  const left = kc, right = n - 1 - kc, far = Math.max(left, right, 1);
  const zone = S.zone / 100;
  let smin = Infinity, smax = 0;

  vis.forEach((i, k) => {
    const m = S.frames[i].mesh, mat = m.material;
    const dk = k - kc;
    const side = dk < 0 ? left : right;
    const a = side > 0 ? Math.abs(dk) / side : 0;          // 0 en el seleccionado, 1 en cada extremo
    const t = zone >= 1 ? 0 : clamp((a - zone) / (1 - zone), 0, 1);

    m.visible = true;
    m.position.set(0, 0, dir * (k - (n - 1) / 2) * S.spacing);
    m.rotation.set(0, 0, deg(dk * S.twist));

    let sc;
    if (S.scaleMode === 'lin') sc = S.sCenter + (S.sEdge - S.sCenter) * t;
    else if (S.scaleMode === 'wave') sc = Math.max(0.01, S.scale * (1 + (S.amp / 100) * Math.sin(2 * Math.PI * S.cycles * Math.abs(dk) / far + deg(S.phase))));
    else sc = S.scale;
    m.scale.setScalar(sc);
    smin = Math.min(smin, sc); smax = Math.max(smax, sc);

    const op = S.opCenter + (S.opEdge - S.opCenter) * t;
    const ef = (S.efCenter + (S.efEdge - S.efCenter) * t) / 100;
    mat.uniforms.opacity.value = op;
    mat.uniforms.fade.value = ef;
    mat.uniforms.tpos.value = N > 1 ? i / (N - 1) : 0;
    mat.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.depthWrite = !additive && op >= 0.999 && ef === 0 && !pa;
  });

  const am = anchorMesh();
  if (am && outline.parent !== am) am.add(outline);
  outline.visible = $('#outlineOn').checked;
  $$('.thumb').forEach((th, i) => th.classList.toggle('off', !inStack.has(i)));

  syncUniforms();

  const hud = $('#hud');
  if (n) {
    const size = Math.abs(smax - smin) < 1e-6
      ? `${fmt(100 * smax, 1)} × ${fmt(S.frameH * smax, 1)} u`
      : `ancho de ${fmt(100 * smin, 1)} a ${fmt(100 * smax, 1)} u`;
    hud.hidden = false;
    hud.innerHTML =
      `<span><b>${n}</b> frames en la pila</span>` +
      `<span>Distancia <b>${fmt(S.spacing, 2)} u</b></span>` +
      `<span>Largo total <b>${fmt(Math.max(0, n - 1) * S.spacing, 1)} u</b></span>` +
      `<span>Frame <b>${size}</b></span>`;
  } else hud.hidden = true;

  syncTransport();
  updateCamera();
}
['axes', 'additive', 'outlineOn', 'invert', 'frontClip', 'frontSpin', 'lumaInv', 'motionOn']
  .forEach(id => $('#' + id).addEventListener('change', layout));
['keyColor', 'tintA', 'tintB'].forEach(id => $('#' + id).addEventListener('input', layout));


/* ---------- fondo y cuentagotas ---------- */
let picking = null;   // 'bg' o 'key' mientras el cuentagotas está activo
function applyBg(){
  const c = new THREE.Color(S.bg);
  vp.style.backgroundColor = S.bg;
  if (glOK) renderer.setClearColor(c, 1);
  vp.classList.toggle('light-bg', 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.45);
  $('#bgSwatch').style.background = S.bg;
  $('#bgText').textContent = S.bgMode === 'pick' ? `Tomado de un frame: ${S.bg.toUpperCase()}` : S.bg.toUpperCase();
  segSet('bg', S.bgMode);
  layout();
}
function setPicking(target){
  picking = target;
  vp.classList.toggle('picking', !!target); $('#strip').classList.toggle('picking', !!target);
  if (target) toast('Haz clic sobre un frame en la vista o en una miniatura. Esc para cancelar.');
}
function startPick(target){
  if (!S.frames.length) { toast('Primero extrae frames para tomar un color.'); return; }
  setPicking(target);
}
onSeg('bg', m => {
  if (m === 'pick') { startPick('bg'); return; }
  setPicking(null);
  S.bgMode = m; S.bg = m === 'white' ? '#ffffff' : '#000000';
  applyBg();
});
$('#keyPick').addEventListener('click', () => startPick('key'));
// promedia 3×3 píxeles del frame original
function sampleCanvas(c, u, v){
  const x = clamp(Math.floor(u * c.width), 1, c.width - 2), y = clamp(Math.floor(v * c.height), 1, c.height - 2);
  const d = c.getContext('2d').getImageData(x - 1, y - 1, 3, 3).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const h = n => Math.round(n / 9).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
function takeColor(hex){
  const target = picking; setPicking(null);
  if (target === 'key') { $('#keyColor').value = hex; layout(); toast('Color a quitar ' + hex.toUpperCase()); return; }
  S.bgMode = 'pick'; S.bg = hex; applyBg();
  toast('Fondo ' + hex.toUpperCase());
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickFromView(e){
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const cam = activeCam();
  ray.setFromCamera(ndc, cam);
  const meshes = S.frames.map(f => f.mesh).filter(m => m.visible);
  const hits = ray.intersectObjects(meshes, false).filter(h => cam.isOrthographicCamera || h.distance >= cam.near);
  if (!hits.length || !hits[0].uv) { toast('Ahí no hay frame. Haz clic sobre una imagen.'); return; }
  const f = S.frames.find(x => x.mesh === hits[0].object);
  takeColor(sampleCanvas(f.canvas, hits[0].uv.x, 1 - hits[0].uv.y));
}
window.addEventListener('keydown', e => { if (e.key === 'Escape' && picking) { setPicking(null); toast('Cuentagotas cancelado'); } });

/* ---------- interacción en el visor ---------- */
if (glOK) {
  const el = renderer.domElement, ptrs = new Map();
  let lastPinch = 0;
  const pdist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  el.addEventListener('pointerdown', e => {
    if (recording) return;
    if (picking) { pickFromView(e); return; }
    el.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) lastPinch = pdist();
  });
  el.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1 && S.view === 'free') {
      O.theta -= dx * 0.006; O.phi = clamp(O.phi - dy * 0.006, 0.05, Math.PI - 0.05);
      updateCamera();
    } else if (ptrs.size === 2 && lastPinch > 0) {
      const d = pdist(); zoomBy(lastPinch / d); lastPinch = d;
    }
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) lastPinch = 0; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); if (!recording) zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
}
vp.addEventListener('keydown', e => {
  if (!S.frames.length || recording) return;
  if (e.key === ' ') { togglePlay(); e.preventDefault(); }
  if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
});
$('#resetView').addEventListener('click', () => { O.theta = deg(38); O.phi = deg(66); fitView(); });

/* ---------- reproducción de frames ---------- */
let playing = false, playDir = 1, lastT = 0, acc = 0;
const scrub = $('#scrub');
function syncTransport(){
  const n = S.frames.length;
  scrub.max = Math.max(1, n); scrub.value = S.selected;
  scrub.disabled = $('#play').disabled = !n || recording;
  const f = S.frames[S.selected - 1];
  $('#clock').textContent = f ? `Frame ${S.selected} de ${n}, ${fmt(f.time, 2)} s` : 'Sin frames';
}
function setSelected(v){ controls.selected.silent(v); markThumb(); layout(); }
scrub.addEventListener('input', () => { if (!recording) controls.selected.set(+scrub.value); });

// Mueve la referencia al siguiente frame visible. Devuelve false si la reproducción debe detenerse.
function advance(d){
  const vis = visibleIdx(); if (vis.length < 2) return false;
  let k = nearestK(vis, S.selected - 1) + d;
  if (k < 0 || k >= vis.length) {
    const mode = $('#loopMode').value;
    if (mode === 'loop') k = d > 0 ? 0 : vis.length - 1;
    else if (mode === 'pingpong') { playDir = -playDir; k = clamp(k - 2 * d, 0, vis.length - 1); }
    else return false;
  }
  setSelected(vis[k] + 1);
  return true;
}
function step(d){ pause(); advance(d); }
const playFps = () => clamp(+$('#playFps').value || 12, 1, 60);
function tick(now){
  if (!playing) return;
  acc += (now - lastT) / 1000; lastT = now;
  const dt = 1 / playFps();
  let guard = 0;
  while (acc >= dt && guard++ < 5) {
    acc -= dt;
    if (!advance(playDir)) { pause(); return; }
  }
  if (guard >= 5) acc = 0;
  requestAnimationFrame(tick);
}
function play(){
  if (!S.frames.length || playing || recording) return;
  const vis = visibleIdx(); if (vis.length < 2) { toast('Necesitas al menos dos frames en la pila para reproducir.'); return; }
  animPause();
  if ($('#loopMode').value === 'once' && nearestK(vis, S.selected - 1) === vis.length - 1) setSelected(vis[0] + 1);
  if ($('#loopMode').value !== 'pingpong') playDir = 1;
  playing = true; lastT = performance.now(); acc = 0;
  $('#playLabel').textContent = 'Pausar';
  $('#playIcon').setAttribute('d', 'M2.5 1.5h3.2v11H2.5zM8.3 1.5h3.2v11H8.3z');
  requestAnimationFrame(tick);
}
function pause(){
  playing = false;
  $('#playLabel').textContent = 'Reproducir';
  $('#playIcon').setAttribute('d', 'M3 1.5v11l9-5.5z');
}
function togglePlay(){ playing ? pause() : play(); }
$('#play').addEventListener('click', togglePlay);

/* ---------- carga del video ---------- */
const video = $('#video');
let videoURL = null, videoName = 'video';
$('#pick').addEventListener('click', () => $('#file').click());
$('#pick2').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ''; });
['dragenter', 'dragover'].forEach(t => window.addEventListener(t, e => { e.preventDefault(); vp.classList.add('drag'); }));
window.addEventListener('dragleave', e => { e.preventDefault(); if (!e.relatedTarget) vp.classList.remove('drag'); });
window.addEventListener('drop', e => {
  e.preventDefault(); vp.classList.remove('drag');
  const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) loadFile(f);
});

function tryLoad(src){
  return new Promise(res => {
    const done = v => { video.removeEventListener('loadeddata', ok); video.removeEventListener('error', bad); clearTimeout(to); res(v); };
    const ok = () => done(true), bad = () => done(false);
    const to = setTimeout(() => done(video.readyState >= 2), 15000);
    video.addEventListener('loadeddata', ok); video.addEventListener('error', bad);
    video.src = src; video.load();
  });
}
function readDataURL(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
function once(ev, ms){ return new Promise(res => { const h = () => { video.removeEventListener(ev, h); res(); }; video.addEventListener(ev, h); setTimeout(h, ms); }); }

async function loadFile(file){
  if (busy || recording) { toast('Espera a que termine el proceso en curso o cancélalo.'); return; }
  if (file.type && !file.type.startsWith('video/')) { toast('Ese archivo no es un video.'); return; }
  pause(); animPause();
  $('#meta').textContent = 'Abriendo ' + file.name + '…';
  clearFrames();
  if (videoURL) { URL.revokeObjectURL(videoURL); videoURL = null; }
  let ok = false;
  try { videoURL = URL.createObjectURL(file); ok = await tryLoad(videoURL); } catch (e) { ok = false; }
  if (!ok) { try { ok = await tryLoad(await readDataURL(file)); } catch (e) { ok = false; } }
  if (!ok) {
    $('#meta').textContent = 'No se pudo leer ' + file.name + '. Prueba con un MP4 (H.264) o un WebM.';
    $('#extract').disabled = true; return;
  }
  if (!isFinite(video.duration)) { video.currentTime = 1e7; await once('durationchange', 3000); video.currentTime = 0; await once('seeked', 2000); }
  videoName = file.name.replace(/\.[^.]+$/, '') || 'video';
  video.style.display = 'block';
  const d = isFinite(video.duration) ? video.duration : 0;
  $('#meta').textContent = `${file.name}: ${video.videoWidth} × ${video.videoHeight} px, ${fmt(d, 2)} s`;
  controls.tStart.range(0, +d.toFixed(2)); controls.tEnd.range(0, +d.toFixed(2));
  controls.tStart.silent(0); controls.tEnd.silent(+d.toFixed(2));
  controls.maxW.silent(Math.min(480, video.videoWidth || 480));
  $('#extract').disabled = false;
  $('#stepExtract').open = true;
  $('#emptyTitle').textContent = 'Video listo';
  $('#emptyText').textContent = 'Ajusta cuántos frames quieres en el paso 2 y pulsa «Extraer frames».';
  $('#pick2').hidden = true;
  updateEstimate();
}

function plannedTimes(){
  const a = Math.min(S.tStart, S.tEnd), b = Math.max(S.tStart, S.tEnd), dt = 1 / S.fps, t = [];
  for (let k = 0; ; k++) { const v = a + k * dt; if (v > b + 1e-6 || t.length >= MAX_FRAMES) break; t.push(v); }
  return t;
}
function outSize(){
  const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
  const w = Math.round(Math.min(S.maxW, vw));
  return [w, Math.max(1, Math.round(w * vh / vw))];
}

/* ---------- resolución de trabajo ---------- */
function scaleFor(w, h, n){
  if (S.work === 'auto') return Math.min(1, Math.sqrt(AUTO_PIXELS / Math.max(1, w * h * n)));
  return +S.work;
}
function workScale(){
  if (!S.frames.length) return 1;
  const c = S.frames[0].canvas;
  return scaleFor(c.width, c.height, S.frames.length);
}
function proxyOf(f, scale){
  if (scale >= 0.999) return f.canvas;
  const w = Math.max(8, Math.round(f.canvas.width * scale)), h = Math.max(8, Math.round(f.canvas.height * scale));
  if (!f.small || f.small.width !== w || f.small.height !== h) {
    const p = document.createElement('canvas'); p.width = w; p.height = h;
    p.getContext('2d').drawImage(f.canvas, 0, 0, w, h);
    f.small = p;
  }
  return f.small;
}
let stackScale = 1;
function applyStackRes(scale){
  stackScale = scale;
  S.frames.forEach(f => {
    const p = proxyOf(f, scale);
    if (f.tex.image !== p) { f.tex.image = p; f.tex.needsUpdate = true; }
  });
  requestRender();
}
onSeg('work', w => {
  S.work = w; segSet('work', w);
  updateEstimate();
  if (!S.frames.length) return;
  applyStackRes(workScale());
});
// Durante una exportación la pila pasa a resolución completa.
async function withExportRes(fn){
  const prev = stackScale;
  applyStackRes(1);
  try { return await fn(); }
  finally { applyStackRes(prev); layout(); }
}

function updateEstimate(){
  if (!video.videoWidth) return;
  const a = Math.min(S.tStart, S.tEnd), b = Math.max(S.tStart, S.tEnd);
  const raw = Math.floor((b - a) * S.fps + 1e-6) + 1;
  const n = Math.min(raw, MAX_FRAMES), [w, h] = outSize();
  const mb = n * w * h * 4 / 1e6, ws = scaleFor(w, h, n);
  $('#estimate').textContent =
    `Saldrán ${n} frames de ${w} × ${h} px, uno cada ${fmt(1 / S.fps, 3)} s (unos ${fmt(mb, 0)} MB en memoria). ` +
    `La vista trabajará al ${fmt(ws * 100, 0)} %.` +
    (raw > MAX_FRAMES ? ` El tramo daría ${raw}; se limita a ${MAX_FRAMES}. Baja los fps o acorta el tramo.` : '');
}

/* ---------- extracción de frames ---------- */
let busy = false, cancel = false, recording = false;
const EXPORT_IDS = ['dlOne', 'dlShot', 'dlVidFront', 'dlVid3d', 'dlAnim3d'];
function setExports(on){ EXPORT_IDS.forEach(id => { $('#' + id).disabled = !on; }); }
function seekTo(t){
  return new Promise(res => {
    let done = false;
    const fin = () => { if (done) return; done = true; video.removeEventListener('seeked', onS); clearTimeout(to); res(); };
    const onS = () => {
      if (video.requestVideoFrameCallback) { video.requestVideoFrameCallback(() => fin()); setTimeout(fin, 90); }
      else fin();
    };
    const to = setTimeout(fin, 4000);
    video.addEventListener('seeked', onS);
    video.currentTime = Math.min(t, Math.max(0, video.duration - 0.001));
  });
}
function clearFrames(){
  S.frames.forEach(f => { root.remove(f.mesh); f.tex.dispose(); f.mesh.material.dispose(); });
  S.frames = [];
  $('#strip').innerHTML = '';
  if (outline.parent) outline.parent.remove(outline);
  setExports(false);
  setPicking(null);
  $('#empty').style.display = '';
  $('#orbitHint').hidden = true;
  layout();
}
function addFrame(canvas, time, scale){
  const i = S.frames.length;
  const f = { canvas, time, small: null };
  const tex = new THREE.CanvasTexture(proxyOf(f, scale));
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const prev = i > 0 ? S.frames[i - 1] : null;
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({
      map: { value: tex }, prevMap: { value: prev ? prev.tex : tex }, opacity: { value: 1 }, fade: { value: 0 },
      seed: { value: i * 7.31 }, tpos: { value: 0 }, noise: U.noise, hw: U.hw
    }, PU),
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true
  });
  if (i === 1) S.frames[0].mesh.material.uniforms.prevMap.value = tex;  // el primero se compara con el segundo
  const mesh = new THREE.Mesh(geo, mat);
  root.add(mesh);
  f.tex = tex; f.mesh = mesh;
  S.frames.push(f);
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'thumb';
  b.setAttribute('aria-label', `Frame ${i + 1}, en ${fmt(time, 2)} segundos`);
  b.appendChild(canvas);
  const s = document.createElement('span'); s.textContent = `#${i + 1}  ${fmt(time, 2)} s`; b.appendChild(s);
  b.addEventListener('click', e => {
    if (picking) {
      const r = canvas.getBoundingClientRect();
      takeColor(sampleCanvas(canvas, clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)));
      return;
    }
    pause(); controls.selected.set(i + 1);
  });
  $('#strip').appendChild(b);
}
function syncFrameRanges(){
  const n = Math.max(1, S.frames.length);
  ['from', 'to', 'selected'].forEach(k => controls[k].range(1, n));
}
function markThumb(){
  const thumbs = $$('.thumb');
  thumbs.forEach((t, i) => t.setAttribute('aria-current', i === S.selected - 1));
  const cur = thumbs[S.selected - 1];
  if (cur) {
    const st = $('#strip'), l = cur.offsetLeft - st.offsetLeft;
    if (l < st.scrollLeft || l + cur.offsetWidth > st.scrollLeft + st.clientWidth) st.scrollLeft = l - st.clientWidth / 2 + cur.offsetWidth / 2;
  }
}

$('#extract').addEventListener('click', async () => {
  if (busy) { cancel = true; return; }
  if (recording) return;
  if (!glOK) toast('Tu navegador no tiene WebGL activo; no se puede mostrar la vista 3D.');
  pause(); animPause();
  clearFrames();
  busy = true; cancel = false;
  const btn = $('#extract'); btn.textContent = 'Cancelar extracción';
  const [w, h] = outSize();
  buildGeo(video.videoHeight / video.videoWidth);
  const times = plannedTimes();
  const scale = scaleFor(w, h, times.length);
  stackScale = scale;
  controls.from.silent(1); controls.selected.silent(1);
  $('#empty').style.display = 'none';
  $('#progress').style.display = 'block';
  video.pause();
  const ms = maxScale();
  O.r = clamp(Math.max((times.length - 1) * S.spacing, 100 * ms, S.frameH * ms) * 1.35 + 90, 60, 300000);
  for (let k = 0; k < times.length; k++) {
    if (cancel) break;
    await seekTo(times[k]);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, w, h);
    addFrame(c, times[k], scale);
    syncFrameRanges(); controls.to.silent(S.frames.length);
    if (k === 0) markThumb();
    layout();
    $('#progressText').textContent = `Extrayendo frame ${k + 1} de ${times.length}`;
    $('#progressBar').style.width = ((k + 1) / times.length * 100) + '%';
  }
  $('#progress').style.display = 'none';
  btn.textContent = 'Extraer frames'; busy = false;
  if (!S.frames.length) { clearFrames(); return; }
  syncFrameRanges(); controls.to.silent(S.frames.length); markThumb();
  applyStackRes(workScale());
  setExports(true);
  $('#orbitHint').hidden = false;
  layout(); fitView();
  toast(cancel ? `Extracción detenida: ${S.frames.length} frames` : `${S.frames.length} frames extraídos`);
});

/* ---------- animación por keyframes ---------- */
const ANIM_KEYS = ['spacing', 'selected', 'zone', 'scale', 'sCenter', 'sEdge', 'amp', 'cycles', 'phase', 'twist',
  'opCenter', 'opEdge', 'efCenter', 'efEdge', 'noise', 'lumaThr', 'lumaSoft', 'chromaTol', 'chromaSoft',
  'motionThr', 'motionSoft', 'tintAmt'];
const A = { keys: [], t: 0, playing: false, last: 0 };
function snapshot(){
  const v = {};
  ANIM_KEYS.forEach(k => { v[k] = S[k]; });
  v.camTheta = O.theta; v.camPhi = O.phi; v.camR = O.r; v.frontZoom = frontZoom; v.isoZoom = isoZoom;
  return v;
}
function applyVals(v){
  for (const k in v) {
    if (k === 'camTheta') O.theta = v[k];
    else if (k === 'camPhi') O.phi = v[k];
    else if (k === 'camR') O.r = v[k];
    else if (k === 'frontZoom') frontZoom = v[k];
    else if (k === 'isoZoom') isoZoom = v[k];
    else if (controls[k]) controls[k].silent(k === 'selected' ? clamp(Math.round(v[k]), 1, Math.max(1, S.frames.length)) : v[k]);
  }
  markThumb(); layout();
}
function evalAt(t){
  const K = A.keys; if (!K.length) return;
  let v;
  if (K.length === 1 || t <= K[0].t) v = K[0].v;
  else if (t >= K[K.length - 1].t) v = K[K.length - 1].v;
  else {
    let i = 0; while (K[i + 1].t < t) i++;
    const a = K[i], b = K[i + 1];
    let f = (t - a.t) / Math.max(1e-6, b.t - a.t);
    if ($('#animEase').checked) f = f * f * (3 - 2 * f);
    v = {};
    for (const k in a.v) v[k] = k in b.v ? a.v[k] + (b.v[k] - a.v[k]) * f : a.v[k];
  }
  applyVals(v);
}
function animLabel(){ $('#animClock').textContent = `${fmt(A.t, 2)} s de ${fmt(S.animDur, 1)} s`; }
function drawMarks(){
  const m = $('#tlMarks'); m.innerHTML = '';
  A.keys.forEach(k => {
    if (k.t > S.animDur + 1e-6) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'kf' + (Math.abs(k.t - A.t) < 0.02 ? ' cur' : '');
    b.style.left = (k.t / S.animDur * 100) + '%';
    b.setAttribute('aria-label', `Keyframe en ${fmt(k.t, 2)} segundos`);
    b.title = `${fmt(k.t, 2)} s`;
    b.addEventListener('click', () => { animPause(); setAnimTime(k.t); });
    m.appendChild(b);
  });
  $('#kfCount').textContent = A.keys.length ? `${A.keys.length} keyframe${A.keys.length > 1 ? 's' : ''}` : 'Sin keyframes';
}
function setAnimTime(t, apply = true){
  A.t = clamp(t, 0, S.animDur);
  $('#animT').value = A.t;
  animLabel(); drawMarks();
  if (apply) evalAt(A.t);
}
let lastDur = S.animDur;
// Al cambiar la duración, los keyframes se estiran o comprimen en proporción.
function animUI(){
  const f = S.animDur / lastDur; lastDur = S.animDur;
  if (f !== 1) { A.keys.forEach(k => { k.t *= f; }); A.t *= f; }
  $('#animT').max = S.animDur; setAnimTime(A.t, false);
}
$('#animT').addEventListener('input', () => { animPause(); setAnimTime(+$('#animT').value); });
function animTick(now){
  if (!A.playing) return;
  let t = A.t + (now - A.last) / 1000; A.last = now;
  if (t > S.animDur) {
    if ($('#animLoop').checked) t = t % S.animDur;
    else { setAnimTime(S.animDur); animPause(); return; }
  }
  setAnimTime(t);
  requestAnimationFrame(animTick);
}
function animPlay(){
  if (recording) return;
  if (A.keys.length < 2) { toast('Añade al menos dos keyframes, o usa un atajo, para animar.'); return; }
  pause();
  A.playing = true; A.last = performance.now();
  if (A.t >= S.animDur - 1e-3) A.t = 0;
  $('#animPlay').textContent = 'Pausar animación';
  requestAnimationFrame(animTick);
}
function animPause(){ A.playing = false; $('#animPlay').textContent = 'Reproducir animación'; }
$('#animPlay').addEventListener('click', () => A.playing ? animPause() : animPlay());
$('#kfAdd').addEventListener('click', () => {
  if (!S.frames.length) { toast('Primero extrae frames.'); return; }
  const v = snapshot(), ex = A.keys.find(k => Math.abs(k.t - A.t) < 0.02);
  if (ex) ex.v = v; else A.keys.push({ t: A.t, v });
  A.keys.sort((a, b) => a.t - b.t);
  drawMarks();
  toast(`${ex ? 'Keyframe actualizado' : 'Keyframe añadido'} en ${fmt(A.t, 2)} s. Mueve el tiempo, cambia algo y añade otro.`);
});
$('#kfDel').addEventListener('click', () => {
  let best = -1, bd = 0.15;
  A.keys.forEach((k, i) => { const d = Math.abs(k.t - A.t); if (d <= bd) { bd = d; best = i; } });
  if (best < 0) { toast('No hay un keyframe en este tiempo.'); return; }
  A.keys.splice(best, 1); drawMarks();
});
$('#kfClear').addEventListener('click', () => { animPause(); A.keys = []; drawMarks(); });
function quickAnim(tweak, msg){
  if (!S.frames.length) { toast('Primero extrae frames.'); return; }
  animPause();
  const a = snapshot(), b = snapshot();
  tweak(a, b);
  A.keys = [{ t: 0, v: a }, { t: S.animDur, v: b }];
  setAnimTime(0);
  toast(msg);
}
$('#quickOrbit').addEventListener('click', () => {
  if (S.view !== 'free') setView('free');
  quickAnim((a, b) => { b.camTheta = a.camTheta + 2 * Math.PI; }, 'Órbita creada. Pulsa «Reproducir animación».');
});
$('#quickWalk').addEventListener('click', () => {
  quickAnim((a, b) => { a.selected = Math.min(S.from, S.to); b.selected = Math.max(S.from, S.to); }, 'Recorrido creado. Pulsa «Reproducir animación».');
});

/* ---------- descargas ----------
 * Dentro del visor de Claude se usa su capacidad de descargas;
 * en cualquier otro sitio (por ejemplo GitHub Pages) se usa un enlace normal. */
let dlNs;
async function getDL(){
  if (dlNs !== undefined) return dlNs;
  if (window.claude && typeof window.claude.use === 'function') {
    try { dlNs = await window.claude.use('downloads'); } catch (e) { dlNs = null; }
  } else dlNs = false;
  return dlNs;
}
async function saveFile(name, blob){
  const ns = await getDL();
  if (ns) {
    try { await ns.save({ filename: name, data: blob }); toast('Guardado: ' + name); }
    catch (e) { toast(e && e.code === 'declined' ? 'Descarga cancelada' : 'No se pudo guardar el archivo (' + ((e && e.code) || 'error') + ')'); }
    return;
  }
  if (ns === false) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return;
  }
  toast('Las descargas no están disponibles en esta vista.');
}
const toBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
const pad = (i, n) => String(i).padStart(String(n).length, '0');

$('#dlOne').addEventListener('click', async () => {
  const i = S.selected - 1, f = S.frames[i]; if (!f) return;
  saveFile(`${videoName}_frame_${pad(i + 1, S.frames.length)}.png`, await toBlob(f.canvas));
});
async function exclusive(btn, fn){
  if (recording) return;
  recording = true; setExports(false); syncTransport();
  const label = btn.textContent; btn.textContent = 'Preparando…';
  try { return await fn(); }
  finally { recording = false; btn.textContent = label; setExports(S.frames.length > 0); syncTransport(); }
}
$('#dlShot').addEventListener('click', e => {
  if (!glOK) return;
  exclusive(e.currentTarget, async () => {
    let blob;
    await withExportRes(async () => { layout(); renderer.render(scene, activeCam()); blob = await toBlob(renderer.domElement); });
    saveFile(`${videoName}_vista3d.png`, blob);
  });
});

/* ---------- videos ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const even = n => Math.max(2, Math.round(n / 2) * 2);
function pickMime(){
  const opts = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return opts.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}
let recCancel = false;
const VIDEO_TITLES = { front: 'video frontal', '3d': 'video vista 3D', anim3d: 'video de la animación' };
async function recordVideo(kind, btn){
  if (recording) { if (btn.dataset.rec) recCancel = true; return; }
  if (!glOK) return;
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('Este navegador no puede grabar video desde la vista.'); return; }
  const stackKind = kind === 'front' || kind === '3d';
  const vis = visibleIdx(), fps = playFps();
  if (stackKind && vis.length < 2) { toast('Necesitas al menos dos frames en la pila para grabar un video.'); return; }
  if (!stackKind && A.keys.length < 2) { toast('Añade al menos dos keyframes, o usa un atajo de animación, para grabar este video.'); return; }
  pause(); animPause(); setPicking(null);

  const prevView = S.view, prevSel = S.selected, prevPR = renderer.getPixelRatio(), prevT = A.t, snap = snapshot();
  const label = btn.textContent;
  recording = true; recCancel = false; btn.dataset.rec = '1';
  EXPORT_IDS.forEach(id => $('#' + id).disabled = id !== btn.id);
  btn.textContent = 'Detener grabación';
  syncTransport();
  const steps = stackKind ? vis.length : Math.max(2, Math.round(S.animDur * fps) + 1);
  let blob = null, ext = 'webm';

  try {
    await withExportRes(async () => {
      if (kind === 'front') setView('front');
      else if (kind === '3d' && prevView === 'front') setView('free');
      let w, h;
      if (kind === 'front') {
        const c = S.frames[0].canvas;
        w = even(Math.min(1920, Math.max(720, c.width * 2))); h = even(w * c.height / c.width);
      } else {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = even(Math.min(1920, vp.clientWidth * dpr)); h = even(w * vp.clientHeight / vp.clientWidth);
      }
      renderer.setPixelRatio(1); recSize = [w, h]; renderer.setSize(w, h, false); updateCamera();
      const canvas = renderer.domElement;

      let stream = canvas.captureStream(0), track = stream.getVideoTracks()[0];
      const manual = track && typeof track.requestFrame === 'function';
      if (!manual) { stream.getTracks().forEach(t => t.stop()); stream = canvas.captureStream(fps); track = stream.getVideoTracks()[0]; }
      const mime = pickMime(), chunks = [];
      let rec;
      try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10e6 } : { videoBitsPerSecond: 10e6 }); }
      catch (e) { rec = new MediaRecorder(stream); }
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise(r => rec.onstop = r);

      $('#progress').style.display = 'block';
      const drawAt = k => {
        if (stackKind) setSelected(vis[k] + 1);
        else { A.t = Math.min(S.animDur, k / fps); evalAt(A.t); }
        renderer.render(scene, activeCam());
        if (manual) track.requestFrame();
        $('#progressText').textContent = `Grabando ${VIDEO_TITLES[kind]}: ${k + 1} de ${steps}`;
        $('#progressBar').style.width = ((k + 1) / steps * 100) + '%';
      };
      drawAt(0);
      rec.start(250);
      const dt = 1000 / fps, t0 = performance.now();
      for (let k = 0; k < steps && !recCancel; k++) {
        if (k > 0) drawAt(k);
        await sleep(Math.max(0, t0 + (k + 1) * dt - performance.now()));
      }
      if (manual) track.requestFrame();
      rec.stop(); await stopped;
      stream.getTracks().forEach(t => t.stop());
      const type = rec.mimeType || mime || 'video/webm';
      ext = type.includes('mp4') ? 'mp4' : 'webm';
      if (!recCancel) blob = new Blob(chunks, { type: type.split(';')[0] });
    });
  } catch (e) {
    toast('No se pudo grabar el video.');
  } finally {
    $('#progress').style.display = 'none';
    recSize = null; renderer.setPixelRatio(prevPR);
    recording = false; delete btn.dataset.rec;
    btn.textContent = label;
    setExports(S.frames.length > 0);
    setView(prevView);
    if (!stackKind) { A.t = prevT; applyVals(snap); setAnimTime(prevT, false); }
    setSelected(prevSel); resize();
  }
  if (recCancel) { toast('Grabación detenida'); return; }
  if (blob) {
    const names = { front: 'frontal', '3d': 'vista3d', anim3d: 'animacion' };
    saveFile(`${videoName}_${names[kind]}.${ext}`, blob);
  }
}
$('#dlVidFront').addEventListener('click', e => recordVideo('front', e.currentTarget));
$('#dlVid3d').addEventListener('click', e => recordVideo('3d', e.currentTarget));
$('#dlAnim3d').addEventListener('click', e => recordVideo('anim3d', e.currentTarget));

/* ---------- inicio ---------- */
if (!glOK) $('#emptyText').textContent = 'Este navegador no tiene WebGL activo, así que la vista 3D no está disponible. Aún puedes extraer y descargar los frames.';
$('#orbitHint').textContent = VIEW_HINTS.free;
applyBg();
resize();
setScaleMode('const');
animUI();
})();
