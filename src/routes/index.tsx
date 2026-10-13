import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/fps/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dust Range — Browser FPS Shooter" },
      { name: "description", content: "A first-person shooter in your browser. Sprint through a desert arena and hit as many targets as you can in 60 seconds." },
      { property: "og:title", content: "Dust Range — Browser FPS Shooter" },
      { property: "og:description", content: "Aim, shoot, and beat your best score in a 60-second desert target run." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});
