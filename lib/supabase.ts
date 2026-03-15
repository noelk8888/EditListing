import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SupabaseListing {
  id: string;
  summary: string | null;
  photo_link: string | null;
  region: string | null;
  province: string | null;
  city: string | null;
  barangay: string | null;
  area: string | null;
  building: string | null;
  lot_area: number | null;
  floor_area: number | null;
  status: string | null;
  type_description: string | null;
  price: number | null;
  lease_price: number | null;
  // Property type fields
  residential: string | null;
  commercial: string | null;
  industrial: string | null;
  agricultural: string | null;
  // Additional Info fields
  with_income: string | null;
  direct_or_broker: string | null;
  owner_broker: string | null;
  how_many_away: string | null;
  listing_ownership: string | null;
  sale_or_lease: string | null;
  date_received: string | null;
  date_updated: string | null;
  available: string | null;
  // MORE INFO fields (Supabase only)
  fb_link: string | null;
  map_link: string | null;
  sale_price_per_sqm: number | null;
  lease_price_per_sqm: number | null;
  property_type: string | null;
  lat_long: string | null;
  lat: string | null;
  long: string | null;
  bedrooms: string | null;
  toilet: string | null;
  garage: string | null;
  amenities: string | null;
  corner: string | null;
  compound: string | null;
  comments: string | null;
  monthly_dues: string | null;
  sponsor_start: string | null;
  sponsor_end: string | null;
}

export async function searchListingByPhotoLink(photoLink: string): Promise<SupabaseListing | null> {
  if (!photoLink) return null;

  // Extract the unique identifier from Google Photos URL
  // e.g., "2qXufRjJCxMF1mQE7" from "https://photos.app.goo.gl/2qXufRjJCxMF1mQE7"
  const urlMatch = photoLink.match(/goo\.gl\/([a-zA-Z0-9]+)/);
  const uniqueId = urlMatch ? urlMatch[1] : null;

  if (uniqueId) {
    // Search using the unique identifier
    const { data, error } = await supabase
      .from('listings')
      .select('id, summary, photo_link, region, province, city, barangay, area, lot_area, floor_area, status, type_description, price')
      .ilike('photo_link', `%${uniqueId}%`)
      .limit(1);

    if (error) {
      console.error('Supabase search error:', error);
      return null;
    }

    if (data && data.length > 0) {
      return data[0] as SupabaseListing;
    }
  }

  // Fallback: try exact match or broader search
  const { data, error } = await supabase
    .from('listings')
    .select('id, summary, photo_link, region, province, city, barangay, area, lot_area, floor_area, status, type_description, price')
    .ilike('photo_link', `%${photoLink}%`)
    .limit(1);

  if (error) {
    console.error('Supabase search error:', error);
    return null;
  }

  if (data && data.length > 0) {
    return data[0] as SupabaseListing;
  }

  return null;
}

export async function searchListingsByText(searchText: string): Promise<SupabaseListing[]> {
  if (!searchText || searchText.length < 3) return [];

  const { data, error } = await supabase
    .from('listings')
    .select('id, summary, photo_link, region, province, city, barangay, area, lot_area, floor_area, status, type_description, price')
    .or(`summary.ilike.%${searchText}%,city.ilike.%${searchText}%,barangay.ilike.%${searchText}%,area.ilike.%${searchText}%`)
    .limit(10);

  if (error || !data) return [];
  return data as SupabaseListing[];
}
