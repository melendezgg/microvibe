/** @jsx h */
import { h } from "preact";

export default function UserDetailPage({ params }) {
  return (
    <section>
      <h2>Dynamic Route Example</h2>
      <p>
        User id from URL: <code>{params.id}</code>
      </p>
      <p>
        This page comes from <code>routes/users/[id].jsx</code>.
      </p>
    </section>
  );
}
