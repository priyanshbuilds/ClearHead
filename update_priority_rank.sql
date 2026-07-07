-- 1. Update existing data to match the new enum value
UPDATE dump_items 
SET priority_rank = 'no_rush' 
WHERE priority_rank = 'optional';

-- 2. Drop the old constraint (you may need to change the constraint name if it is different)
ALTER TABLE dump_items DROP CONSTRAINT IF EXISTS dump_items_priority_rank_check;

-- 3. Add the new constraint with the updated allowed values
ALTER TABLE dump_items ADD CONSTRAINT dump_items_priority_rank_check 
CHECK (priority_rank IN ('priority', 'easy_win', 'no_rush'));
