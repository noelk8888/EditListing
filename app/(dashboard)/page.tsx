"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, List, FileText, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your property listings with AI-powered data extraction
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link href="/add">
                <Button className="w-full" size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Listing
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground">
                Paste a property listing and let AI extract the details
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">View Listings</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link href="/listings">
                <Button variant="outline" className="w-full" size="lg">
                  <List className="mr-2 h-4 w-4" />
                  Browse All Listings
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground">
                View, search, filter, and manage all property listings
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setShowHowItWorks(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">How It Works</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                <p>Paste your raw property listing text</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                <p>AI extracts location, price, and details</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                <p>Review, edit, and save to Google Sheets</p>
              </div>
              <p className="text-xs text-muted-foreground pt-1">Click to see full workflow →</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How It Works Modal */}
      <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              How It Works
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            <p className="text-muted-foreground">
              A web app for managing Philippine real estate listings. It keeps two databases in sync:{" "}
              <strong>Google Sheets</strong> (the master display sheet) and{" "}
              <strong>Supabase</strong> (the structured database).
            </p>

            {/* Step 1 */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <h3 className="font-semibold">Paste Listing</h3>
              </div>
              <ul className="ml-8 space-y-0.5 text-muted-foreground list-disc">
                <li>Paste raw listing text (Facebook, Viber, etc.) into the textarea</li>
                <li>Click <strong>Search</strong> to proceed</li>
              </ul>
            </div>

            {/* Step 2 */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <h3 className="font-semibold">Check & Identify</h3>
              </div>
              <p className="ml-8 text-muted-foreground">The app searches Supabase and GSheet using:</p>
              <ul className="ml-10 space-y-0.5 text-muted-foreground list-disc">
                <li>Photo link URL match</li>
                <li>Text similarity match</li>
                <li>GEO ID match</li>
              </ul>
              <div className="ml-8 mt-2 space-y-1">
                <p className="font-medium text-foreground">A) Existing Listing Found</p>
                <ul className="ml-4 space-y-0.5 text-muted-foreground list-disc">
                  <li>Shows existing listing card with its GEO ID</li>
                  <li>Click <strong>Update Existing</strong> (goes to Step 3 pre-filled) or continue to extract</li>
                </ul>
                <p className="font-medium text-foreground mt-2">B) New Listing</p>
                <ul className="ml-4 space-y-0.5 text-muted-foreground list-disc">
                  <li>App generates the next available GEO ID (e.g. G11526)</li>
                  <li>Confirm with checkbox → shows <strong>✓ NEW LISTING CONFIRMED</strong></li>
                  <li>Proceed to Extract & Review</li>
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <h3 className="font-semibold">Extract, Review & Save</h3>
              </div>
              <ul className="ml-8 space-y-0.5 text-muted-foreground list-disc">
                <li>Click <strong>Extract & Review</strong> — sends text to Gemini AI</li>
                <li>Gemini extracts: Location, Pricing, Property details, With Income flag, Photo/Map links, Lat/Long</li>
                <li>NCR → auto-fills Province as <strong>Metro Manila</strong></li>
                <li>All fields shown in an editable review form</li>
                <li>Click <strong>Update Listing</strong> to save</li>
              </ul>
            </div>

            {/* Step 4 */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                <h3 className="font-semibold">Save (same button for New and Existing)</h3>
              </div>
              <div className="ml-8 space-y-2">
                <p className="font-medium text-foreground">New Listing → <code className="text-xs bg-muted px-1 rounded">/api/add-listing</code></p>
                <ul className="ml-4 space-y-0.5 text-muted-foreground list-disc">
                  <li>Generates GEO ID</li>
                  <li>Writes all <strong>67 columns (A–BO)</strong> to GSheet in one operation</li>
                  <li>Inserts new row in Supabase</li>
                </ul>
                <p className="font-medium text-foreground">Existing Listing → <code className="text-xs bg-muted px-1 rounded">/api/update</code></p>
                <ul className="ml-4 space-y-0.5 text-muted-foreground list-disc">
                  <li>Updates Supabase row (matched by GEO ID)</li>
                  <li>Updates GSheet cols A–P (display) and Z–BO (sync)</li>
                  <li>If GEO ID not in Supabase, inserts it (handles legacy GSheet-only listings)</li>
                </ul>
              </div>
            </div>

            {/* Data Architecture */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Location</th>
                    <th className="text-left px-3 py-2 font-semibold">Columns</th>
                    <th className="text-left px-3 py-2 font-semibold">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-3 py-2">GSheet A–P</td>
                    <td className="px-3 py-2">16 cols</td>
                    <td className="px-3 py-2 text-muted-foreground">Human-readable display (blasted format, type, area, price…)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">GSheet Q–Y</td>
                    <td className="px-3 py-2">9 cols</td>
                    <td className="px-3 py-2 text-muted-foreground">Empty buffer (reserved)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">GSheet Z–BO</td>
                    <td className="px-3 py-2">42 cols</td>
                    <td className="px-3 py-2 text-muted-foreground">Structured sync data (mirrors Supabase fields)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Supabase</td>
                    <td className="px-3 py-2">All fields</td>
                    <td className="px-3 py-2 text-muted-foreground">Structured database, powers search & the app UI</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Supported Data Extraction</CardTitle>
          <CardDescription>
            The AI can automatically extract the following information from your listings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <h4 className="font-medium mb-2">Location</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Region & Province</li>
                <li>City & Barangay</li>
                <li>Area & Building</li>
                <li>Lat/Long Coordinates</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Property Details</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Lot & Floor Area</li>
                <li>Bedrooms & Bathrooms</li>
                <li>Garage/Parking</li>
                <li>Amenities</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Pricing</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Sale Price</li>
                <li>Sale Price/sqm</li>
                <li>Lease Price</li>
                <li>Lease Price/sqm</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Categories</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Residential/Commercial</li>
                <li>Industrial/Agricultural</li>
                <li>Property Type</li>
                <li>Corner/Compound</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
