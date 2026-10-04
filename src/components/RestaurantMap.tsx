import { useEffect, useRef, useState } from "react";
import { Map, Marker, AttributionControl } from "@vis.gl/react-maplibre";
import type { MapRef } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { hasCoordinates } from "../lib/types";
import type { RestaurantWithMenu } from "../lib/types";
import * as m from "../paraglide/messages";
setWorkerUrl(workerUrl);
export default function RestaurantMap({
  restaurants,
  selected,
  onSelect,
}: {
  restaurants: RestaurantWithMenu[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<MapRef>(null);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const sync = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const map = ref.current;
    if (!ready || !map) return;
    const active = restaurants.find((r) => r.id === selected);
    if (active && hasCoordinates(active)) {
      map.easeTo({
        center: [active.longitude, active.latitude],
        zoom: 15,
        padding: padding(),
        duration: 400,
      });
      return;
    }
    const points = restaurants.filter(hasCoordinates);
    if (!points.length) {
      map.easeTo({ center: [11.96619, 57.70692], zoom: 13, padding: padding() });
      return;
    }
    const lngs = points.map((r) => r.longitude),
      lats = points.map((r) => r.latitude);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: padding(), maxZoom: 15, duration: 400 },
    );
  }, [restaurants, selected, ready]);
  return (
    <div className="map">
      {theme && (
        <Map
          ref={ref}
          initialViewState={{ longitude: 11.96619, latitude: 57.70692, zoom: 13 }}
          mapStyle={`https://basemaps.cartocdn.com/gl/${theme === "dark" ? "dark-matter" : "positron"}-gl-style/style.json`}
          attributionControl={false}
          dragRotate={false}
          touchPitch={false}
          onLoad={() => {
            setReady(true);
            setError(false);
          }}
          onError={() => setError(true)}
          onResize={() => {
            setReady(false);
            requestAnimationFrame(() => setReady(true));
          }}
        >
          <AttributionControl compact position="bottom-right" />
          {restaurants.filter(hasCoordinates).map((r) => (
            <Marker
              key={r.id}
              longitude={r.longitude}
              latitude={r.latitude}
              anchor="center"
              ref={(marker) => {
                if (marker) {
                  const element = marker.getElement();
                  element.setAttribute("role", "presentation");
                  element.setAttribute("aria-label", "");
                }
              }}
            >
              <button
                className={`map-marker ${r.id === selected ? "active" : ""}`}
                type="button"
                aria-label={m.select({ name: r.title })}
                aria-pressed={r.id === selected}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(r.id);
                }}
              />
            </Marker>
          ))}
        </Map>
      )}
      {error && (
        <p className="map-error" role="status">
          {m.map_error()}
        </p>
      )}
    </div>
  );
}
function padding() {
  return window.innerWidth >= 768
    ? { top: 100, right: 40, bottom: 40, left: Math.min(420, window.innerWidth * 0.38) + 40 }
    : { top: 100, right: 25, bottom: Math.round(window.innerHeight * 0.48) + 20, left: 25 };
}
