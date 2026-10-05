// Leave room for form fields, multipart framing and bounded action state below 4.5 MB.
export const MAX_MULTIPART_FILE_BYTES=4*1024*1024;

export function multipartFileBudgetError(files:ReadonlyArray<{size:number}>):string|null{
 const total=files.reduce((bytes,file)=>bytes+file.size,0);
 return total>MAX_MULTIPART_FILE_BYTES
  ?"Selected photos must total 4 MiB or less after preparation. Choose fewer or smaller photos and upload additional photos separately."
  :null;
}
