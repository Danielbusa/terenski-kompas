import {createClient} from "@supabase/supabase-js";
const batchSize=400;
export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!url||!key||!token)return Response.json({error:"Unauthorized"},{status:401});
 const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
 const{data:{user}}=await client.auth.getUser(token);if(!user)return Response.json({error:"Unauthorized"},{status:401});
 const{data:profile}=await client.from("profiles").select("role").eq("id",user.id).single();if(profile?.role!=="admin")return Response.json({error:"Admin access required"},{status:403});
 const dataUrl=new URL("/data/serbian-locations.json",request.url);const sourceResponse=await fetch(dataUrl);if(!sourceResponse.ok)return Response.json({error:"Location dataset is unavailable"},{status:503});
 const dataset=await sourceResponse.json() as {rows:Record<string,unknown>[];count:number};let imported=0;
 for(let i=0;i<dataset.rows.length;i+=batchSize){const{error}=await client.from("serbian_locations").upsert(dataset.rows.slice(i,i+batchSize),{onConflict:"id"});if(error)return Response.json({error:error.message,imported},{status:400});imported+=Math.min(batchSize,dataset.rows.length-i)}
 return Response.json({imported,source:"GeoNames"});
}
