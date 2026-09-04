import Image from "next/image";
import { PartMark } from "./part-mark";
export function ProductImage({url,alt,code}:{url?:string;alt:string;code?:string|null}){if(!url)return <PartMark code={code}/>;return <div className="relative h-full min-h-48 overflow-hidden bg-[#e8ebe5]"><Image src={url} alt={alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover"/></div>}
