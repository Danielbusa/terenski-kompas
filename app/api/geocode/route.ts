import { NextRequest } from "next/server";

const baseUrl = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 3 || query.length > 200) {
    return Response.json({ error: "Enter at least three characters." }, { status: 400 });
  }

  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "rs");
  url.searchParams.set("layer", "address");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", request.headers.get("accept-language") || "sr,en");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "TerenskiKompas/1.0 (SUSS field operations)" },
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
    const results = await response.json() as Array<{place_id:number;display_name:string;lat:string;lon:string;address?:Record<string,string>}>;
    return Response.json(results.map((result) => ({
      id: String(result.place_id),
      label: result.display_name,
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      locality: result.address?.village || result.address?.town || result.address?.city || result.address?.municipality || result.address?.county || "",
    })), { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Address search failed." }, { status: 502 });
  }
}
