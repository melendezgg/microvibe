/** @jsx h */
import { h } from "preact";
import { useState } from "preact/hooks";

export default function AlertBox({
  title,
  message,
}) {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <p className="alert-note">
        Alert dismissed. Refresh the page to show it again.
      </p>
    );
  }

  return (
    <section className="alert-box" role="status" aria-live="polite">
      <p className="alert-title">{title}</p>
      <p className="alert-message">{message}</p>
      <div className="alert-actions">
        <button type="button" onClick={() => setVisible(false)}>
          Dismiss
        </button>
      </div>
    </section>
  );
}
