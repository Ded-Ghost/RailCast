import type { GeoPoint } from "./common";

export interface Station {
  code: string;
  name: string;
  position: GeoPoint;
  zone?: string;
}
