// The night desk: a three.js scene whose monitor draws the shared shell.
// Scrolling (or opening the console) moves the camera into the screen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { shell } from './shell';

const sceneEl = document.querySelector<HTMLElement>('.scene');
if (sceneEl) initDesk(sceneEl);

function initDesk(sceneEl: HTMLElement) {
  const pin = sceneEl.querySelector<HTMLElement>('.scene-pin')!;
  const canvas = sceneEl.querySelector<HTMLCanvasElement>('#gl')!;
  const copyEl = sceneEl.querySelector<HTMLElement>('.scene-copy')!;
  const veil = sceneEl.querySelector<HTMLElement>('.scene-veil')!;
  const screenInput = document.getElementById('screen-input') as HTMLInputElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  // render-loop state; the loop sleeps when nothing moves
  let inView = true, p = 0, lastCopy = -1, lastVeil = -1, idleFrames = 0, running = false;
  // zoomP drives the same camera move as scrolling, for the ` fly-in
  let zoomP = 0;
  let zoomAnim: { from: number; to: number; t0: number; ms: number; res: () => void } | null = null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    document.documentElement.classList.add('no-gl');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const GROUND = new THREE.Color('#12100d');
  const scene = new THREE.Scene();
  scene.background = GROUND;
  scene.fog = new THREE.Fog(GROUND, 3.4, 8);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.03, 30);

  const std = (color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  function put(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 14), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    m.castShadow = true;
    return m;
  }
  const tag = (obj: THREE.Object3D, role: string) => { obj.traverse(o => { o.userData.role = role; }); return obj; };

  // ── room ──
  function woodTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = '#5b3e2b';
    g.fillRect(0, 0, c.width, c.height);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) {
      const y = rnd() * c.height, a = rnd() * 0.16;
      g.strokeStyle = rnd() < 0.55 ? `rgba(28,15,8,${a})` : `rgba(150,104,66,${a * 0.7})`;
      g.lineWidth = rnd() * 2.4 + 0.4;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= c.width; x += 48) g.lineTo(x, y + Math.sin(x * 0.005 + i) * 4 + (rnd() - 0.5) * 1.6);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  put(new THREE.PlaneGeometry(8, 4), std('#211c17', 0.95), 0, 1.6, -0.62, scene, false);
  put(new THREE.PlaneGeometry(8, 6), std('#15120e', 0.9), 0, 0, 0.6, scene, false).rotation.x = -Math.PI / 2;

  put(new RoundedBoxGeometry(1.72, 0.04, 0.8, 2, 0.008), std('#ffffff', 0.58, 0, { map: woodTexture() }), 0, 0.73, -0.02);
  const legMat = std('#1f1d1a', 0.5, 0.4);
  put(new THREE.BoxGeometry(0.04, 0.71, 0.66), legMat, -0.78, 0.355, -0.04);
  put(new THREE.BoxGeometry(0.04, 0.71, 0.66), legMat, 0.78, 0.355, -0.04);

  // ── monitor ──
  const SW = 0.62, SH = 0.36;
  const MON_Z = -0.24, MON_Y = 0.75 + 0.27;
  const monMat = std('#1b1a19', 0.42, 0.25);
  put(new RoundedBoxGeometry(SW + 0.026, SH + 0.032, 0.03, 4, 0.008), monMat, 0, MON_Y, MON_Z);
  put(new THREE.BoxGeometry(0.05, 0.25, 0.02), monMat, 0, 0.75 + 0.125, MON_Z - 0.03);
  put(new RoundedBoxGeometry(0.24, 0.012, 0.17, 2, 0.004), monMat, 0, 0.756, MON_Z - 0.01);

  const SCR = { w: 1600, h: 929 };
  const sc = document.createElement('canvas');
  sc.width = SCR.w;
  sc.height = SCR.h;
  const sx = sc.getContext('2d')!;
  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screen = put(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }), 0, MON_Y, MON_Z + 0.0156, scene, false);
  tag(screen, 'screen');
  const SCREEN_C = new THREE.Vector3(0, MON_Y, MON_Z + 0.0156);

  // ── keyboard: every key is real and moves when you type ──
  type KeyDef = [code: string, w?: number, kind?: 'alpha' | 'mod' | 'accent'];
  const u = 0.0265;
  const L = (s: string): KeyDef[] => s.split('').map(ch => ['Key' + ch.toUpperCase()]);
  const ROWS: KeyDef[][] = [
    [['Backquote'], ...'1234567890'.split('').map((d): KeyDef => ['Digit' + d]), ['Minus'], ['Equal'], ['Backspace', 2, 'mod']],
    [['Tab', 1.5, 'mod'], ...L('qwertyuiop'), ['BracketLeft'], ['BracketRight'], ['Backslash', 1.5]],
    [['CapsLock', 1.75, 'mod'], ...L('asdfghjkl'), ['Semicolon'], ['Quote'], ['Enter', 2.25, 'accent']],
    [['ShiftLeft', 2.25, 'mod'], ...L('zxcvbnm'), ['Comma'], ['Period'], ['Slash'], ['ShiftRight', 2.75, 'mod']],
    [['ControlLeft', 1.25, 'mod'], ['AltLeft', 1.25, 'mod'], ['MetaLeft', 1.25, 'mod'], ['Space', 6.25],
     ['MetaRight', 1.25, 'mod'], ['AltRight', 1.25, 'mod'], ['ContextMenu', 1.25, 'mod'], ['ControlRight', 1.25, 'mod']],
  ];
  const kb = new THREE.Group();
  kb.position.set(0, 0.75, 0.15);
  scene.add(kb);
  put(new RoundedBoxGeometry(0.43, 0.018, 0.152, 3, 0.005), std('#2a2723', 0.5, 0.15), 0, 0.009, 0, kb);
  const keyMats = { alpha: std('#d8cfbe', 0.55), mod: std('#3b3631', 0.6), accent: std('#e9a440', 0.5) };
  const capGeo: Record<number, THREE.BufferGeometry> = {};
  const KEYS: Record<string, { m: THREE.Mesh; y: number; t: number }> = {};
  ROWS.forEach((row, r) => {
    let cx = 0;
    row.forEach(([code, w = 1, kind = 'alpha']) => {
      const g = capGeo[w] || (capGeo[w] = new RoundedBoxGeometry(w * u - 0.0034, 0.011, u - 0.0034, 2, 0.0022));
      const m = put(g, keyMats[kind], -7.5 * u + (cx + w / 2) * u, 0.0235, (r - 2) * u, kb);
      KEYS[code] = { m, y: m.position.y, t: -1 };
      cx += w;
    });
  });
  put(new THREE.SphereGeometry(1, 28, 18), std('#d8cfbe', 0.5), 0.31, 0.762, 0.17).scale.set(0.031, 0.016, 0.052);

  // ── things on the desk ──
  const mug = new THREE.Group();
  mug.position.set(-0.4, 0.75, -0.02);
  mug.rotation.y = 0.9;
  scene.add(mug);
  const glaze = std('#3f6455', 0.32, 0, { side: THREE.DoubleSide });
  put(new THREE.CylinderGeometry(0.042, 0.039, 0.1, 36, 1, true), glaze, 0, 0.05, 0, mug);
  put(new THREE.CircleGeometry(0.039, 36), glaze, 0, 0.001, 0, mug).rotation.x = -Math.PI / 2;
  put(new THREE.CircleGeometry(0.039, 36), std('#20120a', 0.15), 0, 0.084, 0, mug, false).rotation.x = -Math.PI / 2;
  put(new THREE.TorusGeometry(0.026, 0.0068, 12, 24, Math.PI), glaze, 0.041, 0.052, 0, mug).rotation.z = -Math.PI / 2;

  let by = 0.75;
  ([
    ['#5c2a26', 0.205, 0.032, 0.148, 0.08],
    ['#3e4a3a', 0.19, 0.028, 0.14, -0.07],
    ['#7a5d3e', 0.172, 0.026, 0.126, 0.16],
  ] as const).forEach(([c, w, h, d, ry]) => {
    put(new THREE.BoxGeometry(w, h, d), std(c, 0.75), -0.6, by + h / 2, -0.25).rotation.y = ry;
    by += h;
  });

  const phone = new THREE.Group();
  phone.position.set(-0.24, 0.75, 0.2);
  phone.rotation.y = 0.42;
  scene.add(phone);
  put(new RoundedBoxGeometry(0.074, 0.008, 0.154, 3, 0.004), std('#121212', 0.35, 0.3), 0, 0.004, 0, phone);
  const shot = sceneEl.dataset.phoneShot;
  const phoneMat = new THREE.MeshBasicMaterial({ color: shot ? '#8f8f8f' : '#1a1a1a', toneMapped: false });
  if (shot) {
    new THREE.TextureLoader().load(shot, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      phoneMat.map = t;
      phoneMat.needsUpdate = true;
      wake();
    });
  }
  put(new THREE.PlaneGeometry(0.067, 0.146), phoneMat, 0, 0.0085, 0, phone, false).rotation.x = -Math.PI / 2;
  tag(phone, 'phone');

  // ── lamp ──
  const lampMat = std('#2b2926', 0.38, 0.55, { side: THREE.DoubleSide });
  const P0 = new THREE.Vector3(0.54, 0.765, -0.28);
  const J1 = new THREE.Vector3(0.52, 1.13, -0.36);
  const H = new THREE.Vector3(0.31, 1.19, -0.1);
  const LT = new THREE.Vector3(0.1, 0.75, 0.12);
  const dir = new THREE.Vector3().subVectors(LT, H).normalize();
  const lamp = new THREE.Group();
  scene.add(lamp);
  put(new THREE.CylinderGeometry(0.066, 0.076, 0.016, 36), lampMat, P0.x, 0.758, P0.z, lamp);
  lamp.add(rod(P0, J1, 0.0075, lampMat), rod(J1, H, 0.0075, lampMat));
  put(new THREE.SphereGeometry(0.013, 16, 12), lampMat, J1.x, J1.y, J1.z, lamp);
  const shade = put(new THREE.CylinderGeometry(0.016, 0.062, 0.1, 36, 1, true), lampMat, 0, 0, 0, lamp);
  shade.position.copy(H).addScaledVector(dir, 0.03);
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffe3b4' });
  put(new THREE.SphereGeometry(0.012, 16, 12), bulbMat, 0, 0, 0, lamp, false).position.copy(H).addScaledVector(dir, 0.038);
  tag(lamp, 'lamp');

  const spot = new THREE.SpotLight('#ffcf94', 7, 4, 0.66, 0.75, 2);
  spot.position.copy(H).addScaledVector(dir, 0.06);
  spot.target.position.copy(LT);
  spot.castShadow = true;
  spot.shadow.mapSize.set(coarse ? 512 : 1024, coarse ? 512 : 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.01;
  spot.shadow.camera.near = 0.05;
  spot.shadow.camera.far = 3;
  scene.add(spot, spot.target);

  scene.add(new THREE.HemisphereLight('#51432f', '#0d0b09', 0.7));
  const rim = new THREE.DirectionalLight('#9aa8bd', 0.45);
  rim.position.set(-2.4, 2.6, -1.4);
  scene.add(rim);
  const glow = new THREE.PointLight('#ffd7a3', 0.5, 1.4, 2);
  glow.position.set(0, 1.0, 0.0);
  scene.add(glow);

  // ── the monitor's screen draws the shared shell ──
  const C = { bg: '#100e0b', bar: '#1b1814', ink: '#e8e1d4', out: '#bdb3a2', sys: '#8f8676', acc: '#e9a440' };
  const FS = 30, LH = 42, PAD = 46, BAR = 60;
  const FONT = `400 ${FS}px "Red Hat Mono", ui-monospace, Menlo, monospace`;
  type Seg = { s: string; c: string };
  let caretOn = true;
  const segsFor = (l: (typeof shell.lines)[number]): Seg[] =>
    l.t === 'in'
      ? [{ s: shell.promptFor(l.cwd ?? '~'), c: C.acc }, { s: l.s, c: C.ink }]
      : [{ s: l.s, c: l.t === 'sys' ? C.sys : C.out }];
  function wrapInto(rows: Seg[][], segs: Seg[], cols: number) {
    let row: Seg[] = [], n = 0, pushed = false;
    for (const seg of segs) {
      let s = seg.s;
      while (s.length) {
        const take = Math.min(cols - n, s.length);
        row.push({ s: s.slice(0, take), c: seg.c });
        n += take;
        s = s.slice(take);
        if (n >= cols) { rows.push(row); pushed = true; row = []; n = 0; }
      }
    }
    if (n > 0 || !pushed) rows.push(row);
  }
  function drawScreen() {
    const g = sx;
    g.fillStyle = C.bg;
    g.fillRect(0, 0, SCR.w, SCR.h);
    g.font = FONT;
    g.textBaseline = 'top';
    const cw = g.measureText('MMMMMMMMMM').width / 10;
    const cols = Math.floor((SCR.w - PAD * 2) / cw);
    const fit = Math.floor((SCR.h - BAR - PAD * 1.4) / LH);

    g.fillStyle = C.bar;
    g.fillRect(0, 0, SCR.w, BAR);
    g.font = `400 24px "Red Hat Mono", ui-monospace, monospace`;
    g.textAlign = 'center';
    g.fillStyle = C.sys;
    g.fillText(`jj@dorko: ${shell.cwd} — zsh — ${cols}×${fit}`, SCR.w / 2, 18);
    g.textAlign = 'left';
    g.font = FONT;

    const rows: Seg[][] = [];
    for (const l of shell.lines) wrapInto(rows, segsFor(l), cols);
    wrapInto(rows, [{ s: shell.promptFor(shell.cwd), c: C.acc }, { s: shell.input, c: C.ink }], cols);
    const start = Math.max(0, rows.length - fit);
    const top = BAR + PAD * 0.7;
    for (let i = start; i < rows.length; i++) {
      let x = PAD;
      for (const seg of rows[i]) {
        g.fillStyle = seg.c;
        g.fillText(seg.s, x, top + (i - start) * LH);
        x += seg.s.length * cw;
      }
    }
    const n = rows[rows.length - 1].reduce((a, s) => a + s.s.length, 0);
    const cx = PAD + n * cw, cy = top + (rows.length - 1 - start) * LH;
    const focused = document.activeElement === screenInput;
    if (focused && caretOn) {
      g.fillStyle = C.acc;
      g.fillRect(cx, cy, cw, FS + 4);
    } else if (!focused) {
      g.strokeStyle = C.acc;
      g.lineWidth = 2;
      g.strokeRect(cx + 1, cy + 1, cw - 2, FS + 2);
    }
    screenTex.needsUpdate = true;
    wake();
  }
  shell.on(drawScreen);
  document.fonts.load(FONT).then(drawScreen, drawScreen);
  setInterval(() => {
    if (document.activeElement !== screenInput) return;
    caretOn = !caretOn;
    drawScreen();
  }, 530);
  screenInput.addEventListener('focus', () => { caretOn = true; drawScreen(); });
  screenInput.addEventListener('blur', drawScreen);

  // ── camera: one authored move, from the room into the screen ──
  const T0 = new THREE.Vector3(0.02, 0.9, -0.08);
  const S0 = new THREE.Vector3(-0.66, 1.38, 1.34);
  const S = new THREE.Vector3(), E = new THREE.Vector3();
  let W = 1, Hh = 1;
  function layout() {
    W = pin.clientWidth;
    Hh = pin.clientHeight;
    renderer.setSize(W, Hh, false);
    camera.aspect = W / Hh;
    // pull back on narrow screens so the whole desk fits
    const k = Math.max(1, 1.05 / camera.aspect);
    S.copy(T0).addScaledVector(new THREE.Vector3().subVectors(S0, T0), k);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.min((SH / 2) / t, (SW / 2) / (t * camera.aspect));
    E.copy(SCREEN_C).add(new THREE.Vector3(0, 0, d * 0.9));
    wake();
  }
  window.addEventListener('resize', layout);

  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function progress() {
    if (reduce) return 0;
    const total = sceneEl.offsetHeight - pin.clientHeight;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, -sceneEl.getBoundingClientRect().top / total));
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    wake();
  }, { passive: true });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = [screen, lamp, phone];
  function pick(ev: MouseEvent): string | null {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, true)[0];
    return hit ? hit.object.userData.role : null;
  }
  canvas.addEventListener('click', ev => {
    const role = pick(ev);
    if (role === 'screen') coarse ? shell.openConsole() : screenInput.focus({ preventScroll: true });
    else if (role === 'lamp') shell.run('lamp');
    else if (role === 'phone') shell.goto('work');
    else if (document.activeElement === screenInput) screenInput.blur();
  });
  let hoverEv: PointerEvent | null = null;
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') hoverEv = e; });

  // Typing anywhere on the intro goes to the monitor
  document.addEventListener('keydown', e => {
    const k = KEYS[e.code];
    if (k && inView) { k.t = performance.now(); wake(); }
    const typing = (e.target as Element).matches?.('input, textarea, select, [contenteditable]');
    if (!typing && inView && p < 0.4 && !e.metaKey && !e.ctrlKey && !e.altKey && /^[a-z0-9]$/i.test(e.key)) {
      screenInput.focus({ preventScroll: true });
    }
  });

  new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (inView) wake(); }).observe(sceneEl);
  window.addEventListener('scroll', wake, { passive: true });

  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  function wake() {
    idleFrames = 0;
    if (!running) { running = true; requestAnimationFrame(frame); }
  }
  function frame(now: number) {
    if (!inView) { running = false; return; }
    p = progress();
    if (zoomAnim) {
      const k = Math.min(1, (performance.now() - zoomAnim.t0) / zoomAnim.ms);
      zoomP = zoomAnim.from + (zoomAnim.to - zoomAnim.from) * k;
      if (k >= 1) { const r = zoomAnim.res; zoomAnim = null; r(); }
    }
    const pe = Math.max(p, zoomP);
    const e = ease(pe);
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    pos.lerpVectors(S, E, e);
    tgt.lerpVectors(T0, SCREEN_C, e);
    if (!reduce) {
      pos.x += pointer.x * 0.07 * (1 - e);
      pos.y -= pointer.y * 0.04 * (1 - e);
    }
    camera.position.copy(pos);
    camera.lookAt(tgt);
    // keep the desk right of the intro copy, centering as the camera moves in
    const wide = camera.aspect > 1.05;
    const dx = wide ? W * 0.16 * (1 - e) : 0;
    const dy = wide ? 0 : Hh * 0.15 * (1 - e);
    camera.setViewOffset(W, Hh, -dx, -dy, W, Hh);
    camera.updateProjectionMatrix();

    let animating = !!zoomAnim || Math.abs(pointer.tx - pointer.x) > 0.001 || Math.abs(pointer.ty - pointer.y) > 0.001;
    for (const code in KEYS) {
      const k = KEYS[code];
      if (k.t < 0) continue;
      const dt = now - k.t;
      const d = dt < 60 ? dt / 60 : dt < 220 ? 1 - (dt - 60) / 160 : 0;
      k.m.position.y = k.y - 0.0045 * d;
      if (dt >= 220) k.t = -1;
      else animating = true;
    }

    const copyO = 1 - smooth(0.02, 0.2, pe);
    if (Math.abs(copyO - lastCopy) > 0.002) {
      copyEl.style.opacity = copyO.toFixed(3);
      copyEl.style.visibility = copyO < 0.01 ? 'hidden' : '';
      lastCopy = copyO;
    }
    const veilO = smooth(0.8, 0.98, p);
    if (Math.abs(veilO - lastVeil) > 0.002) {
      veil.style.opacity = veilO.toFixed(3);
      lastVeil = veilO;
    }

    if (hoverEv) {
      canvas.style.cursor = pick(hoverEv) ? 'pointer' : '';
      hoverEv = null;
    }

    renderer.render(scene, camera);
    if (animating) idleFrames = 0;
    else idleFrames++;
    if (idleFrames > 30) { running = false; return; }
    requestAnimationFrame(frame);
  }

  shell.desk = {
    inHero: () => inView && progress() < 0.35,
    zoom(to, ms) {
      return new Promise<void>(res => {
        zoomAnim?.res();
        zoomAnim = { from: zoomP, to, t0: performance.now(), ms, res };
        // never leave the console waiting if the loop is paused
        setTimeout(() => {
          if (zoomAnim?.res === res) { zoomP = to; zoomAnim = null; res(); }
        }, ms + 250);
        wake();
      });
    },
    reset() {
      zoomAnim?.res();
      zoomAnim = null;
      zoomP = 0;
    },
    toggleLamp() {
      spot.visible = !spot.visible;
      bulbMat.color.set(spot.visible ? '#ffe3b4' : '#4a4238');
      wake();
      return spot.visible;
    },
  };

  layout();
  drawScreen();
}
