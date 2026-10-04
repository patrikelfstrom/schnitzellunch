import { createFileRoute } from "@tanstack/react-router";
import { stockholmDate } from "../lib/date";
import { lunchSearch } from "../lib/search";
import LunchApp from "../components/LunchApp";
export const Route = createFileRoute("/")({
  validateSearch: lunchSearch,
  loader: () => stockholmDate(),
  component: Home,
});
function Home() {
  const initial = Route.useLoaderData();
  const { day } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LunchApp
      initial={{ ...initial, weekDay: day ?? initial.weekDay }}
      preserveWeekDay={day !== undefined}
      onWeekDayChange={(day) => {
        void navigate({ search: { day } });
      }}
    />
  );
}
