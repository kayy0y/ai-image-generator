import { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:8000";

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
  const [prompt, setPrompt]           = useState("");
  const [style, setStyle]             = useState("realistic");
  const [size, setSize]               = useState("512x512");
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [history, setHistory]         = useState([]);
  const promptRef = useRef(null);

  const generate = async () => {
    if (!prompt.trim()) {
      setError("Enter a prompt first.");
      promptRef.current?.focus();
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    setShowEnhanced(false);

    try {
      const res = await axios.post(`${API_BASE}/generate`, { prompt, style, size });
      const data = res.data;
      setResult(data);
      setHistory(prev => [data, ...prev].slice(0, 6)); // keep last 6
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

  const copyPrompt = () => {
    navigator.clipboard.writeText(result.enhanced_prompt);
  };

  const useExample = (ex) => {
    setPrompt(ex);
    promptRef.current?.focus();
  };

  return (
    <div className="app">
      {/* ── Header ── */}
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
        {/* ── Left Panel: Controls ── */}
        <section className="panel controls-panel">
          {/* Prompt input */}
          <div className="field">
            <label className="field-label">Describe your image</label>
            <textarea
              ref={promptRef}
              className="prompt-input"
              placeholder="e.g. a neon dragon flying over a cyberpunk city at night..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              onKeyDown={e => e.key === "Enter" && e.ctrlKey && generate()}
            />
            <p className="hint">Ctrl + Enter to generate</p>
          </div>

          {/* Example prompts */}
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

          {/* Style selector */}
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

          {/* Size selector */}
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

          {/* Generate button */}
          <button
            className={`generate-btn ${loading ? "loading" : ""}`}
            onClick={generate}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Generating…
              </>
            ) : (
              "Generate Image"
            )}
          </button>

          {error && <div className="error-box">{error}</div>}
        </section>

        {/* ── Right Panel: Output ── */}
        <section className="panel output-panel">
          {loading && (
            <div className="loading-state">
              <div className="pulse-ring" />
              <p className="loading-text">Enhancing prompt with AI…</p>
              <p className="loading-sub">then sending to Stable Diffusion</p>
            </div>
          )}

          {!loading && !result && (
            <div className="empty-state">
              <div className="empty-icon">🖼️</div>
              <p>Your image will appear here</p>
            </div>
          )}

          {!loading && result && (
            <div className="result">
              <img
                src={`data:image/png;base64,${result.image_base64}`}
                alt={result.original_prompt}
                className="result-image"
              />

              {/* Metadata bar */}
              <div className="result-meta">
                <span className="meta-tag">{result.style}</span>
                <span className="meta-tag">{result.size}</span>
                <span className="meta-tag">⏱ {result.generation_time}s</span>
              </div>

              {/* Enhanced prompt toggle */}
              <div className="enhanced-section">
                <button
                  className="toggle-btn"
                  onClick={() => setShowEnhanced(v => !v)}
                >
                  {showEnhanced ? "Hide" : "Show"} AI-enhanced prompt ↓
                </button>
                {showEnhanced && (
                  <div className="enhanced-box">
                    <p>{result.enhanced_prompt}</p>
                    <button className="copy-btn" onClick={copyPrompt}>Copy prompt</button>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="action-row">
                <button className="action-btn primary" onClick={downloadImage}>
                  ↓ Download PNG
                </button>
                <button className="action-btn secondary" onClick={() => { setPrompt(result.original_prompt); setResult(null); }}>
                  ↺ Regenerate
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── History strip ── */}
      {history.length > 1 && (
        <section className="history-section">
          <h3 className="history-title">Recent generations</h3>
          <div className="history-strip">
            {history.map((item, i) => (
              <div key={i} className="history-thumb" onClick={() => setResult(item)}>
                <img
                  src={`data:image/png;base64,${item.image_base64}`}
                  alt={item.original_prompt}
                />
                <span className="history-style">{item.style}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="footer">
        Built with Claude AI + Stable Diffusion · FastAPI + React
      </footer>
    </div>
  );
}
