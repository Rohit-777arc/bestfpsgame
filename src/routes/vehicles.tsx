import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/vehicles")({
  beforeLoad: () => {
    throw redirect({ to: "/racing" });
  },
});
