import { forwardRef, useEffect, useImperativeHandle } from "react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RestaurantMap from "../src/components/RestaurantMap";
import MapBoundary from "../src/components/MapBoundary";
const actions = vi.hoisted(() => ({ fitBounds: vi.fn(), easeTo: vi.fn() }));
vi.mock("@vis.gl/react-maplibre", () => ({
  Map: forwardRef(function FakeMap(
    { children, onLoad, onError }: { children: ReactNode; onLoad: () => void; onError: () => void },
    ref,
  ) {
    useImperativeHandle(ref, () => actions);
    useEffect(() => onLoad(), []);
    return (
      <div>
        {children}
        <button onClick={onError}>Fail map</button>
      </div>
    );
  }),
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AttributionControl: () => null,
}));
const row = {
  id: "r",
  title: "Lunch",
  address: "",
  phone: "",
  latitude: 57.7,
  longitude: 11.9,
  menuItems: [],
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("fits valid markers and focuses a selected restaurant", async () => {
  const select = vi.fn();
  const view = render(
    <RestaurantMap
      restaurants={[row, { ...row, id: "missing", latitude: null }]}
      selected={null}
      onSelect={select}
    />,
  );
  await waitFor(() => expect(actions.fitBounds).toHaveBeenCalled());
  expect(screen.getAllByRole("button", { name: "Select Lunch" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Select Lunch" }));
  expect(select).toHaveBeenCalledWith("r");
  view.rerender(<RestaurantMap restaurants={[row]} selected="r" onSelect={select} />);
  expect(actions.easeTo).toHaveBeenLastCalledWith(
    expect.objectContaining({ center: [11.9, 57.7], zoom: 15 }),
  );
  view.rerender(<RestaurantMap restaurants={[row]} selected={null} onSelect={select} />);
  expect(actions.fitBounds.mock.calls.length).toBeGreaterThan(1);
});
it("handles empty markers and displays a visible map failure", async () => {
  render(<RestaurantMap restaurants={[]} selected={null} onSelect={() => {}} />);
  await waitFor(() => expect(actions.easeTo).toHaveBeenCalled());
  fireEvent.click(screen.getByText("Fail map"));
  expect(screen.getByRole("status").textContent).toContain("restaurant list");
});
it("uses padding for the mobile list panel", async () => {
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 844);
  render(<RestaurantMap restaurants={[row]} selected={null} onSelect={() => {}} />);
  await waitFor(() => expect(actions.fitBounds).toHaveBeenCalled());
  expect(actions.fitBounds.mock.calls[0][1].padding.bottom).toBeGreaterThan(400);
  vi.unstubAllGlobals();
});
it("keeps sibling content available if map initialization throws", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  function BrokenMap(): ReactNode {
    throw new Error("No WebGL");
  }
  render(
    <>
      <MapBoundary>
        <BrokenMap />
      </MapBoundary>
      <p>Restaurant list remains</p>
    </>,
  );
  expect(screen.getByRole("status").textContent).toContain("map could not be loaded");
  expect(screen.getByText("Restaurant list remains")).toBeTruthy();
  vi.restoreAllMocks();
});
