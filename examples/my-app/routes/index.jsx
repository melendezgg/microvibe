/** @jsx h */
import { h } from "preact";
import AlertBox from "../Components/AlertBox";

export const mode = "client";

export default function IndexPage() {
  return (
    <section className="index-page">
      <p>Add route files in <code>/routes</code>.</p>
      <p>Add reusable UI components in <code>/Components</code>.</p>
      <p>Add API handlers in <code>/api</code>.</p>
      <p>Try <code>/api/highlights</code> for a sample JSON response.</p>
      <p>Start by editing <code>/routes/index.jsx</code>.</p>
      <AlertBox
        title="Interactive example"
        message="This alert is a client component. Press Dismiss, then start editing it in /Components/AlertBox.jsx."
      />
    </section>
  );
}
