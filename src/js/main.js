const STORAGE_KEY = "lumina_hf_token";
const MAX_IMAGES = 4;
const MODEL = "black-forest-labs/FLUX.1-schnell";
const API_URL = `https://router.huggingface.co/hf-inference/models/${MODEL}`;
const FALLBACK_PROMPTS = [
  "A quiet harbor at dawn, soft fog, amber lights reflecting on water",
  "An old botanical greenhouse at dusk, glass and vines, warm lamplight",
  "Surreal desert dunes under a turquoise sky, long shadows",
  "A cozy reading nook by a rain-streaked window, candlelight",
];

const generateBtn = document.getElementById("generate");
const promptInput = document.getElementById("user-prompt");
const form = document.getElementById("form");
const loading = document.getElementById("loading");
const imageGrid = document.getElementById("image-grid");
const errorEl = document.getElementById("error");
const gallery = document.getElementById("gallery");
const splash = document.getElementById("splash");
const settingsBtn = document.getElementById("settings-btn");
const settingsDialog = document.getElementById("settings-dialog");
const settingsForm = document.getElementById("settings-form");
const apiKeyInput = document.getElementById("api-key");

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getApiKey() {
  return (
    localStorage.getItem(STORAGE_KEY) ||
    (typeof window !== "undefined" && window.HF_API_KEY) ||
    ""
  );
}

function setApiKey(token) {
  const trimmed = token.trim();
  if (trimmed) {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function setLoading(isLoading) {
  loading.hidden = !isLoading;
  gallery.setAttribute("aria-busy", String(isLoading));
  generateBtn.disabled = isLoading;
  promptInput.disabled = isLoading;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearImageGrid() {
  imageGrid.innerHTML = "";
}

function downloadImage(imgUrl, imageNumber) {
  const link = document.createElement("a");
  link.href = imgUrl;
  link.download = `lumina-${imageNumber + 1}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function appendImage(imgUrl, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "image-card";
  card.setAttribute("aria-label", `Download generated image ${index + 1}`);

  const img = document.createElement("img");
  img.src = imgUrl;
  img.alt = `Generated artwork ${index + 1}`;
  img.loading = "lazy";

  card.appendChild(img);
  card.addEventListener("click", () => downloadImage(imgUrl, index));
  imageGrid.appendChild(card);
}

async function generateOneImage(prompt, apiKey) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        seed: getRandomNumber(1, 999999),
      },
    }),
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    const text = await response.text().catch(() => "");
    if (text) {
      try {
        const data = JSON.parse(text);
        detail = data.error || data.message || text;
      } catch {
        detail = text;
      }
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("The API did not return an image. Check your token and model access.");
  }

  return URL.createObjectURL(blob);
}

async function generateImages(rawInput) {
  const apiKey = getApiKey();
  if (!apiKey) {
    showError("Add your Hugging Face API token in Settings to generate images.");
    settingsDialog.showModal();
    return;
  }

  const basePrompt =
    rawInput.trim() ||
    FALLBACK_PROMPTS[getRandomNumber(0, FALLBACK_PROMPTS.length - 1)];

  clearError();
  clearImageGrid();
  setLoading(true);

  try {
    const tasks = Array.from({ length: MAX_IMAGES }, (_, i) => {
      const prompt = `${basePrompt}, variation ${i + 1}`;
      return generateOneImage(prompt, apiKey);
    });

    const results = await Promise.allSettled(tasks);
    let successCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        appendImage(result.value, index);
        successCount += 1;
      }
    });

    if (successCount === 0) {
      const firstError = results.find((r) => r.status === "rejected");
      throw firstError?.reason || new Error("Could not generate images.");
    }

    if (successCount < MAX_IMAGES) {
      showError(
        `Generated ${successCount} of ${MAX_IMAGES} images. Some requests failed — try again.`
      );
    }

    gallery.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong while generating.";
    showError(message);
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generateImages(promptInput.value);
});

settingsBtn.addEventListener("click", () => {
  apiKeyInput.value = getApiKey();
  settingsDialog.showModal();
  apiKeyInput.focus();
});

settingsForm.addEventListener("submit", (event) => {
  const submitter = event.submitter;
  if (submitter && submitter.value === "cancel") {
    return;
  }
  setApiKey(apiKeyInput.value);
});

window.addEventListener("load", () => {
  splash.classList.add("loaded");
  splash.setAttribute("aria-hidden", "true");
});
