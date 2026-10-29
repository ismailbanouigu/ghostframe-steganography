const MODEL_META = {
  "openai/gpt-5.4-nano": { label: "GPT-5.4 Nano", lane: "Quest" },
  "anthropic/claude-fable-5.1": { label: "Claude Fable 5.1", lane: "Fable" },
};

const state = {
  secret: "",
  pngDataUrl: "",
  method: "",
  model: "openai/gpt-5.4-nano",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const connect = $("#polliConnect");
const appKey = window.GHOSTFRAME_CONFIG?.appKey || "";
const secretInput = $("#secretInput");
const generateButton = $("#generateButton");
const seekButton = $("#seekButton");
const evidenceFrame = $("#evidenceFrame");
const artworkMount = $("#artworkMount");
const emptyState = $("#emptyState");
const loadingVeil = $("#loadingVeil");
const renderStamp = $("#renderStamp");
const verdictPanel = $("#verdictPanel");

if (/^pk_[A-Za-z0-9_-]+$/.test(appKey) && !appKey.includes("REPLACE")) {
  connect.setAttribute("app-key", appKey);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3000);
}

function setBusy(isBusy, message = "Hider is drawing in code…") {
  loadingVeil.hidden = !isBusy;
  loadingVeil.querySelector("p").textContent = message;
  generateButton.disabled = isBusy;
  seekButton.disabled = isBusy || !state.pngDataUrl;
}

function setProgress(step) {
  $$(".progress-step").forEach((item) => {
    const number = Number(item.dataset.progress);
    item.classList.toggle("active", number === step);
    item.classList.toggle("done", number < step);
  });
}

function selectedModel() {
  return $('input[name="model"]:checked')?.value || "openai/gpt-5.4-nano";
}

function requireWallet() {
  if (!/^pk_[A-Za-z0-9_-]+$/.test(appKey) || appKey.includes("REPLACE")) {
    showToast("GhostFrame is waiting for its Pollinations App Key.");
    return false;
  }
  if (!connect.apiKey) {
    showToast("Connect your Pollinations wallet first.");
    connect.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  return true;
}

async function callModel({ model, messages, maxTokens = 3000 }) {
  const response = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connect.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.55,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return payload?.choices?.[0]?.message?.content || "";
}

function extractSvg(raw) {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) throw new Error("The hider did not return a valid SVG. Try again or choose the Quest lane.");
  const methodMatch = raw.match(/METHOD\s*:\s*([^\n<]+)/i);
  return { svg: match[0], method: methodMatch?.[1]?.trim() || "AI-selected visual code" };
}

function sanitizeSvg(svgText) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.tagName.toLowerCase() !== "svg") {
    throw new Error("The generated SVG could not be parsed safely.");
  }

  doc.querySelectorAll("script, foreignObject, iframe, object, embed, audio, video, a, image").forEach((node) => node.remove());
  doc.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || name === "href" || name === "xlink:href" || value.includes("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });
  doc.querySelectorAll("metadata, title, desc").forEach((node) => node.remove());

  const root = doc.documentElement;
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  root.setAttribute("width", "1024");
  root.setAttribute("height", "1024");
  if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", "0 0 1024 1024");

  const visibleText = [...root.querySelectorAll("text")].map((node) => node.textContent || "").join(" ");
  if (normalize(visibleText).includes(normalize(state.secret)) && normalize(state.secret).length > 4) {
    throw new Error("The hider printed the secret visibly instead of encoding it. Run the experiment again.");
  }
  return new XMLSerializer().serializeToString(root);
}

async function svgToPngDataUrl(svgText) {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#f4f0e8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png", 0.94);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function displayPng(dataUrl) {
  artworkMount.replaceChildren();
  const image = new Image();
  image.src = dataUrl;
  image.alt = "AI-generated artwork containing a hidden message";
  artworkMount.append(image);
  artworkMount.hidden = false;
  emptyState.hidden = true;
  renderStamp.hidden = false;
  evidenceFrame.classList.remove("empty");
  $("#downloadButton").disabled = false;
}

