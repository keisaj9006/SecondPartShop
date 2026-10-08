// No shared Supabase target is permitted, even through libpq query overrides.
export function requireIsolatedDeletionTarget(value){
 let target;try{target=new URL(value);}catch{throw new Error('Explicit isolated disposable database URL required.');}
 if(!['postgres:','postgresql:'].includes(target.protocol)||
  !['127.0.0.1','localhost'].includes(target.hostname)||
  target.pathname!=='/secondpart_deletion_rc'||target.search||target.hash){
  throw new Error('Explicit isolated localhost secondpart_deletion_rc database required.');
 }
 return value;
}
// Generated evidence cannot be pasted into the shared project's postgres DB.
export const isolatedDeletionSqlGuard=`do $isolation$ begin
 if current_database()<>'secondpart_deletion_rc'
    or current_setting('server_version_num')::integer not between 170000 and 179999 then
  raise exception 'Isolated disposable PostgreSQL 17 database required';
 end if;
end $isolation$;`;
