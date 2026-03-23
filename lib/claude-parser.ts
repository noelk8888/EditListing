import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedListing, PropertyType, PROPERTY_TYPES } from "@/types/listing";
import { generateId } from "./utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const EXTRACTION_PROMPT = `You are a real estate listing parser for properties in the Philippines.
Extract structured data from the following property listing text.

IMPORTANT RULES:
1. Extract all available information from the text
2. For location, try to identify: Region, Province, City, Barangay, Area (subdivision/district), Building name
3. Philippine regions include: NCR, CAR, Region I-XII, ARMM, Caraga, etc.
4. For prices, extract the numeric value (remove P, PHP, commas)
5. Calculate price per sqm if you have both price and lot area
6. Determine property categories (can be multiple): RESIDENTIAL, COMMERCIAL, INDUSTRIAL, AGRICULTURAL
7. Determine property type: TOWNHOUSE, WAREHOUSE, VACANT LOT, HOUSE AND LOT, CONDO, OFFICE/COMMERCIAL, BUILDING, CLUB SHARE/BUSINESS
8. Status should be: Available, Sold, Leased, On Hold, or Off Market (default to Available if not specified).
   CRITICAL: "FOR LEASE" or "FOR RENT" in the listing means the property IS AVAILABLE to be leased — set status to "Available". Do NOT confuse "FOR LEASE" with "LEASED OUT".
   Only set status to "Leased" if the listing explicitly says "LEASED OUT", "already leased", "currently leased", "tenant occupied and not available", or similar meaning the property is no longer available.
9. Extract photo URLs if present (lines with "Photos:", "Photo Link:", etc.)
9b. Extract Google Map / map link URLs if present (lines with "Google Map:", "Map Link:", "MAP LINK:", etc.)
10. For areas, extract numeric values with unit (e.g., "15430" for "15,430 sqm"). CRITICAL: "Lot Area" and "Floor Area" are DIFFERENT things. ONLY set lotArea if the listing explicitly says "Lot Area" or "Land Area". ONLY set floorArea if the listing explicitly says "Floor Area", "Unit Size", "GFA", or similar. A condo/unit listing that says "Floor Area: 147 sqm" has floorArea=147 and lotArea="" (empty). Never copy the floor area value into lotArea.
11. Look for keywords like "corner lot", "inside compound" to set corner and compound flags
12. If FOR SALE is mentioned, it's a sale listing. If FOR LEASE/RENT is mentioned, it's a lease listing.
13. Set withIncome to true if the listing mentions rental income, monthly income, income-generating, "with income", "earning", or any existing tenant/lease arrangement producing income for the buyer.
14. IMPORTANT: "Rental Income" and "Lease Price" are DIFFERENT things:
    - leasePrice = the price someone pays TO LEASE/RENT this property (only set for FOR LEASE listings)
    - Rental income (e.g. "Rental Income: P300,000/month") is income the OWNER earns from existing tenants — this sets withIncome=true but does NOT set leasePrice. Leave leasePrice empty for FOR SALE listings even if rental income is mentioned.
15. Determine directOrCobroker:
    - "Direct to Owner" if the listing says "direct", "direct to owner", "direct to seller", "direct listing", or the poster IS the owner/seller
    - "With Cobroker" if listing mentions "co-broke", "cobroke", "cobroker", "co-broker", "with co", "CB", or states it is N away from owner (e.g. "1 away", "2 away")
    - "" if cannot be determined
16. Extract ownerBroker: the name of the listing broker or agent. Look for lines like "Agent:", "Broker:", "Contact:", "Inq:", or a person's name near a phone number. Extract the name only (not the phone number). If multiple names, take the primary contact.
17. Extract howManyAway: the cobroker chain distance. Only set if the listing explicitly mentions "X away from owner/seller" — extract just the number (e.g. "1", "2"). Leave empty for direct listings or if not stated.
18. Produce a geocodableAddress: the most specific, Google Maps-ready address string you can construct from the listing. Use the format: "[Street Number + Street Name], [Building/Project], [Subdivision/Area], [Barangay], [City], [Province], Philippines". Always include the street number and street name if present in the listing — this is the most important part for accurate geocoding. Include only the parts you are confident about. Examples: "2 Young Street corner Luna Street, Corinthian Gardens, Ugong Norte, Quezon City, Metro Manila, Philippines" or "Rockwell Center, Makati City, Metro Manila, Philippines".
19. If the listing mentions "TANDEM PARKING" or "TANDEM PARKING SLOT", it refers to 2 parking slots. Set garage to "2" if this is mentioned, unless a higher total number of slots is clearly specified.

