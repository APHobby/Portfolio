/**
 * Add projects here.
 *
 * media.type options:
 * - "youtube"  -> embeds a YouTube link
 * - "vimeo"    -> embeds a Vimeo link
 * - "iframe"   -> embeds a live demo (GitHub Pages app, etc.)
 * - "image"    -> shows an image (local /assets/... or a direct URL)
 * - "video"    -> shows a local MP4 (keep it small)
 *
 * category must be: animation | modeling | printing | coding
 */
window.PROJECTS = [
  {
    id: "anim-1",
    category: "animation",
    title: "Animation — Title",
    description: "1–2 lines: what it is, what you did, and what’s impressive about it.",
    tags: ["Blender", "Lighting", "Compositing"],
    thumb: { type: "text", text: "ANIMATION" }, // or { type:"image", src:"assets/xxx.webp" }
    media: { type: "youtube", url: "https://www.youtube.com/watch?v=XXXX" },
    links: [
      { label: "Instagram post", url: "https://www.instagram.com/" },
    ],
  },

  {
    id: "model-1",
    category: "modeling",
    title: "3D Model — Product concept",
    description: "Hard-surface model with clean topology and turntable renders.",
    tags: ["CAD", "Hard-surface", "Topology"],
    thumb: { type: "text", text: "3D MODEL" },
    media: { type: "image", src: "assets/sample-model.webp" },
    links: [
      { label: "Instagram", url: "https://www.instagram.com/" },
    ],
  },

  {
    id: "print-1",
    category: "printing",
    title: "3D Printing — Functional prototype",
    description: "Prototype iteration, fit tolerances, material choice and final result.",
    tags: ["TPU", "PETG", "Tolerance"],
    thumb: { type: "text", text: "PRINT" },
    media: { type: "image", src: "assets/sample-print.webp" },
    links: [
      { label: "Repo / STL", url: "https://github.com/" },
    ],
  },

  {
    id: "code-1",
    category: "coding",
    title: "App — Live demo (hosted on GitHub Pages)",
    description: "Short description. Add a live demo if it’s a web app.",
    tags: ["JavaScript", "UI", "Tools"],
    thumb: { type: "text", text: "APP" },
    media: { type: "iframe", url: "https://YOURUSERNAME.github.io/your-demo-app/" },
    links: [
      { label: "GitHub repo", url: "https://github.com/" },
    ],
  },
];