async function generateArtwork() {
  const secret = secretInput.value.trim();
  if (!secret) {
    showToast("Write a secret message first.");
    secretInput.focus();
    return;
  }
  if (!requireWallet()) return;

  state.secret = secret;
  state.model = selectedModel();
  state.pngDataUrl = "";
  state.method = "";
  verdictPanel.hidden = true;
  setProgress(1);
  setBusy(true);

  const theme = $("#themeSelect").value;
  const method = $("#methodSelect").value;
  const system = `You are the Hider in a blind visual steganography experiment. Create a single, polished square SVG artwork. Hide the user's exact secret in the visual structure so a fresh vision model could infer it, but an ordinary viewer sees only an elegant ${theme}. ${method}. Do not print the secret, its characters, or a plaintext key anywhere visible. Do not use metadata, comments, scripts, external images, foreignObject, base64 assets, animation, or URLs. Use only safe inline SVG shapes, paths, gradients, patterns, and optional innocuous decorative text that does not contain the secret. Keep the SVG under 18KB. Return exactly one line beginning METHOD: followed by a short method description, then the complete <svg>...</svg>.`;

  try {
    const raw = await callModel({
      model: state.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Secret to encode exactly: ${secret}` },
      ],
      maxTokens: 4200,
    });
    const extracted = extractSvg(raw);
    const safeSvg = sanitizeSvg(extracted.svg);
    setProgress(2);
    setBusy(true, "Burning SVG source into blind pixels…");
    const png = await svgToPngDataUrl(safeSvg);
    state.pngDataUrl = png;
    state.method = extracted.method;
    displayPng(png);
    $("#evidenceMethod").textContent = `METHOD / ${state.method.toUpperCase().slice(0, 42)}`;
    $("#evidenceModel").textContent = `MODEL / ${MODEL_META[state.model]?.label || state.model}`;
    seekButton.disabled = false;
    setProgress(3);
    showToast("Blind PNG ready. The SVG source was discarded.");
  } catch (error) {
    showToast(error.message || "The hider could not finish this frame.");
  } finally {
    setBusy(false);
  }
}

function parseSeekerReport(raw) {
  const line = (label) => raw.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "im"))?.[1]?.trim() || "";
  return {
    guess: line("GUESS") || "No message recovered",
    method: line("METHOD") || "Unknown",
    confidence: line("CONFIDENCE") || "Unreported",
    notes: line("NOTES") || raw.trim(),
  };
}

function normalize(value) {
  return String(value || "").toUpperCase().normalize("NFKD").replace(/[^A-Z0-9]+/g, "");
}

function levenshtein(a, b) {
  const rows = b.length + 1;
  const cols = a.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[rows - 1][cols - 1];
}

function similarity(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  const distance = levenshtein(left, right);
  return Math.max(0, Math.round((1 - distance / Math.max(left.length, right.length)) * 100));
}

async function runSeeker() {
  if (!state.pngDataUrl || !state.secret) return;
  if (!requireWallet()) return;
  setBusy(true, "A fresh seeker is inspecting only the pixels…");
  seekButton.disabled = true;

  const prompt = `You are the Seeker in a blind steganography experiment. Inspect only this image. It may contain a short hidden message encoded through object heights, colours, Morse-like spacing, rotation, repeated counts, or a visual acrostic. You have not seen the source code or the original message. Work carefully, but do not claim certainty without evidence. Respond with exactly four lines:\nGUESS: your best recovered plaintext, or NONE\nMETHOD: the visual encoding you believe was used\nCONFIDENCE: integer 0-100%\nNOTES: one concise explanation of the evidence.`;

  try {
    const raw = await callModel({
      model: state.model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: state.pngDataUrl } },
        ],
      }],
      maxTokens: 700,
    });
    const report = parseSeekerReport(raw);
    const score = similarity(state.secret, report.guess);
    $("#scoreValue").textContent = String(score);
    $("#scoreRing").style.setProperty("--score", String(score));
    $("#decodedMessage").textContent = report.guess;
    $("#decodedMethod").textContent = report.method;
    $("#decodedConfidence").textContent = report.confidence;
    $("#rawSeekerOutput").textContent = raw;
    $("#verdictGuess").textContent = score >= 90
      ? "The seeker recovered the message with at least 90% normalized similarity."
      : score >= 55
        ? "The seeker caught part of the signal, but the message did not fully survive."
        : "The artwork kept most of its secret from the fresh model.";
    $("#verdictTitle").textContent = score >= 90 ? "Signal recovered." : score >= 55 ? "A partial transmission." : "The frame kept its secret.";
    verdictPanel.hidden = false;
    verdictPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast(`Blind trial complete: ${score}% normalized match.`);
  } catch (error) {
    showToast(error.message || "The seeker could not inspect this frame.");
  } finally {
    setBusy(false);
  }
}

function resetLab() {
  state.secret = "";
  state.pngDataUrl = "";
  state.method = "";
  secretInput.value = "";
  $("#secretCount").textContent = "0 / 120";
  artworkMount.replaceChildren();
  artworkMount.hidden = true;
  emptyState.hidden = false;
  renderStamp.hidden = true;
  verdictPanel.hidden = true;
  seekButton.disabled = true;
  $("#downloadButton").disabled = true;
  $("#evidenceMethod").textContent = "METHOD / —";
  $("#evidenceModel").textContent = "MODEL / —";
  setProgress(1);
}

function buildSkyline() {
  const values = [16, 15, 12, 12, 5, 14, null, 2, 12, 15, 15, 13, 19];
  const grid = $("#skylineGrid");
  values.forEach((value) => {
    const item = document.createElement("div");
    if (value === null) {
      item.className = "skyline-gap";
    } else {
      item.className = "skyline-bar";
      item.style.setProperty("--height", String(value));
      item.title = `Height ${value}`;
    }
    grid.append(item);
  });
}

function loadDemo() {
  $("#specimen").scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    $("#specimenAnswer").hidden = false;
    $("#decodeSpecimenButton").textContent = "Decoded ✓";
  }, 500);
}

secretInput.addEventListener("input", () => {
  $("#secretCount").textContent = `${secretInput.value.length} / 120`;
});

$$(".model-option input").forEach((input) => input.addEventListener("change", () => {
  $$(".model-option").forEach((label) => label.classList.toggle("selected", label.querySelector("input").checked));
  const model = selectedModel();
  showToast(model.includes("fable") ? "Fable lane uses Paid Pollen." : "Quest lane selected.");
}));

generateButton.addEventListener("click", generateArtwork);
seekButton.addEventListener("click", runSeeker);
$("#resetButton").addEventListener("click", resetLab);
$("#loadDemoButton").addEventListener("click", loadDemo);
$("#decodeSpecimenButton").addEventListener("click", () => {
  const answer = $("#specimenAnswer");
  answer.hidden = !answer.hidden;
  $("#decodeSpecimenButton").textContent = answer.hidden ? "Reveal the decoding" : "Hide the decoding";
});
$("#downloadButton").addEventListener("click", () => {
  if (!state.pngDataUrl) return;
  const link = document.createElement("a");
  link.href = state.pngDataUrl;
  link.download = `ghostframe-${Date.now()}.png`;
  link.click();
});

connect.addEventListener("change", () => {
  showToast(connect.apiKey ? "Wallet connected. The blind relay is ready." : "Wallet disconnected.");
});

buildSkyline();
resetLab();

