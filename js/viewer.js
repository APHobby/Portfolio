/*
  Full-page project viewer
  - One project at a time
  - Arrows + keyboard + swipe navigation
  - Bottom "carousel" of project titles

  Supported media:
  - video (mp4/webm), image (png/jpg/webp), iframe
  - model (glb/gltf/stl)
  - code-demo: VS Code-like viewer + embedded demo
  - media can be an array to create a gallery
*/

(async function () {
  const category = window.__CATEGORY__;
  const root = document.getElementById("viewer");
  if (!category || !root) return;

  const res = await fetch("../data/projects.json", { cache: "no-store" });
  const data = await res.json();
  const projects = data[category] || [];

  if (!projects.length) {
    root.innerHTML = `<div class="viewer-empty">No projects in this category yet.</div>`;
    return;
  }

  const url = new URL(window.location.href);
  const pid = url.searchParams.get("p");
  let index = projects.findIndex((p) => p.id === pid);
  if (index < 0) index = 0;

  // ---------- helpers ----------
  const once = new Set();
  function injectStyleOnce(id, cssText) {
    if (once.has(id)) return;
    once.add(id);
    const style = document.createElement("style");
    style.textContent = cssText;
    document.head.appendChild(style);
  }

  function loadScriptOnce(id, src, attrs = {}) {
    if (document.getElementById(id)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.id = id;
      s.src = src;
      Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  function setUrl() {
    const u = new URL(window.location.href);
    u.searchParams.set("p", projects[index].id);
    window.history.replaceState({}, "", u.toString());
  }

  function placeholderEl(p) {
    const box = document.createElement("div");
    box.className = "viewer-placeholder";
    box.innerHTML = `
      <div class="placeholder-grid" aria-hidden="true"></div>
      <div class="placeholder-content">
        <div class="placeholder-kicker">${category.toUpperCase()}</div>
        <div class="placeholder-title">${p.title}</div>
        <div class="placeholder-sub">${p.subtitle || ""}</div>
      </div>
    `;
    return box;
  }

  function normalizeMedia(p) {
    const m = p.media;
    if (!m) return [{ type: "placeholder" }];
    if (Array.isArray(m)) return m;
    return [m];
  }

  function extFromSrc(src = "") {
    const clean = src.split("?")[0].split("#")[0];
    const e = clean.split(".").pop();
    return (e || "").toLowerCase();
  }

  async function ensureModelViewer() {
    // model-viewer is a web component (module)
    if (document.getElementById("model-viewer-lib")) return;
    const s = document.createElement("script");
    s.id = "model-viewer-lib";
    s.type = "module";
    s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    document.head.appendChild(s);
    await new Promise((r) => (s.onload = r));
  }

  async function ensureThreeForStl() {
    await loadScriptOnce("three-lib", "https://unpkg.com/three@0.160.0/build/three.min.js");
    await loadScriptOnce("three-orbit", "https://unpkg.com/three@0.160.0/examples/js/controls/OrbitControls.js");
    await loadScriptOnce("three-stl", "https://unpkg.com/three@0.160.0/examples/js/loaders/STLLoader.js");
  }

  async function ensureMonaco() {
    // Monaco loader (requirejs)
    await loadScriptOnce("monaco-loader", "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js");
    return new Promise((resolve) => {
      window.require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" } });
      window.require(["vs/editor/editor.main"], () => resolve());
    });
  }

  function languageForPath(path) {
    const e = (path.split(".").pop() || "").toLowerCase();
    const map = {
      js: "javascript",
      ts: "typescript",
      jsx: "javascript",
      tsx: "typescript",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      py: "python",
      txt: "plaintext",
      glsl: "cpp",
    };
    return map[e] || "plaintext";
  }

  // ---------- media renderers ----------
  function videoEl(src, p) {
    const v = document.createElement("video");
    v.src = src;
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.controls = matchMedia("(hover: none)").matches; // mobile: show controls if autoplay blocked
    v.className = "viewer-media";
    v.addEventListener("error", () => v.replaceWith(placeholderEl(p)));
    return v;
  }

  function imageEl(src, p) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = p.title;
    img.className = "viewer-media";
    img.addEventListener("error", () => img.replaceWith(placeholderEl(p)));
    return img;
  }

  function iframeEl(src, p) {
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
    iframe.referrerPolicy = "no-referrer";
    iframe.className = "viewer-media";
    iframe.addEventListener("error", () => iframe.replaceWith(placeholderEl(p)));
    return iframe;
  }

  async function modelEl(src, p) {
    const e = extFromSrc(src);

    // GLB/GLTF => model-viewer
    if (e === "glb" || e === "gltf") {
      await ensureModelViewer();
      const mv = document.createElement("model-viewer");
      mv.setAttribute("src", src);
      mv.setAttribute("camera-controls", "");
      mv.setAttribute("auto-rotate", "");
      mv.setAttribute("shadow-intensity", "0.6");
      mv.style.width = "100%";
      mv.style.height = "100%";
      mv.style.background = "rgba(0,0,0,.25)";
      return mv;
    }

    // STL => three.js preview
    if (e === "stl") {
      await ensureThreeForStl();
      injectStyleOnce("stl-style", `
        .stl-wrap{width:100%;height:100%;position:relative}
        .stl-hint{position:absolute;left:12px;bottom:12px;font-size:12px;color:rgba(255,255,255,.75);
          background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);padding:6px 10px;border-radius:999px}
      `);

      const wrap = document.createElement("div");
      wrap.className = "stl-wrap";
      const hint = document.createElement("div");
      hint.className = "stl-hint";
      hint.textContent = "Drag to rotate • Scroll to zoom";
      wrap.appendChild(hint);

      const renderer = new window.THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      wrap.appendChild(renderer.domElement);

      const scene = new window.THREE.Scene();
      scene.background = new window.THREE.Color(0x0b0b0e);

      const camera = new window.THREE.PerspectiveCamera(55, 1, 0.01, 2000);
      camera.position.set(0, 0, 140);

      const controls = new window.THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;

      scene.add(new window.THREE.AmbientLight(0xffffff, 0.55));
      const dir = new window.THREE.DirectionalLight(0xffffff, 0.85);
      dir.position.set(60, 90, 120);
      scene.add(dir);

      const loader = new window.THREE.STLLoader();
      loader.load(
        src,
        (geo) => {
          geo.computeVertexNormals();
          const mat = new window.THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.1, roughness: 0.65 });
          const mesh = new window.THREE.Mesh(geo, mat);

          // Center + fit
          geo.computeBoundingBox();
          const box = geo.boundingBox;
          const size = new window.THREE.Vector3();
          box.getSize(size);
          const center = new window.THREE.Vector3();
          box.getCenter(center);
          mesh.position.sub(center);

          const maxDim = Math.max(size.x, size.y, size.z);
          camera.position.set(0, 0, maxDim * 1.2);
          controls.update();

          scene.add(mesh);
        },
        undefined,
        () => wrap.replaceWith(placeholderEl(p))
      );

      function resize() {
        const w = wrap.clientWidth || 1;
        const h = wrap.clientHeight || 1;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      const ro = new ResizeObserver(resize);
      ro.observe(wrap);

      (function tick() {
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
      })();

      return wrap;
    }

    // Unknown model extension => placeholder
    return placeholderEl(p);
  }

  async function codeDemoEl(m, p) {
    injectStyleOnce("code-demo-style", `
      .code-demo{width:100%;height:100%;display:grid;grid-template-columns: 0.95fr 1.05fr}
      .code-pane{border-right:1px solid rgba(255,255,255,.10);display:grid;grid-template-rows: auto 1fr}
      .code-top{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 12px;
        border-bottom:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.22)}
      .code-top .muted{font-size:12px}
      .code-body{display:grid;grid-template-columns: 220px 1fr;min-height:0}
      .code-files{overflow:auto;border-right:1px solid rgba(255,255,255,.10);padding:10px;background:rgba(0,0,0,.18)}
      .code-files button{width:100%;text-align:left;display:block;margin:0 0 6px;padding:8px 10px;border-radius:10px;
        border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.25);color:rgba(255,255,255,.85);cursor:pointer;font-size:12px}
      .code-files button.active{border-color:rgba(36,212,166,.65);background:rgba(36,212,166,.10)}
      .code-editor{min-height:0}
      .code-demo iframe{width:100%;height:100%;border:0;background:#06070b}
      @media (max-width: 960px){
        .code-demo{grid-template-columns:1fr;grid-template-rows: 1fr 1fr}
        .code-pane{border-right:none;border-bottom:1px solid rgba(255,255,255,.10)}
      }
    `);

    const wrap = document.createElement("div");
    wrap.className = "code-demo";

    const left = document.createElement("div");
    left.className = "code-pane";

    const top = document.createElement("div");
    top.className = "code-top";
    top.innerHTML = `<div class="muted">Code viewer</div><div class="muted">${p.title}</div>`;
    left.appendChild(top);

    const body = document.createElement("div");
    body.className = "code-body";

    const filesCol = document.createElement("div");
    filesCol.className = "code-files";

    const editorCol = document.createElement("div");
    editorCol.className = "code-editor";

    body.appendChild(filesCol);
    body.appendChild(editorCol);
    left.appendChild(body);

    const right = document.createElement("div");
    if (m.demo) right.appendChild(iframeEl(m.demo, p));
    else right.appendChild(placeholderEl(p));

    wrap.appendChild(left);
    wrap.appendChild(right);

    const files = Array.isArray(m.files) ? m.files : [];
    if (!files.length || !m.codeRoot) {
      filesCol.innerHTML = `<div class="muted" style="font-size:12px;line-height:1.5;">
        No files listed for this project.<br/>Use the importer to upload a folder and export JSON.
      </div>`;
      return wrap;
    }

    await ensureMonaco();
    const editor = window.monaco.editor.create(editorCol, {
      value: "",
      language: "plaintext",
      theme: "vs-dark",
      readOnly: true,
      minimap: { enabled: false },
      fontSize: 13,
      automaticLayout: true
    });

    async function openFile(path) {
      const url = `${m.codeRoot}${path}`;
      const r = await fetch(url);
      const txt = await r.text();
      editor.setValue(txt);
      window.monaco.editor.setModelLanguage(editor.getModel(), languageForPath(path));

      filesCol.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.path === path));
    }

    files.forEach((path) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = path;
      b.dataset.path = path;
      b.onclick = () => openFile(path);
      filesCol.appendChild(b);
    });

    // Default file: README.md if present, else first
    const def = files.find(f => f.toLowerCase().endsWith("readme.md")) || files[0];
    openFile(def);

    return wrap;
  }

  async function singleMediaEl(m, p) {
    if (!m || m.type === "placeholder") return placeholderEl(p);

    if (m.type === "video" && m.src) return videoEl(m.src, p);
    if (m.type === "image" && m.src) return imageEl(m.src, p);
    if (m.type === "iframe" && m.src) return iframeEl(m.src, p);

    if (m.type === "model" && m.src) return await modelEl(m.src, p);

    if (m.type === "code-demo") return await codeDemoEl(m, p);

    if (m.type === "file" && m.src) {
      const box = document.createElement("div");
      box.className = "viewer-placeholder";
      box.innerHTML = `
        <div class="placeholder-grid" aria-hidden="true"></div>
        <div class="placeholder-content">
          <div class="placeholder-kicker">${category.toUpperCase()}</div>
          <div class="placeholder-title">${p.title}</div>
          <div class="placeholder-sub">${p.subtitle || ""}</div>
          <div style="margin-top:14px;">
            <a class="pill link" href="${m.src}" target="_blank" rel="noopener">Download ${m.label || "file"}</a>
          </div>
        </div>
      `;
      return box;
    }

    // If type is missing but src exists, infer
    if (m.src) {
      const e = extFromSrc(m.src);
      if (["mp4", "webm", "mov"].includes(e)) return videoEl(m.src, p);
      if (["png", "jpg", "jpeg", "webp", "gif"].includes(e)) return imageEl(m.src, p);
      if (["glb", "gltf", "stl"].includes(e)) return await modelEl(m.src, p);
      return iframeEl(m.src, p);
    }

    return placeholderEl(p);
  }

  async function mediaEl(p) {
    const list = normalizeMedia(p);
    if (list.length === 1) return await singleMediaEl(list[0], p);

    // Gallery
    injectStyleOnce("gallery-style", `
      .media-gallery{width:100%;height:100%;display:grid;grid-template-rows: 1fr auto;gap:10px;padding:10px}
      .media-main{border:1px solid rgba(255,255,255,.10);border-radius:14px;overflow:hidden;min-height:0}
      .media-thumbs{display:flex;gap:8px;overflow:auto;padding-bottom:6px}
      .media-thumbs button{border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.25);border-radius:12px;padding:0;cursor:pointer;flex:0 0 auto}
      .media-thumbs img{width:90px;height:54px;object-fit:cover;display:block;border-radius:12px}
      .media-thumbs button.active{border-color:rgba(36,212,166,.65);background:rgba(36,212,166,.10)}
    `);

    const wrap = document.createElement("div");
    wrap.className = "media-gallery";

    const main = document.createElement("div");
    main.className = "media-main";

    const thumbs = document.createElement("div");
    thumbs.className = "media-thumbs";

    let current = 0;

    async function renderMain(i) {
      current = i;
      main.innerHTML = "";
      const el = await singleMediaEl(list[i], p);
      // ensure it fills the main box
      if (el.classList && el.classList.contains("viewer-media")) {
        el.style.height = "100%";
      }
      main.appendChild(el);
      thumbs.querySelectorAll("button").forEach((b, bi) => b.classList.toggle("active", bi === i));
    }

    list.forEach((m, i) => {
      const b = document.createElement("button");
      b.type = "button";

      // Thumbnail: for images/videos use the actual asset; otherwise generic label
      if (m.type === "image" && m.src) {
        const img = document.createElement("img");
        img.src = m.src;
        img.alt = `thumb ${i + 1}`;
        b.appendChild(img);
      } else if (m.type === "video" && m.src) {
        const img = document.createElement("img");
        img.src = m.poster || "";
        img.alt = `video ${i + 1}`;
        img.style.background = "rgba(0,0,0,.35)";
        b.appendChild(img);
      } else {
        b.textContent = m.type || "item";
        b.style.color = "rgba(255,255,255,.75)";
        b.style.padding = "10px 12px";
      }

      b.onclick = () => renderMain(i);
      thumbs.appendChild(b);
    });

    wrap.appendChild(main);
    wrap.appendChild(thumbs);

    await renderMain(current);
    return wrap;
  }

  // ---------- render ----------
  async function render() {
    setUrl();
    const p = projects[index];
    root.innerHTML = "";

    const layout = document.createElement("div");
    layout.className = "viewer-layout";

    const left = document.createElement("section");
    left.className = "viewer-left";
    left.appendChild(await mediaEl(p));

    const right = document.createElement("aside");
    right.className = "viewer-right";

    const links = (p.links || [])
      .map((l) => `<a class="pill link" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`)
      .join("");

    right.innerHTML = `
      <div class="viewer-meta">
        <div class="viewer-kicker">${category.toUpperCase()}</div>
        <h1 class="viewer-title">${p.title}</h1>
        <div class="viewer-subtitle">${p.subtitle || ""}</div>

        <div class="viewer-details">
          ${p.year ? `<div><span>Year</span>${p.year}</div>` : ""}
          ${p.tools && p.tools.length ? `<div><span>Tools</span>${p.tools.join(", ")}</div>` : ""}
        </div>

        <p class="viewer-desc">${p.description || ""}</p>

        ${links ? `<div class="viewer-links">${links}</div>` : ""}
      </div>
    `;

    const prev = document.createElement("button");
    prev.className = "nav-arrow nav-prev";
    prev.setAttribute("aria-label", "Previous project");
    prev.innerHTML = "\u2039";
    prev.onclick = () => { index = (index - 1 + projects.length) % projects.length; render(); };

    const next = document.createElement("button");
    next.className = "nav-arrow nav-next";
    next.setAttribute("aria-label", "Next project");
    next.innerHTML = "\u203a";
    next.onclick = () => { index = (index + 1) % projects.length; render(); };

    const carousel = document.createElement("div");
    carousel.className = "viewer-carousel";
    projects.forEach((proj, i) => {
      const b = document.createElement("button");
      b.className = "carousel-pill" + (i === index ? " active" : "");
      b.type = "button";
      b.title = proj.title;
      b.textContent = proj.title;
      b.onclick = () => { index = i; render(); };
      carousel.appendChild(b);
    });

    layout.appendChild(left);
    layout.appendChild(right);

    root.appendChild(prev);
    root.appendChild(next);
    root.appendChild(layout);
    root.appendChild(carousel);
  }

  // Keyboard navigation
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { index = (index - 1 + projects.length) % projects.length; render(); }
    if (e.key === "ArrowRight") { index = (index + 1) % projects.length; render(); }
  });

  // Touch swipe
  let startX = null;
  root.addEventListener("touchstart", (e) => (startX = e.touches[0].clientX), { passive: true });
  root.addEventListener("touchend", (e) => {
    if (startX == null) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;
    startX = null;
    if (Math.abs(dx) < 40) return;
    if (dx > 0) index = (index - 1 + projects.length) % projects.length;
    else index = (index + 1) % projects.length;
    render();
  }, { passive: true });

  render();
})();
