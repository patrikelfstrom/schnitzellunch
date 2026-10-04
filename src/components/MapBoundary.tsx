import { Component } from "react";
import type { ReactNode } from "react";
import * as m from "../paraglide/messages";
export default class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    console.error("Map initialization failed");
  }
  render() {
    return this.state.failed ? (
      <div className="map">
        <p className="map-error" role="status">
          {m.map_error()}
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
