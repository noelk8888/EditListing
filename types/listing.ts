export interface Listing {
  id: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
  area: string;
  building: string;
  residential: boolean;
  commercial: boolean;
  industrial: boolean;
  agricultural: boolean;
  lotArea: string;
  floorArea: string;
  status: "AVAILABLE" | "SOLD" | "LEASED OUT" | "OFF MARKET" | "ON HOLD" | "UNDER NEGO" | "UNDECISIVE SELLER" | "";
  type: PropertyType | "";
  salePrice: string;
  salePricePerSqm: string;
  leasePrice: string;
  leasePricePerSqm: string;
  lat: string;
  long: string;
  bedrooms: string;
  toilets: string;
  garage: string;
  amenities: string;
  corner: boolean;
  compound: boolean;
  photos: string;
  fbLink: string;
  mapLink: string;
  rawListing: string;
  // New fields
  withIncome: boolean;
  directOrCobroker: "Direct" | "Cobroker" | "";
  ownerBroker: string;
  howManyAway: string;
  listingOwnership: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DIRECT_COBROKER_OPTIONS = ["Direct", "Cobroker"] as const;

export type PropertyType =
  | "TOWNHOUSE"
  | "WAREHOUSE"
  | "VACANT LOT"
  | "HOUSE AND LOT"
  | "CONDO"
  | "OFFICE/COMMERCIAL"
  | "BUILDING"
  | "CLUB SHARE/BUSINESS";

export const PROPERTY_TYPES: PropertyType[] = [
  "TOWNHOUSE",
  "WAREHOUSE",
  "VACANT LOT",
  "HOUSE AND LOT",
  "CONDO",
  "OFFICE/COMMERCIAL",
  "BUILDING",
  "CLUB SHARE/BUSINESS",
];

export const STATUS_OPTIONS = ["AVAILABLE", "SOLD", "LEASED OUT", "OFF MARKET", "ON HOLD", "UNDER NEGO", "UNDECISIVE SELLER"] as const;

export const LISTING_OWNERSHIP_OPTIONS = [] as const;

export interface ParsedListing extends Partial<Listing> {
  confidence?: number;
  geocodableAddress?: string;
}

export interface SheetRow {
  rowIndex: number;
  values: string[];
}
