import { useEffect, useState } from "react";

export default function JsonEditor({ value, onChange, label = "JSON document" }) {
    const [error, setError] = useState("");

    useEffect(() => {
        try { JSON.parse(value); setError(""); } catch { setError("Enter valid JSON before saving."); }
    }, [value]);

    return <label className="field json-field">
        <span>{label}</span>
        <textarea value={value} onChange={event => onChange(event.target.value)} spellCheck="false" aria-invalid={Boolean(error)} />
        {error && <small className="error-text">{error}</small>}
    </label>;
}
