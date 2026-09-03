import { MarketplaceHome } from "@/components/marketplace-home";
import { getFeaturedListings } from "@/lib/data/listings";

export default async function Home() {
  const listings = await getFeaturedListings();
  return <MarketplaceHome initialListings={listings} />;
}
