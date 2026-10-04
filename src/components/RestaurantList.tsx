import { useEffect, useRef } from "react";
import type { RestaurantWithMenu } from "../lib/types";
import * as m from "../paraglide/messages";
export default function RestaurantList({
  restaurants,
  selected,
  onSelect,
}: {
  restaurants: RestaurantWithMenu[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (selected)
      refs.current.get(selected)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected, restaurants]);
  return (
    <ul className="restaurant-list">
      {restaurants.map((r) => (
        <li
          key={r.id}
          ref={(el) => {
            if (el) refs.current.set(r.id, el);
            else refs.current.delete(r.id);
          }}
          className={`restaurant ${selected === r.id ? "selected" : ""}`}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) return;
            onSelect(r.id);
          }}
        >
          <h2>
            <button
              type="button"
              className="restaurant-select"
              aria-pressed={selected === r.id}
              aria-label={m.select({ name: r.title })}
            >
              {r.title}
            </button>
          </h2>
          <p>
            <span>{m.address()}</span> {r.address}
          </p>
          <p>
            <span>{m.phone()}</span>{" "}
            {r.phone ? <a href={`tel:${r.phone.replace(/[^+\d]/g, "")}`}>{r.phone}</a> : r.phone}
          </p>
          <h3>{m.menu()}</h3>
          {r.menuItems.flatMap((item) =>
            item.description.split("\n").map((line, index) => (
              <p className="dish" key={`${item.id}-${index}`}>
                {line}
              </p>
            )),
          )}
        </li>
      ))}
    </ul>
  );
}
