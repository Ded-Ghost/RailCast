import { useRef, useState, type ReactNode, type RefObject } from "react";
import { MapContainer as LeafletMapContainer, TileLayer, useMap } from "react-leaflet";
import { Layers, Locate, Maximize } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/types";
import { cn } from "@/lib/cn";

export type MapType = "roadmap" | "satellite" | "hybrid";

/**
 * Real tile sources — no API key required for any of these:
 *  - roadmap: standard OpenStreetMap tiles (streets, place names, state
 *    boundaries — actual India geography, not an illustration).
 *  - satellite: Esri World Imagery (free, keyless REST tile service).
 *  - hybrid: the same imagery with Esri's free reference/labels overlay
 *    layered on top, mirroring what Google's HYBRID mode shows.
 *
 * This is the one seam a future Google Maps integration would replace —
 * swap this map for one keyed by `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`
 * and every consumer (RouteOverlay, StationMarker, TrainMarker, the pages
 * that render them) keeps working unchanged, since they only ever deal in
 * plain {lat, lng} data, never in a specific map SDK's types.
 */
const TILE_LAYERS: Record<MapType, { url: string; attribution: string }[]> = {
  roadmap: [
    {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  ],
  satellite: [
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    },
  ],
  hybrid: [
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      attribution: "Labels &copy; Esri",
    },
  ],
};

const MAP_TYPE_LABELS: Record<MapType, string> = {
  roadmap: "Map",
  satellite: "Satellite",
  hybrid: "Hybrid",
};

export interface MapContainerProps {
  center: GeoPoint;
  zoom: number;
  children?: ReactNode;
  className?: string;
  /** Which controls to show — every page decides for itself which it needs. */
  showTypeControl?: boolean;
  showRecenterControl?: boolean;
  showFullscreenControl?: boolean;
  scrollWheelZoom?: boolean;
}

/**
 * The one real geographic map component in the app. Everything else
 * (StationMarker, TrainMarker, RouteOverlay, HeatmapOverlay) renders as
 * children of this, using react-leaflet primitives under the hood, so
 * they compose the same way regular React components would.
 */
export function MapContainer({
  center,
  zoom,
  children,
  className,
  showTypeControl = true,
  showRecenterControl = true,
  showFullscreenControl = true,
  scrollWheelZoom = true,
}: MapContainerProps) {
  const [mapType, setMapType] = useState<MapType>("roadmap");
  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={wrapperRef} className={cn("relative isolate", className)}>
      <LeafletMapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        className="h-full w-full"
        style={{ background: "#eef1f5" }}
      >
        {TILE_LAYERS[mapType].map((layer) => (
          <TileLayer key={layer.url} url={layer.url} attribution={layer.attribution} />
        ))}
        {children}
        <RecenterOnChange center={center} zoom={zoom} />

        {/*
          Deliberately rendered as CHILDREN of LeafletMapContainer, not
          siblings: RecenterButton calls useMap(), which only works inside
          the React context LeafletMapContainer provides. react-leaflet
          renders `children` into the same DOM node Leaflet itself manages,
          so plain overlay markup like this renders and positions exactly
          as it would anywhere else — this is the standard way to add
          custom controls in react-leaflet.
        */}
        {(showTypeControl || showRecenterControl || showFullscreenControl) && (
          <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
            {showTypeControl && (
              <div className="pointer-events-auto flex overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest shadow-popover">
                {(Object.keys(TILE_LAYERS) as MapType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMapType(type)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                      mapType === type
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high",
                    )}
                  >
                    {type === "roadmap" && <Layers size={12} />}
                    {MAP_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
            <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest shadow-popover">
              {showRecenterControl && <RecenterButton center={center} zoom={zoom} />}
              {showFullscreenControl && <FullscreenButton targetRef={wrapperRef} />}
            </div>
          </div>
        )}
      </LeafletMapContainer>
    </div>
  );
}

/** Keeps the map view in sync when `center`/`zoom` props change from outside (e.g. "focus this section"). */
function RecenterOnChange({ center, zoom }: { center: GeoPoint; zoom: number }) {
  const map = useMap();
  const lastCenterRef = useRef<string>("");
  const key = `${center.lat},${center.lng},${zoom}`;
  if (lastCenterRef.current !== key) {
    lastCenterRef.current = key;
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }
  return null;
}

function RecenterButton({ center, zoom }: { center: GeoPoint; zoom: number }) {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => map.setView([center.lat, center.lng], zoom, { animate: true })}
      aria-label="Recenter map"
      className="flex h-8 w-8 items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-container-high"
    >
      <Locate size={15} />
    </button>
  );
}

function FullscreenButton({ targetRef }: { targetRef: RefObject<HTMLDivElement> }) {
  const handleClick = () => {
    const el = targetRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Toggle fullscreen"
      className="flex h-8 w-8 items-center justify-center border-t border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-high"
    >
      <Maximize size={15} />
    </button>
  );
}
