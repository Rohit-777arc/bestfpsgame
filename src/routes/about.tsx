import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/game/TopBar";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Rohitdabest — Mexican Standof" },
      {
        name: "description",
        content: "Meet Rohitdabest and explore the fire-fueled world of Mexican Standof.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <TopBar />
      <main className="about-page mx-auto max-w-5xl px-4 py-12 sm:py-20">
        <section className="about-card mso-panel">
          <div className="hub-info-kicker">THE PLAYER BEHIND THE GAME</div>
          <h1 className="about-title mso-display">ROHITDABEST</h1>
          <p>
            Welcome to Mexican Standof: a growing arcade playground for racing, FPS action,
            customization, and playing with friends.
          </p>
          <div className="about-fire" aria-hidden="true" />
          <Link to="/racing" className="mso-btn">
            START THE 3D RACE <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>
    </>
  );
}
