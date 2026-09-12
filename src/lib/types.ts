export type UserRole="buyer"|"seller"|"admin";
export type PartCondition="new"|"reconditioned"|"used";
export type ListingStatus="draft"|"active"|"reserved"|"sold"|"archived";
export type VehicleDataStatus="verified"|"qa_seed"|"external_import";
export type PartTestingStatus="tested_working"|"removed_from_running_vehicle"|"visually_inspected"|"untested"|"not_specified";
export type CompatibilityLevel="confirmed"|"buyer_verified"|"family_match"|"unverified";
export type MarketplaceSort="best"|"price_asc"|"price_desc"|"distance"|"delivery"|"warranty";
export type SellerType="business"|"private";
export type SellerBusinessKind="breaker"|"garage"|"atf"|"parts_business"|"other";
export type ReviewDirection="buyer_to_seller"|"seller_to_buyer";
export type FitFeedbackResult="exact_fit"|"fit_with_modification"|"did_not_fit"|"not_installed";

export type VerifiedFitSummary={exactFitCount:number;modifiedFitCount:number;didNotFitCount:number};
export type CompatibilityInfo={level:CompatibilityLevel;label:string;detail:string;verifiedFit?:VerifiedFitSummary};
export type Profile={id:string;role:UserRole;displayName:string;handle:string;bio:string|null;phone:string|null};
export type Seller={id:string;ownerId:string|null;businessName:string;slug:string;location:string;postcode:string|null;description:string;verified:boolean;sellerType:SellerType;businessKind:SellerBusinessKind|null};
export type Category={id:string;parentId:string|null;name:string;slug:string;isTransmissionRelated:boolean;isSelectable:boolean;sortOrder:number;searchTerms:string[]};
export type Vehicle={id:string;make:string;model:string;generation:string;year:number;engine:string;engineCode:string|null;fuelType:string|null;gearboxFamily:string|null;gearboxCode:string|null;dataStatus:VehicleDataStatus;sourceReference:string|null};
export type VehicleCatalogueSelection={variantId:string;make:string;modelFamily:string;variant:string;year:number;fuelType:string|null;engineSizeSimple:number|null};
export type VehicleCatalogueModelOption={make:string;modelFamily:string};
export type CatalogueFitmentSelection={id?:string;variantId:string;make:string;modelFamily:string;variant:string;year:number;fuelType:string|null;engineSizeSimple:number|null;notes:string|null};
export type GarageVehicle={id:string;catalogueVariantId:string;registration:string|null;year:number;fuelType:string|null;engineSizeSimple:number|null;colour:string|null;nickname:string|null;make:string;modelFamily:string;variant:string;createdAt:string};
export type PartRequest={id:string;queryText:string;oemNumber:string|null;notes:string|null;status:"open"|"closed";registration:string|null;year:number|null;fuelType:string|null;engineSizeSimple:number|null;createdAt:string;categoryName:string|null;vehicleLabel:string|null;matchingSellerCount:number;verifiedSellerCount:number};
export type SellerPartRequestLead={id:string;queryText:string;oemNumber:string|null;notes:string|null;createdAt:string;categoryId:string|null;categoryName:string|null;variantId:string|null;vehicleMake:string|null;vehicleModel:string|null;vehicleVariant:string|null;year:number|null;fuelType:string|null;engineSizeSimple:number|null;matchScore:number;matchReasons:string[];draftPartId?:string|null;draftPartTitle?:string|null};
export type SavedSearch={id:string;name:string;params:Record<string,string>;createdAt:string};
export type DonorVehicle={id:string;sellerId:string;registration:string|null;make:string;model:string;variant:string|null;year:number;fuelType:string|null;engineSizeSimple:number|null;colour:string|null;notes:string|null;createdAt:string};
export type ListingImage={id:string;url:string;alt:string;position:number};
export type Fitment={vehicle:Vehicle;notes:string|null};
export type ListingSourceChannel="manual"|"csv"|"ebay"|"api";
export type Listing={id:string;sellerId:string;categoryId:string;donorVehicleId:string|null;sourceChannel:ListingSourceChannel;sourceExternalId:string|null;importBatchId:string|null;slug:string;title:string;description:string;manufacturer:string|null;partNumber:string|null;oemNumber:string|null;gearboxFamily:string|null;gearboxCode:string|null;condition:PartCondition;pricePence:number;shippingPence:number;stock:number;status:ListingStatus;dispatchDays:number;testingStatus:PartTestingStatus;warrantyDays:number;conditionNotes:string|null;damageNotes:string|null;collectionAvailable:boolean;deliveryDaysMin:number|null;deliveryDaysMax:number|null;distanceMiles?:number|null;distanceApproximate?:boolean;category:Category;seller:Seller;images:ListingImage[];fitments:Fitment[];compatibility?:CompatibilityInfo|null};
export type MarketplaceFilters={query?:string;category?:string;condition?:PartCondition;sort?:MarketplaceSort;gearboxFamily?:string;gearboxCode?:string;minPrice?:number;maxPrice?:number;postcode?:string;collectionOnly?:boolean;vehicle?:string;vehicleRegistration?:string;vehicleColour?:string;catalogueVariant?:string;catalogueYear?:number;catalogueFuel?:string;catalogueEngineSize?:number;compatibleOnly?:boolean;ids?:string[]};
export type MarketplaceSuggestion={kind:"category"|"listing"|"number"|"brand";label:string;query:string;categoryId?:string;meta?:string};
export type SearchSuggestionGroups={categories:MarketplaceSuggestion[];listings:MarketplaceSuggestion[];numbers:MarketplaceSuggestion[];brands:MarketplaceSuggestion[]};

