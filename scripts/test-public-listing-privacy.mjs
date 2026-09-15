import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const loadPublicListingModule = async () => {
  const source = await readFile(new URL("../src/lib/public-listing.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const module = { exports: {} };
  new Function("module", "exports", compiled)(module, module.exports);
  return module.exports;
};

const listingFixture = () => ({
  id: "part-public-1",
  sellerId: "seller-public-1",
  categoryId: "category-public-1",
  donorVehicleId: "donor-internal-1",
  sourceChannel: "csv",
  sourceExternalId: "SELLER-STOCK-REF-PRIVATE",
  importBatchId: "batch-internal-1",
  slug: "public-part",
  title: "Public part",
  description: "Public description",
  manufacturer: "Example",
  partNumber: "PART-001",
  oemNumber: "OEM-001",
  gearboxFamily: null,
  gearboxCode: null,
  condition: "used",
  pricePence: 12500,
  shippingPence: 900,
  stock: 2,
  status: "active",
  dispatchDays: 1,
  testingStatus: "tested_working",
  warrantyDays: 30,
  conditionNotes: "Public condition note",
  damageNotes: null,
  collectionAvailable: true,
  deliveryDaysMin: 1,
  deliveryDaysMax: 3,
  distanceMiles: 12.5,
  distanceApproximate: true,
  category: {
    id: "category-public-1",
    parentId: null,
    name: "Doors",
    slug: "doors",
    isTransmissionRelated: false,
    isSelectable: true,
    sortOrder: 10,
    searchTerms: ["door"],
    privateFutureCategoryField: "must-not-leak",
  },
  seller: {
    id: "seller-public-1",
    ownerId: "profile-public-1",
    businessName: "Example Seller",
    slug: "example-seller",
    location: "Edinburgh",
    postcode: "EH1 1AA",
    description: "Public seller description",
    verified: true,
    sellerType: "business",
    businessKind: "breaker",
    privateFutureSellerField: "must-not-leak",
  },
  images: [
    {
      id: "image-public-1",
      url: "https://example.test/part.webp",
      alt: "Public part",
      position: 0,
      privateFutureImageField: "must-not-leak",
    },
  ],
  fitments: [
    {
      vehicle: {
        id: "vehicle-public-1",
        make: "Volkswagen",
        model: "Golf",
        generation: "Mk7",
        year: 2017,
        engine: "2.0 TDI",
        engineCode: "CRBC",
        fuelType: "Diesel",
        gearboxFamily: "DQ250",
        gearboxCode: "02E",
        dataStatus: "external_import",
        sourceReference: "PROVIDER-INTERNAL-REFERENCE",
        privateFutureVehicleField: "must-not-leak",
      },
      notes: "Confirm final drive ratio before ordering.",
      privateFutureFitmentField: "must-not-leak",
    },
  ],
  compatibility: {
    level: "confirmed",
    label: "Confirmed fit",
    detail: "Compatibility evidence is available.",
    verifiedFit: {
      exactFitCount: 3,
      modifiedFitCount: 0,
      didNotFitCount: 0,
    },
    privateFutureCompatibilityField: "must-not-leak",
  },
  privateFutureListingField: "must-not-leak",
});

test("public listing projection removes internal listing and fitment provenance while preserving buyer-facing data", async () => {
  const { toPublicListing } = await loadPublicListingModule();
  const result = toPublicListing(listingFixture());

  assert.equal(result.id, "part-public-1");
  assert.equal(result.title, "Public part");
  assert.equal(result.partNumber, "PART-001");
  assert.equal(result.oemNumber, "OEM-001");
  assert.equal(result.seller.ownerId, "profile-public-1");
  assert.equal(result.seller.postcode, null);
  assert.equal(result.fitments[0].vehicle.make, "Volkswagen");
  assert.equal(result.fitments[0].notes, "Confirm final drive ratio before ordering.");
  assert.equal(result.compatibility.verifiedFit.exactFitCount, 3);

  for (const key of [
    "donorVehicleId",
    "sourceChannel",
    "sourceExternalId",
    "importBatchId",
    "privateFutureListingField",
  ]) {
    assert.equal(key in result, false, `public listing must not expose ${key}`);
  }

  assert.equal("privateFutureCategoryField" in result.category, false);
  assert.equal("privateFutureSellerField" in result.seller, false);
  assert.equal("privateFutureImageField" in result.images[0], false);
  assert.equal("privateFutureFitmentField" in result.fitments[0], false);

  for (const key of ["dataStatus", "sourceReference", "privateFutureVehicleField"]) {
    assert.equal(key in result.fitments[0].vehicle, false, `public fitment vehicle must not expose ${key}`);
  }

  assert.equal("privateFutureCompatibilityField" in result.compatibility, false);
});
