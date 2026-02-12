/** @jsx h */
import { h } from "preact";
import GreetingCard from "../Components/GreetingCard";

// export const mode = "client";

export default function DemoPage() {
  async function load() {
    const res = await fetch("/api/demo");
    const data = await res.json();
    console.log(data);
  }

  return (
    <section>
      <h2>Demo Route</h2>
      <GreetingCard text="Route + Component + API connected." />
      <button type="button" onClick={load}>
        Fetch /api/demo
      </button>
    </section>
  );
}