export type PublicMemberProfile={
 id:string;
 handle:string;
 displayName:string;
 bio:string|null;
 memberSince:string;
 sellerId:string|null;
 sellerSlug:string|null;
 sellerName:string|null;
 sellerType:SellerType|null;
 sellerVerified:boolean;
 soldCount:number;
 boughtCount:number;
 sellerRating:number|null;
 sellerReviewCount:number;
 buyerRating:number|null;
 buyerReviewCount:number;
};

export type ReviewOpportunity={
 orderItemId:string;
 direction:ReviewDirection;
 counterpartProfileId:string;
 counterpartHandle:string;
 counterpartDisplayName:string;
 partTitle:string;
 fundsReleasedAt:string;
 existingReviewId:string|null;
};

export type FitFeedbackOpportunity={
 orderItemId:string;
 partId:string;
 partTitle:string;
 partSlug:string;
 variantId:string;
 vehicleMake:string;
 vehicleModel:string;
 vehicleVariant:string;
 vehicleYear:number;
 vehicleFuel:string|null;
 vehicleEngine:number|null;
 existingResult:FitFeedbackResult|null;
 existingNotes:string|null;
 fundsReleasedAt:string;
};

export type TransactionReview={
 id:string;
 reviewerHandle:string;
 reviewerDisplayName:string;
 reviewerSoldCount:number;
 reviewerBoughtCount:number;
 direction:ReviewDirection;
 overallRating:number;
 itemAsDescribedRating:number|null;
 dispatchRating:number|null;
 communicationRating:number|null;
 buyerConductRating:number|null;
 comment:string|null;
 createdAt:string;
 partTitle:string;
};

export type ListingConversationSummary={
 id:string;
 partId:string;
 partTitle:string;
 partSlug:string;
 sellerName:string;
 buyerId:string;
 sellerOwnerId:string|null;
 status:"open"|"closed";
 lastMessageAt:string;
};

export type ListingConversationMessage={
 id:string;
 senderProfileId:string;
 senderHandle:string;
 senderDisplayName:string;
 body:string;
 createdAt:string;
};

export type MessagePagination={offset:number;limit:number;hasOlder:boolean;hasNewer:boolean};

export type ListingConversationThread=ListingConversationSummary&{
 messages:ListingConversationMessage[];
 messagePagination:MessagePagination;
};

