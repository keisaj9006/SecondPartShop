export type CsvRow=Record<string,string>;

export type ParsedCsv={
 headers:string[];
 rows:CsvRow[];
 error:string|null;
};

export function parseCsv(text:string):ParsedCsv{
 const matrix:string[][]=[];
 let row:string[]=[];
 let cell="";
 let quoted=false;

 for(let i=0;i<text.length;i+=1){
  const char=text[i];
  if(quoted){
   if(char==='"'&&text[i+1]==='"'){cell+='"';i+=1;continue;}
   if(char==='"'){quoted=false;continue;}
   cell+=char;
   continue;
  }
  if(char==='"'){quoted=true;continue;}
  if(char===","){row.push(cell);cell="";continue;}
  if(char==="\n"){row.push(cell);matrix.push(row);row=[];cell="";continue;}
  if(char==="\r")continue;
  cell+=char;
 }

 if(quoted)return {headers:[],rows:[],error:"The CSV contains an unclosed quoted field."};

 row.push(cell);
 if(row.some(value=>value.length>0))matrix.push(row);
 if(!matrix.length)return {headers:[],rows:[],error:null};

 const headers=matrix[0].map(value=>value.replace(/^\uFEFF/,"").trim().toLowerCase());
 if(headers.some(header=>!header))return {headers:[],rows:[],error:"Every CSV column must have a header."};

 const duplicates=[...new Set(headers.filter((header,index)=>headers.indexOf(header)!==index))];
 if(duplicates.length)return {headers:[],rows:[],error:"Duplicate CSV columns: "+duplicates.join(", ")+"."};

 const rows=matrix.slice(1)
  .filter(values=>values.some(value=>value.trim().length>0))
  .map(values=>Object.fromEntries(headers.map((header,index)=>[header,(values[index]??"").trim()])));

 return {headers,rows,error:null};
}

export function csvBoolean(value:string,defaultValue=false){
 const normalized=value.trim().toLowerCase();
 if(!normalized)return defaultValue;
 if(["1","true","yes","y","on"].includes(normalized))return true;
 if(["0","false","no","n","off"].includes(normalized))return false;
 return null;
}
