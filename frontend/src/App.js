import { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "https://ai-image-generator-backend-arsa.onrender.com";

const STYLES = [
  { value: "realistic", label: "Realistic", icon: "📷" },
  { value: "anime",     label: "Anime",     icon: "✨" },
  { value: "cartoon",   label: "Cartoon",   icon: "🎨" },
  { value: "painting",  label: "Painting",  icon: "🖌️" },
];

const SIZES = [
  { value: "512x512", label: "Square",    ratio: "1:1" },
  { value: "768x512", label: "Landscape", ratio: "3:2" },
  { value: "512x768", label: "Portrait",  ratio: "2:3" },
];

const EXAMPLE_PROMPTS = [
  "a lone astronaut standing on Mars at sunset",
  "a futuristic city floating above clouds",
  "a wolf made entirely of northern lights",
  "a samurai standing in neon-lit Tokyo rain",
];

export default function App() {
  const [mode, setMode]               = useState("text");      // "text" | "reimagine"
  const [prompt, setPrompt]           = useState("");
  const [style, setStyle]             = useState("realistic");
  const [size, setSize]               = useState("512x512");
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [history, setHistory]         = useState([]);

  // Reimagine-specific state
  const [uploadedFile, setUploadedFile]       = useState(null);   // File object
  const [uploadedPreview, setUploadedPreview] = useState(null);   // base64 preview

  const promptRef  = useRef(null);
  const fileInputRef = useRef(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Max 10MB.");
      return;
    }
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedPreview(ev.target.result);
    reader.readAsDataURL(file);
    setError("");
    setResult(null);
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setUploadedPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generate = async () => {
    if (!prompt.trim()) {
      setError("Enter a prompt first.");
      promptRef.current?.focus();
      return;
    }
    if (mode === "reimagine" && !uploadedFile) {
      setError("Upload a photo to reimagine.");
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);
    setShowEnhanced(false);

    try {
      let data;

      if (mode === "text") {
        const res = await axios.post(`${API_BASE}/generate`, { prompt, style, size });
        data = res.data;
      } else {
        // multipart/form-data for file upload
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("style", style);
        form.append("size", size);
        form.append("image", uploadedFile);

        const res = await axios.post(`${API_BASE}/reimagine`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        data = res.data;
      }

      setResult(data);
      setHistory(prev => [data, ...prev].slice(0, 6));
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${result.image_base64}`;
    link.download = `ai-${style}-${Date.now()}.png`;
    link.click();
  };

  const copyPrompt = () => navigator.clipboard.writeText(result.enhanced_prompt);

  const useExample = (ex) => {
    setPrompt(ex);
    promptRef.current?.focus();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">VisualAI</span>
          </div>
          <p className="header-sub">Text → Image in seconds</p>
        </div>
      </header>

      <main className="main">
        {/* Controls panel */}
        <section className="panel controls-panel">

          {/* Mode toggle */}
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === "text" ? "active" : ""}`}
              onClick={() => { setMode("text"); setResult(null); setError(""); }}
            >
              ✏️ Text to Image
            </button>
            <button
              className={`mode-btn ${mode === "reimagine" ? "active" : ""}`}
              onClick={() => { setMode("reimagine"); setResult(null); setError(""); }}
            >
              🖼️ Reimagine Photo
            </button>
          </div>

          {/* Photo upload — only in reimagine mode */}
          {mode === "reimagine" && (
            <div className="field">
              <label className="field-label">Upload your photo</label>

              {!uploadedPreview ? (
                <div
                  className="upload-zone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="upload-icon">📁</span>
                  <p>Click to upload (JPG, PNG — max 10MB)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="upload-preview">
                  <img src={uploadedPreview} alt="uploaded" className="preview-img" />
                  <button className="clear-upload" onClick={clearUpload}>✕ Remove</button>
                </div>
              )}
            </div>
          )}

          {/* Prompt */}
          <div className="field">
            <label className="field-label">
              {mode === "reimagine" ? "How to reimagine it" : "Describe your image"}
            </label>
            <textarea
              ref={promptRef}
              className="prompt-input"
              placeholder={
                mode === "reimagine"
                  ? "e.g. transform into a cyberpunk warrior in neon Tokyo..."
                  : "e.g. a neon dragon flying over a cyberpunk city at night..."
              }
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              onKeyDown={e => e.key === "Enter" && e.ctrlKey && generate()}
            />
            <p className="hint">Ctrl + Enter to generate</p>
          </div>

          {/* Examples — text mode only */}
          {mode === "text" && (
            <div className="field">
              <label className="field-label">Try an example</label>
              <div className="examples">
                {EXAMPLE_PROMPTS.map((ex, i) => (
                  <button key={i} className="example-chip" onClick={() => useExample(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Style */}
          <div className="field">
            <label className="field-label">Style</label>
            <div className="style-grid">
              {STYLES.map(s => (
                <button
                  key={s.value}
                  className={`style-btn ${style === s.value ? "active" : ""}`}
                  onClick={() => setStyle(s.value)}
                >
                  <span className="style-icon">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="field">
            <label className="field-label">Canvas size</label>
            <div className="size-row">
              {SIZES.map(s => (
                <button
                  key={s.value}
                  className={`size-btn ${size === s.value ? "active" : ""}`}
                  onClick={() => setSize(s.value)}
                >
                  <span className="size-ratio">{s.ratio}</span>
                  <span className="size-label">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <button
            className={`generate-btn ${loading ? "loading" : ""}`}
            onClick={generate}
            disabled={loading}
          >
            {loading ? (
              <><span className="spinner" /> Generating…</>
            ) : (
              mode === "reimagine" ? "Reimagine Photo" : "Generate Image"
            )}
          </button>

          {error && <div className="error-box">{error}</div>}
        </section>

        {/* Output panel */}
        <section className="panel output-panel">
          {loading && (
            <div className="loading-state">
              <div className="pulse-ring" />
              <p className="loading-text">
                {mode === "reimagine" ? "Analysing your photo with Groq AI…" : "Enhancing prompt with Groq AI…"}
              </p>
              <p className="loading-sub">then generating with FLUX</p>
            </div>
          )}

          {!loading && !result && (
            <div className="empty-state">
              {mode === "reimagine" && uploadedPreview ? (
                <>
                  <img src={uploadedPreview} alt="preview" className="preview-large" />
                  <p className="empty-hint">Enter a prompt and click Reimagine Photo</p>
                </>
              ) : (
                <>
                  <div className="empty-icon">🖼️</div>
                  <p>Your image will appear here</p>
                </>
              )}
            </div>
          )}

          {!loading && result && (
            <div className="result">
              {/* Side-by-side if reimagine mode */}
              {mode === "reimagine" && uploadedPreview && (
                <div className="compare-row">
                  <div className="compare-item">
                    <p className="compare-label">Original</p>
                    <img src={uploadedPreview} alt="original" className="compare-img" />
                  </div>
                  <div className="compare-arrow">→</div>
                  <div className="compare-item">
                    <p className="compare-label">Reimagined</p>
                    <img
                      src={`data:image/png;base64,${result.image_base64}`}
                      alt="reimagined"
                      className="compare-img"
                    />
                  </div>
                </div>
              )}

              {mode === "text" && (
                <img
                  src={`data:image/png;base64,${result.image_base64}`}
                  alt={result.original_prompt}
                  className="result-image"
                />
              )}

              <div className="result-meta">
                <span className="meta-tag">{result.style}</span>
                <span className="meta-tag">{result.size}</span>
                <span className="meta-tag">⏱ {result.generation_time}s</span>
              </div>

              <div className="enhanced-section">
                <button className="toggle-btn" onClick={() => setShowEnhanced(v => !v)}>
                  {showEnhanced ? "Hide" : "Show"} AI-enhanced prompt ↓
                </button>
                {showEnhanced && (
                  <div className="enhanced-box">
                    <p>{result.enhanced_prompt}</p>
                    <button className="copy-btn" onClick={copyPrompt}>Copy prompt</button>
                  </div>
                )}
              </div>

              <div className="action-row">
                <button className="action-btn primary" onClick={downloadImage}>
                  ↓ Download PNG
                </button>
                <button className="action-btn secondary" onClick={() => { setResult(null); }}>
                  ↺ Try again
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* History */}
      {history.length > 1 && (
        <section className="history-section">
          <h3 className="history-title">Recent generations</h3>
          <div className="history-strip">
            {history.map((item, i) => (
              <div key={i} className="history-thumb" onClick={() => setResult(item)}>
                <img src={`data:image/png;base64,${item.image_base64}`} alt="" />
                <span className="history-style">{item.style}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="footer">
        Built with Groq AI + FLUX · FastAPI + React
      </footer>
    </div>
  );
}