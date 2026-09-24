import { unzipSync } from "fflate";
import { mkdir, writeFile } from "node:fs/promises";

const DATA_URL="https://download.geonames.org/export/dump/RS.zip";
const ADMIN1_URL="https://download.geonames.org/export/dump/admin1CodesASCII.txt";
const ADMIN2_URL="https://download.geonames.org/export/dump/admin2Codes.txt";
const decoder=new TextDecoder("utf-8");
const [zipResponse,a1Response,a2Response]=await Promise.all([fetch(DATA_URL),fetch(ADMIN1_URL),fetch(ADMIN2_URL)]);
if(!zipResponse.ok||!a1Response.ok||!a2Response.ok)throw new Error("GeoNames download failed");
const archive=unzipSync(new Uint8Array(await zipResponse.arrayBuffer()));
const source=decoder.decode(archive["RS.txt"]);
const admin1=new Map((await a1Response.text()).split(/\r?\n/).filter(Boolean).map(line=>{const p=line.split("\t");return[p[0],p[1]]}));
const admin2=new Map((await a2Response.text()).split(/\r?\n/).filter(line=>line.startsWith("RS.")).map(line=>{const p=line.split("\t");return[p[0],p[1]]}));
const rows=source.split(/\r?\n/).filter(Boolean).map(line=>line.split("\t")).filter(p=>p[6]==="P").map(p=>({
  id:Number(p[0]),name:p[1],ascii_name:p[2]||null,
  municipality:admin2.get(`RS.${p[10]}.${p[11]}`)||null,district:admin1.get(`RS.${p[10]}`)||null,
  latitude:Number(p[4]),longitude:Number(p[5]),feature_code:p[7],population:Number(p[14]||0),
  source:"GeoNames",source_updated_at:p[18]||null,active:true,
  search_text:[p[1],p[2],admin2.get(`RS.${p[10]}.${p[11]}`),admin1.get(`RS.${p[10]}`)].filter(Boolean).join(" ").toLocaleLowerCase("sr")
})).sort((a,b)=>a.name.localeCompare(b.name,"sr"));
await mkdir("public/data",{recursive:true});
await writeFile("public/data/serbian-locations.json",JSON.stringify({source:DATA_URL,license:"CC BY 4.0",generated_at:new Date().toISOString(),count:rows.length,rows}));
console.log(`Generated ${rows.length} Serbian populated places.`);
