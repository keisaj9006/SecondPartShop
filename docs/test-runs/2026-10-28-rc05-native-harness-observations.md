# RC-05 native harness and lifecycle observations

This is a transcription of actual command outputs observed in the Codex session, not an automatically captured execution log. The replay JSON files contain the runner's captured catalog. `sourceCommit` identifies the commit containing the SQL and runner used by both runs; the historical base is `2ef017a67dab93fd3b80d3ab51ebc11b224e6ce6`.

| Check | A-final | B-final |
|---|---|---|
| Independent local project ID | `secondpart-rc05-native-a-final2` | `secondpart-rc05-native-b-final2` |
| Runner | `PASS`, 207/207 | `PASS`, 207/207 |
| Native harness after candidate | function 1, triggers 2, notifications 4, anon EXECUTE false, authenticated EXECUTE false | same |
| Transaction rollback | function 0, triggers 0, fixture notifications 0 | same |
| Committed apply/remove rehearsal | function 0, triggers 0 | same |
| `supabase stop --no-backup` | success, backup false | success, backup false |
| Matching containers and volumes after stop | none listed | none listed |

The harness exited 0 under `psql -v ON_ERROR_STOP=1` on each run. Its assertions include unpaid/refunded/cancelled/missing funds release/active case/already eligible negatives, case-closure positive, buyer and seller RPC visibility, outsider isolation, owner/ACL and dedupe. This transcription does not include container IDs or raw HTTP probe responses. The runner's `authHealth` and `storageHealth` provenance values are operator-supplied HTTP status observations, not independent validation performed inside the runner.

Replay B was started only after A's `stop --no-backup` and matching Docker container/volume listing returned empty. The two distinct project IDs, timestamps and hashes in the JSON evidence are the primary machine-readable provenance. A future release gate should capture service probes, Docker identities and teardown into a dedicated generated lifecycle artifact.
