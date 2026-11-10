import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TOOLS } from '../data/tools.js';
import { generateDocument } from '../lib/api.js';

export default function ToolRunner() {
  const { toolId } = useParams();
  const tool = TOOLS.find((t) => t.id === toolId);
  const [values, setValues] = useState(() =>
    Object.fromEntries((tool?.fields || []).map((f) => [f.name, f.default || '']))
  );
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [quotaLeft, setQuotaLeft] = useState(null);
  const outRef = useRef(null);

  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [output]);

  if (!tool) {
    return (
      <div className="page">
        <h1>Alat tidak dijumpai</h1>
        <Link to="/dashboard" className="btn btn-primary">Kembali ke Dashboard</Link>
      </div>
    );
  }

  const setField = (name, v) => setValues((s) => ({ ...s, [name]: v }));

  const onRun = async () => {
    const missing = tool.fields.find((f) => f.required && !values[f.name]?.trim());
    if (missing) {
      setError(`${missing.label} wajib diisi.`);
      return;
    }
    setError('');
    setRunning(true);
    setOutput('');
    try {
      const { text, quotaRemaining } = await generateDocument(
        tool.id,
        tool.buildPrompt(values),
        tool.systemPrompt,
        (partial) => setOutput(partial)
      );
      setOutput(text);
      if (typeof quotaRemaining === 'number') setQuotaLeft(quotaRemaining);
    } catch (err) {
      setError(err.message || 'Janaan gagal.');
    } finally {
      setRunning(false);
    }
  };

  const download = () => {
    const isJson = tool.outputFormat === 'json';
    const ext = isJson ? 'json' : 'md';
    const content = isJson && !output.trim().startsWith('{')
      ? output // biarkan seperti sedia
      : output;
    const blob = new Blob([content], { type: isJson ? 'application/json' : 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${tool.id}-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const renderField = (f) => {
    if (f.type === 'textarea') {
      return (
        <textarea
          rows={6}
          placeholder={f.placeholder}
          value={values[f.name]}
          onChange={(e) => setField(f.name, e.target.value)}
        />
      );
    }
    if (f.type === 'select') {
      return (
        <select value={values[f.name]} onChange={(e) => setField(f.name, e.target.value)}>
          {(f.options || []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        placeholder={f.placeholder}
        value={values[f.name]}
        onChange={(e) => setField(f.name, e.target.value)}
      />
    );
  };

  return (
    <div className="page tool-runner">
      <div className="page-head">
        <div>
          <Link to="/dashboard" className="back-link">← Dashboard</Link>
          <h1>{tool.icon} {tool.name}</h1>
          <p className="muted">{tool.description}</p>
        </div>
        {quotaLeft !== null && (
          <span className="tag tag-quota">Baki kuota hari ini: {quotaLeft}</span>
        )}
      </div>

      <div className="runner-grid">
        <section className="card runner-form">
          <h2>Maklumat Input</h2>
          {tool.fields.map((f) => (
            <label key={f.name}>
              {f.label}
              {renderField(f)}
            </label>
          ))}
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" onClick={onRun} disabled={running}>
            {running ? 'Sedang menjana…' : '✨ Jana Sekarang'}
          </button>
        </section>

        <section className="card runner-output">
          <div className="output-head">
            <h2>Hasil</h2>
            {output && (
              <div className="output-actions">
                <button className="btn btn-ghost btn-sm" onClick={download}>
                  ⬇ Muat Turun
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigator.clipboard.writeText(output)}
                >
                  ⧉ Salin
                </button>
              </div>
            )}
          </div>
          <pre ref={outRef} className={`output ${running ? 'output-streaming' : ''}`}>
            {output || (running ? '' : 'Hasil akan dipaparkan di sini.')}
            {running && <span className="caret">▋</span>}
          </pre>
        </section>
      </div>
    </div>
  );
}
