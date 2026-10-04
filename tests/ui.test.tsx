import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RestaurantList from "../src/components/RestaurantList";
import ThemeToggle from "../src/components/ThemeToggle";
import { setLocale } from "../src/paraglide/runtime";
import * as m from "../src/paraglide/messages";
const rows = [
  {
    id: "r",
    title: "Lunch",
    address: "Test 1",
    phone: "123",
    latitude: null,
    longitude: null,
    menuItems: [
      {
        id: "m",
        description: "Schnitzel\nAnother schnitzel",
        year: 2026,
        week: 40,
        weekDay: 1,
        restaurantId: "r",
      },
    ],
  },
];
afterEach(() => {
  cleanup();
  setLocale("en", { reload: false });
  localStorage.clear();
  vi.restoreAllMocks();
});
it("shows restaurants without coordinates and selects by button", () => {
  const onSelect = vi.fn();
  render(<RestaurantList restaurants={rows} selected={null} onSelect={onSelect} />);
  expect(screen.getByText("Another schnitzel")).toBeTruthy();
  fireEvent.click(screen.getByRole("button"));
  expect(onSelect).toHaveBeenCalledWith("r");
});
it("marks selection and scrolls its entry into view", () => {
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  render(<RestaurantList restaurants={rows} selected="r" onSelect={() => {}} />);
  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  expect(scroll).toHaveBeenCalled();
});
it("selects from the full row while keeping the phone link independent", () => {
  const onSelect = vi.fn();
  render(<RestaurantList restaurants={rows} selected={null} onSelect={onSelect} />);
  fireEvent.click(screen.getByText("Another schnitzel"));
  fireEvent.click(screen.getByText("Test 1", { exact: false }));
  fireEvent.click(screen.getByRole("listitem"));
  fireEvent.click(screen.getByRole("button", { name: "Select Lunch" }));
  expect(onSelect).toHaveBeenCalledTimes(4);
  expect(onSelect).toHaveBeenLastCalledWith("r");
  fireEvent.click(screen.getByRole("link", { name: "123" }));
  expect(onSelect).toHaveBeenCalledTimes(4);
});
it("uses Swedish labels", () => {
  setLocale("sv", { reload: false });
  render(<RestaurantList restaurants={rows} selected={null} onSelect={() => {}} />);
  expect(screen.getByText("Adress")).toBeTruthy();
  expect(m.day_1()).toBe("Måndag");
  expect(m.empty()).toContain("Inga");
});
it("persists theme and follows the system in auto mode", () => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  render(<ThemeToggle />);
  fireEvent.click(screen.getByRole("button"));
  expect(localStorage.getItem("theme")).toBe("light");
  fireEvent.click(screen.getByRole("button"));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  fireEvent.click(screen.getByRole("button"));
  expect(localStorage.getItem("theme")).toBe("auto");
});

it("restores a saved theme without first applying the system theme", () => {
  localStorage.setItem("theme", "dark");
  document.documentElement.classList.add("dark");
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const toggle = vi.spyOn(document.documentElement.classList, "toggle");
  render(<ThemeToggle />);
  expect(screen.getByRole("button", { name: "Dark theme" })).toBeTruthy();
  expect(toggle).not.toHaveBeenCalledWith("dark", false);
});
it("exposes the menu as normal text and provides a separate telephone link", () => {
  render(<RestaurantList restaurants={rows} selected={null} onSelect={() => {}} />);
  const button = screen.getByRole("button", { name: "Select Lunch" });
  expect(button.textContent).toBe("Lunch");
  expect(screen.getByRole("heading", { name: "Menu" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "123" }).getAttribute("href")).toBe("tel:123");
});
