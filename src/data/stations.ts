import type { Station } from "@/types";

/**
 * Mock station master data. In production this would be served by a
 * `/stations` endpoint — nothing in the UI should assume this is static.
 */
export const stations: Station[] = [
  { code: "BBS", name: "Bhubaneswar", position: { lat: 20.2961, lng: 85.8245 }, zone: "East Coast" },
  { code: "CTC", name: "Cuttack", position: { lat: 20.4625, lng: 85.8828 }, zone: "East Coast" },
  { code: "BLS", name: "Balasore", position: { lat: 21.4942, lng: 86.9317 }, zone: "East Coast" },
  { code: "KGP", name: "Kharagpur", position: { lat: 22.3302, lng: 87.324 }, zone: "South Eastern" },
  { code: "DHN", name: "Dhanbad", position: { lat: 23.7957, lng: 86.4304 }, zone: "East Central" },
  { code: "GAYA", name: "Gaya", position: { lat: 24.7955, lng: 84.9994 }, zone: "East Central" },
  { code: "CNB", name: "Kanpur Central", position: { lat: 26.4499, lng: 80.3319 }, zone: "North Central" },
  { code: "NDLS", name: "New Delhi", position: { lat: 28.6431, lng: 77.2197 }, zone: "Northern" },
  { code: "NGP", name: "Nagpur", position: { lat: 21.1458, lng: 79.0882 }, zone: "Central" },
  { code: "BPL", name: "Bhopal", position: { lat: 23.2599, lng: 77.4126 }, zone: "West Central" },
  { code: "BCT", name: "Mumbai Central", position: { lat: 18.9696, lng: 72.8205 }, zone: "Western" },
  { code: "KOTA", name: "Kota Junction", position: { lat: 25.1804, lng: 75.8648 }, zone: "West Central" },
  { code: "JAJPUR", name: "Jajpur Keonjhar Road", position: { lat: 20.8449, lng: 86.3242 }, zone: "East Coast" },
];

export function getStationByCode(code: string): Station | undefined {
  return stations.find((station) => station.code === code);
}
