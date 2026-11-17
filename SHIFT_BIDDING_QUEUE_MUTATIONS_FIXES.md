# Shift Bidding Queue Mutation Fixes

**Date:** 2026-11-17
**Issues:** Non-deterministic sorting, add/remove operations break the bidding process

---

## Fixed Issues

### 1. Non-Deterministic Sorting in `sortOfficersConsistently`
**File:** `src/utils/sortingUtils.ts`

**Problem:** When two officers have the same service credit AND badge number, their relative order would shuffle unpredictably between add/remove operations because there was no `id` tiebreaker.

**Fix:** Added `id` as the final tiebreaker after last name comparison:
```typescript
// Finally by ID (ASCENDING) to ensure absolute determinism
const aId = a.id || "";
const bId = b.id || "";
return aId.localeCompare(bId);
```

This ensures that as long as officers have the same service credit and badge number, their order remains stable.

---

## Identified Issues in Queue Mutations

### 2. Remove Officer from Queue - Race Conditions
**File:** `src/hooks/useShiftBidding.ts` (lines 523-577)

**Problems:**

1. **Step-by-step updates with no transaction** (lines 540-554):
   - Fetches remaining officers
   - Updates each officer's `turn_index` individually
   - Then updates `current_turn_index` separately

2. **Race condition window:**
   - Multiple simultaneous mutations could corrupt the queue
   - If an officer's turn_index update fails but the round's `current_turn_index` succeeds, the round's active index is now incorrect

3. **Inefficient SQL**:
   - Multiple individual `UPDATE` operations instead of a single atomic update

**Recommended Fix:**
```typescript
// Instead of step-by-step updates, do it in one transaction
const { error: updateError } = await supabase.rpc("update_queue_after_removal", {
  round_id: roundId,
  removed_queue_item_id: queueItemId
});
if (updateError) throw updateError;
```

---

### 3. Add Officer to Queue - Improper Duplicate Check
**File:** `src/hooks/useShiftBidding.ts` (lines 579-695)

**Problems:**

1. **Check-then-delete race condition** (lines 581-659):
   ```typescript
   // Check for duplicate
   const { existing } = await supabase.from("shift_bidding_queue")
     .select("id")
     .eq("round_id", roundId)
     .eq("officer_id", officerId)
     .single();

   if (existing) throw new Error("Officer already in queue");

   // ... later ...
   // Clear entire queue for this round
   await supabase.from("shift_bidding_queue")
     .delete()
     .eq("round_id", roundId);

   // Insert all officers
   await supabase.from("shift_bidding_queue")
     .insert(newQueueItems);
   ```

2. **The race condition window:**
   - Between the duplicate check and the delete, another person could add the same officer
   - Between the delete and insert, another person could modify the queue

3. **Complex single-row updates are inefficient:**
   - Fetches all current queue items
   - Fetches profiles for each item
   - Calculates service credits with async RPC calls
   - Clears the entire queue
   - Inserts all new items

**Recommended Fix:**
```typescript
// Atomic insert that ignores duplicates completely
const { error: insertError } = await supabase.from("shift_bidding_queue")
  .insert(newQueueItems, { onConflict: 'round_id,officer_id' });

// Or use a SQL transaction with proper error handling
await supabase.rpc("add_officer_to_round_queue", {
  round_id: roundId,
  officer_id: officerId
});
```

---

## Additional Concerns

### 4. Submit Selection - Incomplete Cache Invalidation
**File:** `src/hooks/useShiftBidding.ts` (lines 280-400s)

The `submitSelection` mutation updates:
- Queue item status (line 336)
- Officer profile's `shift_type_id` (line 346)
- No explicit invalidation callback documents this

This means the officer's ride list might not refresh until the next page reload. Consider adding:
```typescript
queryClient.invalidateQueries({ queryKey: ["officer-schedules"] });
queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
```

---

## Testing Checklist

- [ ] Add officer → verify queue order stable across multiple operations
- [ ] Remove officer → verify queue re-indexes correctly
- [ ] Add officer while round is active → verify no duplicate still created
- [ ] Remove officer while round is active → verify next officer becomes active correctly
- [ ] Submit selection → verify officer's ride list updates immediately
- [ ] Multiple admins add/remove simultaneously → verify no queue corruption

---

## Implementation Priority

1. **High:** Add `officer_id` as final tiebreaker (DONE)
2. **Medium:** Improve error handling in `removeOfficerFromQueue` (atomic updates)
3. **Medium:** Fix race condition in `addOfficerToQueue` (use SQL RPC or transaction)
4. **Low:** Add missing cache invalidations in `submitSelection`

---

## Performance Notes

The current implementation of `addOfficerToQueue` (lines 620-633) makes async RPC calls for each item's service credit:
```typescript
const allQueueProfiles = await Promise.all(
  (currentQueue || []).map(async (item) => {
    const prof = item.profiles;
    if (!prof) return null;
    const { scData } = await supabase.rpc("get_service_credit", {
      profile_id: prof.id,
    });
    return { ...prof, service_credit: scData };
  })
);
```

This optimizes to N+1 cloud queries. Consider fetching all service credits in a single batch RPC call.