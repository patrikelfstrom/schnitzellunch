import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LunchApp from "../src/components/LunchApp";
import { getRestaurants } from "../src/lib/restaurants";
import { setLocale } from "../src/paraglide/runtime";
vi.mock("../src/lib/restaurants", () => ({ getRestaurants: vi.fn() }));
vi.mock("../src/components/RestaurantMap", () => ({
  default: ({
    selected,
    onSelect,
  }: {
    selected: string | null;
    onSelect: (id: string) => void;
  }) => (
    <button
      aria-label="Map restaurant"
      aria-pressed={selected === "r"}
      onClick={() => onSelect("r")}
    >
      Map
    </button>
  ),
}));
const rows = [
  {
    id: "r",
    title: "Lunch",
    address: "Test 1",
    phone: "123",
    latitude: 57,
    longitude: 12,
    menuItems: [
      { id: "m", description: "Schnitzel", year: 2026, week: 40, weekDay: 1, restaurantId: "r" },
    ],
  },
];
function mount(onWeekDayChange?: (day: number) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <LunchApp initial={{ year: 2026, week: 40, weekDay: 1 }} onWeekDayChange={onWeekDayChange} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setLocale("en", { reload: false });
});
it("shows loading, empty data, and all weekday buttons", async () => {
  vi.mocked(getRestaurants).mockResolvedValue([]);
  mount();
  expect(screen.getByRole("status").textContent).toContain("Loading");
  await screen.findByText("No schnitzel lunches for this day.");
  expect(screen.getByRole("button", { name: "Sunday" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
  await waitFor(() =>
    expect(getRestaurants).toHaveBeenLastCalledWith({ data: { year: 2026, week: 40, weekDay: 2 } }),
  );
});
it("synchronizes map and list selection, toggles selection, and clears it after filtering", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(getRestaurants).mockResolvedValue(rows);
  mount();
  const item = await screen.findByRole("button", { name: "Select Lunch" });
  fireEvent.click(item);
  expect(screen.getByRole("button", { name: "Map restaurant" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Map restaurant" }));
  expect(item.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Map restaurant" }));
  expect(item.getAttribute("aria-pressed")).toBe("true");
  vi.mocked(getRestaurants).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
  await screen.findByText("No schnitzel lunches for this day.");
  expect(screen.getByRole("button", { name: "Map restaurant" }).getAttribute("aria-pressed")).toBe(
    "false",
  );
});
it("shows request failures and retries", async () => {
  vi.mocked(getRestaurants).mockRejectedValue(new Error("Offline"));
  mount();
  await screen.findByRole("alert");
  vi.mocked(getRestaurants).mockResolvedValue(rows);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Lunch");
});
it("renders Swedish weekday and empty text", async () => {
  setLocale("sv", { reload: false });
  vi.mocked(getRestaurants).mockResolvedValue([]);
  mount();
  expect(screen.getByRole("button", { name: "Måndag" })).toBeTruthy();
  await screen.findByText("Inga schnitzelluncher för denna dag.");
});

it("keeps selection while another weekday loads and still contains the restaurant", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  let finish!: (value: typeof rows) => void;
  vi.mocked(getRestaurants)
    .mockResolvedValueOnce(rows)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Select Lunch" }));
  fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
  await waitFor(() => expect(getRestaurants).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Map restaurant" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  finish(rows);
  const item = await screen.findByRole("button", { name: "Select Lunch" });
  expect(item.getAttribute("aria-pressed")).toBe("true");
});

it("reports the selected weekday for URL navigation", async () => {
  vi.mocked(getRestaurants).mockResolvedValue([]);
  const navigate = vi.fn();
  mount(navigate);
  fireEvent.click(screen.getByRole("button", { name: "Friday" }));
  expect(navigate).toHaveBeenCalledWith(5);
  await screen.findByText("No schnitzel lunches for this day.");
});

it("keeps the weekday from the URL when the ISO week changes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-04T21:59:00Z"));
  vi.mocked(getRestaurants).mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(
      <QueryClientProvider client={client}>
        <LunchApp initial={{ year: 2026, week: 40, weekDay: 2 }} preserveWeekDay />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(getRestaurants).toHaveBeenLastCalledWith({ data: { year: 2026, week: 41, weekDay: 2 } });
  } finally {
    cleanup();
    client.clear();
    vi.useRealTimers();
  }
});