Return a JSON object with these fields (use empty string "" for unknown values, use false for unknown boolean values):
{
  "region": "string",
  "province": "string",
  "city": "string",
  "barangay": "string",
  "area": "string (subdivision/district name)",
  "building": "string (building/project name)",
  "residential": boolean,
  "commercial": boolean,
  "industrial": boolean,
  "agricultural": boolean,
  "lotArea": "string (numeric value with sqm)",
  "floorArea": "string (numeric value with sqm)",
  "status": "AVAILABLE" | "SOLD" | "LEASED OUT" | "ON HOLD" | "OFF MARKET",
  "type": "TOWNHOUSE" | "WAREHOUSE" | "VACANT LOT" | "HOUSE AND LOT" | "CONDO" | "OFFICE/COMMERCIAL" | "BUILDING" | "CLUB SHARE/BUSINESS" | "",
  "salePrice": "string (numeric value only)",
  "salePricePerSqm": "string (calculated or extracted)",
  "leasePrice": "string (numeric value only)",
  "leasePricePerSqm": "string (calculated or extracted)",
  "bedrooms": "string (number)",
  "toilets": "string (number)",
  "garage": "string (number of parking/garage)",
  "amenities": "string (comma-separated list)",
  "corner": boolean,
  "compound": boolean,
  "withIncome": boolean,
  "photos": "string (photo album URL if found)",
  "mapLink": "string (Google Map / map URL if found)",
  "directOrCobroker": "Direct to Owner" | "With Cobroker" | "",
  "ownerBroker": "string (broker/agent name only, no phone number)",
  "howManyAway": "string (number only, e.g. '1', '2', or '' if direct/unknown)",
  "geocodableAddress": "string (best Google Maps-ready address, e.g. 'Ayala Alabang Village, Muntinlupa City, Metro Manila, Philippines')"
}

LISTING TEXT:
`;

const STATUS_MAP: Record<string, string> = {
  "available": "AVAILABLE",
  "sold": "SOLD",
  "leased": "LEASED OUT",
  "leased out": "LEASED OUT",
  "on hold": "ON HOLD",
  "off market": "OFF MARKET",
};

function normalizeStatus(raw: string | undefined): string {
  if (!raw) return "";
  return STATUS_MAP[raw.toLowerCase().trim()] ?? raw.toUpperCase();
}

export async function parseListingText(text: string): Promise<ParsedListing> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(EXTRACTION_PROMPT + text);
      const responseText = result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and clean the parsed data
    const listing: ParsedListing = {
      id: generateId(),
      region: parsed.region || "",
      province: parsed.province || "",
      city: parsed.city || "",
      barangay: parsed.barangay || "",
      area: parsed.area || "",
      building: parsed.building || "",
      residential: Boolean(parsed.residential),
      commercial: Boolean(parsed.commercial),
      industrial: Boolean(parsed.industrial),
      agricultural: Boolean(parsed.agricultural),
      lotArea: String(parsed.lotArea || ""),
      floorArea: String(parsed.floorArea || ""),
      status: (normalizeStatus(parsed.status) || "Available") as "" | "Available" | "Sold" | "Leased",
      type: PROPERTY_TYPES.includes(parsed.type) ? parsed.type : "",
      salePrice: String(parsed.salePrice || "").replace(/[^0-9.-]/g, ""),
      salePricePerSqm: String(parsed.salePricePerSqm || "").replace(
        /[^0-9.-]/g,
        ""
      ),
      leasePrice: String(parsed.leasePrice || "").replace(/[^0-9.-]/g, ""),
      leasePricePerSqm: String(parsed.leasePricePerSqm || "").replace(
        /[^0-9.-]/g,
        ""
      ),
      lat: "",
      long: "",
      bedrooms: String(parsed.bedrooms || ""),
      toilets: String(parsed.toilets || ""),
      garage: String(parsed.garage || ""),
      amenities: parsed.amenities || "",
      corner: Boolean(parsed.corner),
      compound: Boolean(parsed.compound),
      withIncome: Boolean(parsed.withIncome),
      photos: parsed.photos || "",
      mapLink: parsed.mapLink || "",
      directOrCobroker: (parsed.directOrCobroker === "Direct to Owner" || parsed.directOrCobroker === "With Cobroker")
        ? parsed.directOrCobroker
        : "",
      ownerBroker: parsed.ownerBroker || "",
      howManyAway: String(parsed.howManyAway || "").replace(/[^0-9]/g, ""),
      geocodableAddress: parsed.geocodableAddress || "",
      rawListing: text,
    };

      return listing;
    } catch (error: unknown) {
      lastError = error;
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("overloaded") ||
          error.message.includes("quota") ||
          error.message.includes("503") ||
          (error as { status?: number }).status === 529 ||
          (error as { status?: number }).status === 503);
      if (isRetryable && attempt < 3) {
        console.warn(`Gemini unavailable, retrying (attempt ${attempt}/3)...`);
        await delay(2000 * attempt);
        continue;
      }
      console.error("Error parsing listing:", error);
      throw error;
    }
  }
  throw lastError;
}

export async function geocodeAddress(address: string): Promise<{ lat: string; long: string }> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;

  if (!apiKey) {
    return { lat: "", long: "" };
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${apiKey}&region=ph`
    );

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: String(location.lat),
        long: String(location.lng),
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }

  return { lat: "", long: "" };
}
