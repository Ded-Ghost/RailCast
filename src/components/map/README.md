# components/map

Reserved for map-rendering components (network map, route map, live train
markers). Introduced when Live Network / Route Monitor are implemented.
Keep map-vendor specifics (Leaflet/Mapbox/etc.) isolated to this folder so
pages never import a mapping library directly.
