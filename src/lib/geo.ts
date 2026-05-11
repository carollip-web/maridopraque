// Geocodificação via Nominatim (OpenStreetMap) — gratuito, sem chave.
// Política: 1 req/s, identificar app via User-Agent (no browser não tem efeito).

export type GeoPoint = { lat: number; lng: number };

export async function geocodeAddress(parts: {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}): Promise<GeoPoint | null> {
  const q = [
    [parts.logradouro, parts.numero].filter(Boolean).join(", "),
    parts.bairro,
    parts.cidade,
    parts.uf,
    parts.cep,
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");
  if (!q.trim()) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr?.[0]) return null;
    return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
  } catch {
    return null;
  }
}

export async function geocodeCidade(cidade: string, uf?: string | null): Promise<GeoPoint | null> {
  return geocodeAddress({ cidade, uf });
}

// Distância em km entre dois pontos (Haversine)
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
