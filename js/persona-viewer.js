// ══════════════════════════════
//  PersonaViewer — 3D 페르소나 뷰어 모듈 v2
//  페르소나 매니저/앱 내 임베드용
//
//  사용법:
//    const viewer = await PersonaViewer.init({
//      container: el,     // 뷰어가 들어갈 div (크기 미리 지정 필요)
//      data: personaObj,  // 3d_personas.json 항목 하나
//    });
//    viewer.play('idle');
//    viewer.destroy();
// ══════════════════════════════

const PersonaViewer = (() => {

  const THREE_URL  = 'https://unpkg.com/three@0.160.0/build/three.module.js';
  const ADDON_BASE = 'https://unpkg.com/three@0.160.0/examples/jsm/';

  let _libPromise = null;
  function loadLibs() {
    if (_libPromise) return _libPromise;
    _libPromise = Promise.all([
      import(THREE_URL),
      import(`${ADDON_BASE}loaders/GLTFLoader.js`),
      import(`${ADDON_BASE}loaders/FBXLoader.js`),
      import(`${ADDON_BASE}controls/OrbitControls.js`),
    ]).then(([THREE, { GLTFLoader }, { FBXLoader }, { OrbitControls }]) =>
      ({ THREE, GLTFLoader, FBXLoader, OrbitControls })
    );
    return _libPromise;
  }

  // ── UI 빌더 ───────────────────────────────
  function buildUI(container, data) {
    container.style.cssText = `
      position:relative; width:100%; height:100%;
      background:var(--surface,#0e0e11);
      border-radius:12px; overflow:hidden;
      display:flex; flex-direction:column;
    `;

    const viewport = document.createElement('div');
    viewport.style.cssText = `flex:1; position:relative; overflow:hidden; cursor:grab;`;

    const bg = data?.background;
    if (bg?.type === 'gradient') {
      viewport.style.background = `linear-gradient(to top, ${bg.bottom||'#444'}, ${bg.top||'#888'})`;
    } else if (bg?.type === 'image' && bg.url) {
      viewport.style.background = `url(${bg.url}) center/cover no-repeat`;
    } else {
      viewport.style.background = `linear-gradient(to top, #1a1a22, #2a2a36)`;
    }

    const bar = document.createElement('div');
    bar.style.cssText = `
      display:flex; align-items:center; gap:6px; padding:8px 12px;
      background:var(--surface,#0e0e11);
      border-top:1px solid var(--border,#1e1e26);
      flex-shrink:0;
    `;

    function makeBtn(icon, title, fn) {
      const b = document.createElement('button');
      b.title = title; b.textContent = icon;
      b.style.cssText = `
        background:transparent; border:1px solid var(--border2,#2a2a36);
        color:var(--muted,#52526a); border-radius:6px;
        width:28px; height:28px; cursor:pointer; font-size:11px;
        display:flex; align-items:center; justify-content:center;
        transition:all .15s; flex-shrink:0;
      `;
      b.onmouseenter = () => { b.style.color = 'var(--text,#e8e8f0)'; b.style.borderColor = 'var(--muted,#52526a)'; };
      b.onmouseleave = () => { b.style.color = 'var(--muted,#52526a)'; b.style.borderColor = 'var(--border2,#2a2a36)'; };
      b.onclick = fn;
      return b;
    }

    const motionSel = document.createElement('select');
    motionSel.style.cssText = `
      flex:1; background:var(--card,#131317); border:1px solid var(--border2,#2a2a36);
      color:var(--text,#e8e8f0); border-radius:6px; padding:4px 8px;
      font-size:10px; cursor:pointer; outline:none;
      font-family:var(--font-mono,'JetBrains Mono',monospace);
    `;

    const btnRev   = makeBtn('◀', '역재생', () => _setSpeed(-1));
    const btnPause = makeBtn('■', '정지',   () => _setSpeed(0));
    const btnPlay  = makeBtn('▶', '재생',   () => _setSpeed(1));
    motionSel.onchange = () => { if (motionSel.value) _playAction(motionSel.value); };

    bar.append(btnRev, btnPause, btnPlay, motionSel);
    container.append(viewport, bar);
    return { viewport, motionSel };
  }

  // ── 메인 init ──────────────────────────────
  async function init(opts = {}) {
    const { container, data = {} } = opts;
    if (!container) throw new Error('PersonaViewer: container 필요');

    const { viewport, motionSel } = buildUI(container, data);
    const { THREE, GLTFLoader, FBXLoader, OrbitControls } = await loadLibs();

    const clock  = new THREE.Clock();
    const scene  = new THREE.Scene();
    const camCfg = data.camera || {};

    const camera = new THREE.PerspectiveCamera(39.6,
      (viewport.clientWidth || 280) / (viewport.clientHeight || 400), 0.1, 1000);
    camera.position.set(0, camCfg.posY ?? 1.6, camCfg.posZ ?? 2.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
    viewport.appendChild(renderer.domElement);

    // 렌더러 크기를 viewport 실제 크기로 맞추기
    const setSize = () => {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    setSize();

    // 조명
    const kl = new THREE.DirectionalLight(0xfff0dd, 1.5); kl.position.set(2,3,3);   scene.add(kl);
    const fl = new THREE.DirectionalLight(0xddeeff, 0.8); fl.position.set(-3,2,2);  scene.add(fl);
    const bl = new THREE.DirectionalLight(0xffffff, 2.0); bl.position.set(0,3,-4);  scene.add(bl);
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, camCfg.targetY ?? 1.5, 0);
    controls.enablePan = false;
    controls.minAzimuthAngle = controls.maxAzimuthAngle = 0;
    controls.enableDamping = true;
    controls.update();

    // state
    let mixer = null, character = null, boneMap = {};
    const actions = {};
    let activeActionName = '';
    let rafId = null, destroyed = false;

    function _setSpeed(s) { if (mixer) mixer.timeScale = s; }

    function _playAction(name, fade = 0.5) {
      if (!actions[name]) return;
      if (activeActionName && actions[activeActionName]) actions[activeActionName].fadeOut(fade);
      activeActionName = name;
      actions[name].setLoop(THREE.LoopRepeat, Infinity).reset()
        .setEffectiveWeight(1).fadeIn(fade).play();
    }

    function addClips(clips, label) {
      clips.forEach((clip, i) => {
        const name = clips.length === 1 ? label : `${label}_${i}`;
        if (actions[name]) return;
        actions[name] = mixer.clipAction(clip);
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        motionSel.appendChild(opt);
        if (!activeActionName) { _playAction(name); motionSel.value = name; }
      });
    }

    function animate() {
      if (destroyed) return;
      rafId = requestAnimationFrame(animate);
      if (mixer) mixer.update(clock.getDelta());
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    async function loadGLB(url) {
      return new Promise((res, rej) => {
        new GLTFLoader().load(url, (gltf) => {
          if (character) scene.remove(character);
          character = gltf.scene;
          scene.add(character);

          const box  = new THREE.Box3().setFromObject(character);
          const size = box.getSize(new THREE.Vector3());
          character.position.y -= box.min.y;

          if (camCfg.posY === undefined) {
            const fh = size.y * 0.9;
            camera.position.set(0, fh, size.y * 1.5);
            controls.target.set(0, fh, 0);
            controls.update();
          }

          boneMap = {};
          character.traverse(c => {
            if (!c.isBone) return;
            const clean = c.name.replace(/mixamorig/gi,'').replace(/[:_]/g,'').toLowerCase();
            boneMap[clean] = c.name;
          });

          mixer = new THREE.AnimationMixer(character);
          if (gltf.animations.length) addClips(gltf.animations, 'Default');
          res(character);
        }, undefined, rej);
      });
    }

    async function loadFBX(url, label) {
      return new Promise((res, rej) => {
        new FBXLoader().load(url, (fbx) => {
          fbx.animations.forEach(clip => {
            clip.tracks.forEach(track => {
              const [bone, prop] = track.name.split('.');
              const clean = (bone||'').replace(/mixamorig/gi,'').replace(/[:_]/g,'').toLowerCase();
              if (boneMap[clean]) track.name = `${boneMap[clean]}.${prop}`;
            });
          });
          if (fbx.animations.length) addClips(fbx.animations, label);
          res();
        }, undefined, rej);
      });
    }

    // ResizeObserver
    const ro = new ResizeObserver(setSize);
    ro.observe(viewport);

    // 초기 로드
    if (data.glb) await loadGLB(data.glb);
    if (data.motions?.length && character) {
      await Promise.allSettled(
        data.motions.map(m => loadFBX(m.url, m.label || m.id))
      );
    }

    // 공개 API
    return {
      play:           (name)  => _playAction(name),
      getActionNames: ()      => Object.keys(actions),
      setSpeed:       (s)     => _setSpeed(s),
      setCamera: ({ posY, posZ, targetY } = {}) => {
        if (posY    !== undefined) camera.position.y = posY;
        if (posZ    !== undefined) camera.position.z = posZ;
        if (targetY !== undefined) controls.target.y = targetY;
        controls.update();
      },
      setBackground: (bg) => {
        if (!bg) return;
        viewport.style.background = bg.type === 'gradient'
          ? `linear-gradient(to top, ${bg.bottom||'#444'}, ${bg.top||'#888'})`
          : bg.type === 'image' ? `url(${bg.url}) center/cover no-repeat` : '';
      },
      loadMotion: (m) => character
        ? loadFBX(m.url, m.label || m.id)
        : Promise.reject('캐릭터 없음'),
      destroy: () => {
        destroyed = true;
        ro.disconnect();
        if (rafId) cancelAnimationFrame(rafId);
        renderer.dispose();
        container.innerHTML = '';
      }
    };
  }

  return { init };
})();

if (typeof module !== 'undefined') module.exports = PersonaViewer;
