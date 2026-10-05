// Keep multipart uploads below Vercel's 4.5 MB request ceiling, including overhead.
export const BULK_IMPORT_MAX_FILE_BYTES=4*1024*1024;
export const BULK_IMPORT_MAX_ROWS=5000;