export type TransactionCaseEvidence={
 id:string;
 caseId:string;
 uploaderProfileId:string|null;
 uploaderHandle:string;
 uploaderDisplayName:string;
 originalName:string;
 mimeType:string;
 signedUrl:string;
 createdAt:string;
};

export type TransactionMessage={
 id:string;
 senderProfileId:string|null;
 senderHandle:string;
 senderDisplayName:string;
 body:string;
 createdAt:string;
};

export type TransactionThread={
 orderItemId:string;
 partTitle:string;
 partSlug:string;
 sellerName:string;
 buyerId:string|null;
 sellerOwnerId:string|null;
 paymentStatus:string;
 messages:TransactionMessage[];
 messagePagination:MessagePagination;
};

export type TransactionCase={
 id:string;
 orderItemId:string;
 caseType:"return"|"dispute"|"cancellation";
 reason:string;
 details:string;
 status:"open"|"seller_response"|"under_review"|"return_authorized"|"return_shipped"|"returned"|"resolved"|"rejected"|"cancelled";
 previousFulfilmentStatus:string;
 sellerResponse:string|null;
 resolution:"full_refund"|"no_refund"|"other"|null;
 resolutionNotes:string|null;
 returnTrackingCarrier:string|null;
 returnTrackingNumber:string|null;
 returnAuthorizedAt:string|null;
 returnShippedAt:string|null;
 returnReceivedAt:string|null;
 providerDisputeId:string|null;
 providerDisputeStatus:string|null;
 providerDisputeReason:string|null;
 createdAt:string;
 resolvedAt:string|null;
 partTitle:string;
 partSlug:string;
 sellerName:string;
 sellerSlug:string;
 buyerId:string|null;
};

export type SellerPaymentAccount={
 sellerId:string;
 provider:"stripe";
 onboardingStatus:"not_started"|"pending"|"restricted"|"complete";
 transfersEnabled:boolean;
 payoutsEnabled:boolean;
 detailsSubmitted:boolean;
};

export type OrderTimelineEvent={
 id:string;
 orderId:string;
 orderItemId:string|null;
 eventType:string;
 fromStatus:string|null;
 toStatus:string|null;
 actorProfileId:string|null;
 createdAt:string;
};

export type ShippingAddress={
 line1:string|null;
 line2:string|null;
 city:string|null;
 state:string|null;
 postalCode:string|null;
 country:string|null;
};

export type BuyerOrderItem={
 id:string;
 partTitle:string;
 partSlug:string;
 sellerName:string;
 sellerSlug:string;
 quantity:number;
 unitPricePence:number;
 shippingPence:number;
 deliveryMethod:"shipping"|"collection";
 fulfilmentStatus:string;
 payoutStatus:string;
 trackingCarrier:string|null;
 trackingNumber:string|null;
 buyerReceivedAt:string|null;
 releaseEligibleAt:string|null;
 fundsReleasedAt:string|null;
};

export type BuyerOrder={
 id:string;
 status:string;
 paymentStatus:string;
 totalPence:number;
 currency:string;
 createdAt:string;
 items:BuyerOrderItem[];
};

export type SellerSale={
 orderItemId:string;
 orderId:string;
 partTitle:string;
 partSlug:string;
 quantity:number;
 unitPricePence:number;
 shippingPence:number;
 platformFeePence:number;
 sellerNetPence:number;
 deliveryMethod:"shipping"|"collection";
 fulfilmentStatus:string;
 payoutStatus:string;
 trackingCarrier:string|null;
 trackingNumber:string|null;
 releaseEligibleAt:string|null;
 fundsReleasedAt:string|null;
 orderStatus:string;
 paymentStatus:string;
 orderCreatedAt:string;
 shippingName:string|null;
 shippingAddress:ShippingAddress|null;
};

export type ActionState={status:"idle"|"success"|"error";message?:string;fieldErrors?:Record<string,string>};
export type ListingActionState=ActionState&{recovery?:{partId:string|null}};
