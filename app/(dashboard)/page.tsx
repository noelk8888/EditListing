import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, List, FileText, TrendingUp } from "lucide-react";

export default function DashboardPage() {
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">How It Works</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <p>Paste your raw property listing text</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <p>AI extracts location, price, and details</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <p>Review, edit, and save to Google Sheets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
