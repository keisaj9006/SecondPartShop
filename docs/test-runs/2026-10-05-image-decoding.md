# Image decoding validation — 5 October 2026

Baseline: `e10d998d2cafc6e2014478afd90e11ec0200db98`; branch `codex/image-decoding-validation`. No database/Storage writes or main/Production changes.

## P1: image signatures accepted corrupted content

The shared server validator accepted signature-only JPEG, PNG and WebP files and a truncated genuine JPEG. Four real-decoder tests failed before the repair. Listing photos and the seller image assistant used this validator before processing/storing content. A signature is not proof of a decodable image.

The validator now decodes the pixel stream with Sharp, failing on decoder warnings. Metadata checks alone are insufficient: a regression fixture preserves valid JPEG metadata while removing pixel data. The existing 5 MiB, MIME and signature checks remain. Input is an in-memory buffer, never a filesystem path or URL. Decoder failures return a controlled message without library internals. A 50 million pixel ceiling accommodates common 48 MP photos while bounding decompression; larger source photos must be resized. Sharp 0.35.4 was already installed by Next and is now an explicit pinned runtime dependency.

Independent review reproduced corrupt later frames of animated WebP bypassing first-page decoding. The repair now decodes all frames; stacked dimensions apply the 50M bound to the entire animation, preserving valid animations. Eleven real-decoder tests cover all supported formats, misleading filenames, empty files, MIME mismatch, signature-only files, truncated metadata/pixels, a tiny PNG declaring 2.5 billion pixels with a correct IHDR checksum, and valid/corrupt later WebP frames.

Web and mobile case-evidence uploads previously checked only MIME/size. Two action/route RED tests reproduced success and writes for corrupt content; both now pass using the actual decoder. Web preflights the whole selection sequentially before any Storage write, so a corrupt second file does not partially upload the first. Mobile keeps existing auth, case ownership/closed/count checks before decoding. Existing Storage RLS, evidence registration and durable orphan cleanup are unchanged. Cleanup/signed-URL test harnesses stub the new validator dependency; their separate real-decoder regressions do not.

All 29 focused decoding/evidence/cleanup/signed-URL tests pass. Before the additional evidence/frame repairs the full suite passed 729 tests, lint had zero errors/four existing warnings, typecheck/build passed and production dependency audit found zero vulnerabilities. Final full CI, independent follow-up review and exact Preview remain required before merge. This evidence does not prove authenticated Storage uploads, physical camera/gallery behaviour, all file polyglots or every native decoder vulnerability.
