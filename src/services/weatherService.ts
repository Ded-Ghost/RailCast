import type { GeoPoint, WeatherCondition, WeatherSnapshot } from "@/types";

/**
 * This is the ONE service in the app that makes a genuine live network
 * call — everything else under services/ reads from src/data mock
 * fixtures. Open-Meteo requires no API key and is free for non-commercial
 * use (CC BY 4.0) — see https://open-meteo.com. If RailCast becomes a
 * commercial product, Open-Meteo's terms would need revisiting, or a
 * switch to a licensed provider like OpenWeatherMap.
 *
 * Deliberately called directly from the client: Open-Meteo needs no
 * secret to protect (no API key at all), unlike the RailRadar live-train
 * integration in liveTrainService.ts, which does carry a secret and must
 * go through a backend proxy.
 */

const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * WMO weather interpretation codes, as used by Open-Meteo — see
 * https://open-meteo.com/en/docs for the full table. Mapped down to a
 * human label plus the coarse bucket Simulation Lab's scenario control
 * already uses, so a real reading can be compared against a what-if choice.
 */
function interpretWeatherCode(code: number): { label: string; condition: WeatherCondition } {
  if (code === 0) return { label: "Clear sky", condition: "Clear" };
  if (code === 1) return { label: "Mainly clear", condition: "Clear" };
  if (code === 2) return { label: "Partly cloudy", condition: "Clear" };
  if (code === 3) return { label: "Overcast", condition: "Clear" };
  if (code === 45 || code === 48) return { label: "Fog", condition: "Fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", condition: "Rain" };
  if (code >= 61 && code <= 67) return { label: "Rain", condition: "Rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", condition: "Rain" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", condition: "Rain" };
  if (code === 85 || code === 86) return { label: "Snow showers", condition: "Rain" };
  if (code >= 95) return { label: "Thunderstorm", condition: "Rain" };
  return { label: "Unknown", condition: "Clear" };
}

export interface WeatherFetchTarget {
  stationCode: string;
  stationName: string;
  position: GeoPoint;
}

export const weatherService = {
  /**
   * Fetches real current conditions for one point. Throws on network
   * failure or a non-OK response — callers (see hooks/useCurrentWeather)
   * are responsible for turning that into an "offline"/"stale"
   * DataSourceStatus rather than silently hiding the failure.
   */
  async getCurrentWeather(target: WeatherFetchTarget): Promise<WeatherSnapshot> {
    const url = new URL(OPEN_METEO_BASE_URL);
    url.searchParams.set("latitude", String(target.position.lat));
    url.searchParams.set("longitude", String(target.position.lng));
    url.searchParams.set("current", "temperature_2m,precipitation,weather_code,wind_speed_10m");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Open-Meteo request failed: ${response.status}`);
    }

    const payload = await response.json();
    const current = payload?.current;
    if (!current) {
      throw new Error("Open-Meteo response missing current conditions");
    }

    const { label, condition } = interpretWeatherCode(current.weather_code);

    return {
      stationCode: target.stationCode,
      stationName: target.stationName,
      temperatureCelsius: current.temperature_2m,
      precipitationMm: current.precipitation,
      windSpeedKmh: current.wind_speed_10m,
      weatherCode: current.weather_code,
      conditionLabel: label,
      condition,
      observedAt: current.time,
    };
  },
};
