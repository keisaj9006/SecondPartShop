import type {
  Category,
  CompatibilityInfo,
  Listing,
  ListingImage,
  Seller,
  VerifiedFitSummary,
  Vehicle,
} from "@/lib/types";

export type PublicVehicle = Pick<
  Vehicle,
  | "id"
  | "make"
  | "model"
  | "generation"
  | "year"
  | "engine"
  | "engineCode"
  | "fuelType"
  | "gearboxFamily"
  | "gearboxCode"
>;

export type PublicFitment = {
  vehicle: PublicVehicle;
  notes: string | null;
};

export type PublicSeller = Pick<
  Seller,
  | "id"
  | "ownerId"
  | "businessName"
  | "slug"
  | "location"
  | "description"
  | "verified"
  | "sellerType"
  | "businessKind"
> & {
  postcode: null;
};

export type PublicCategory = Pick<
  Category,
  | "id"
  | "parentId"
  | "name"
  | "slug"
  | "isTransmissionRelated"
  | "isSelectable"
  | "sortOrder"
  | "searchTerms"
>;

export type PublicListingImage = Pick<ListingImage, "id" | "url" | "alt" | "position">;

export type PublicVerifiedFitSummary = Pick<
  VerifiedFitSummary,
  "exactFitCount" | "modifiedFitCount" | "didNotFitCount"
>;

export type PublicCompatibilityInfo = Pick<CompatibilityInfo, "level" | "label" | "detail"> & {
  verifiedFit?: PublicVerifiedFitSummary;
};

export type PublicListing = Pick<
  Listing,
  | "id"
  | "sellerId"
  | "categoryId"
  | "slug"
  | "title"
  | "description"
  | "manufacturer"
  | "partNumber"
  | "oemNumber"
  | "gearboxFamily"
  | "gearboxCode"
  | "condition"
  | "pricePence"
  | "shippingPence"
  | "stock"
  | "status"
  | "dispatchDays"
  | "testingStatus"
  | "warrantyDays"
  | "conditionNotes"
  | "damageNotes"
  | "collectionAvailable"
  | "deliveryDaysMin"
  | "deliveryDaysMax"
  | "distanceMiles"
  | "distanceApproximate"
> & {
  category: PublicCategory;
  seller: PublicSeller;
  images: PublicListingImage[];
  fitments: PublicFitment[];
  compatibility?: PublicCompatibilityInfo | null;
};

const toPublicVehicle = (vehicle: Vehicle): PublicVehicle => ({
  id: vehicle.id,
  make: vehicle.make,
  model: vehicle.model,
  generation: vehicle.generation,
  year: vehicle.year,
  engine: vehicle.engine,
  engineCode: vehicle.engineCode,
  fuelType: vehicle.fuelType,
  gearboxFamily: vehicle.gearboxFamily,
  gearboxCode: vehicle.gearboxCode,
});

const toPublicCompatibility = (
  compatibility: CompatibilityInfo | null | undefined,
): PublicCompatibilityInfo | null | undefined => {
  if (!compatibility) return compatibility;

  return {
    level: compatibility.level,
    label: compatibility.label,
    detail: compatibility.detail,
    ...(compatibility.verifiedFit
      ? {
          verifiedFit: {
            exactFitCount: compatibility.verifiedFit.exactFitCount,
            modifiedFitCount: compatibility.verifiedFit.modifiedFitCount,
            didNotFitCount: compatibility.verifiedFit.didNotFitCount,
          },
        }
      : {}),
  };
};

export const toPublicListing = (listing: Listing): PublicListing => ({
  id: listing.id,
  sellerId: listing.sellerId,
  categoryId: listing.categoryId,
  slug: listing.slug,
  title: listing.title,
  description: listing.description,
  manufacturer: listing.manufacturer,
  partNumber: listing.partNumber,
  oemNumber: listing.oemNumber,
  gearboxFamily: listing.gearboxFamily,
  gearboxCode: listing.gearboxCode,
  condition: listing.condition,
  pricePence: listing.pricePence,
  shippingPence: listing.shippingPence,
  stock: listing.stock,
  status: listing.status,
  dispatchDays: listing.dispatchDays,
  testingStatus: listing.testingStatus,
  warrantyDays: listing.warrantyDays,
  conditionNotes: listing.conditionNotes,
  damageNotes: listing.damageNotes,
  collectionAvailable: listing.collectionAvailable,
  deliveryDaysMin: listing.deliveryDaysMin,
  deliveryDaysMax: listing.deliveryDaysMax,
  distanceMiles: listing.distanceMiles,
  distanceApproximate: listing.distanceApproximate,
  category: {
    id: listing.category.id,
    parentId: listing.category.parentId,
    name: listing.category.name,
    slug: listing.category.slug,
    isTransmissionRelated: listing.category.isTransmissionRelated,
    isSelectable: listing.category.isSelectable,
    sortOrder: listing.category.sortOrder,
    searchTerms: listing.category.searchTerms,
  },
  seller: {
    id: listing.seller.id,
    ownerId: listing.seller.ownerId,
    businessName: listing.seller.businessName,
    slug: listing.seller.slug,
    location: listing.seller.location,
    postcode: null,
    description: listing.seller.description,
    verified: listing.seller.verified,
    sellerType: listing.seller.sellerType,
    businessKind: listing.seller.businessKind,
  },
  images: listing.images.map((image) => ({
    id: image.id,
    url: image.url,
    alt: image.alt,
    position: image.position,
  })),
  fitments: listing.fitments.map((fitment) => ({
    vehicle: toPublicVehicle(fitment.vehicle),
    notes: fitment.notes,
  })),
  compatibility: toPublicCompatibility(listing.compatibility),
});
