-- Migration: Clear MAP VERIFIED on Coordinate Change
-- This trigger ensures that whenever LAT or LONG is updated, 
-- the MAP VERIFIED status is cleared UNLESS the update itself 
-- provides a NEW verification string.

CREATE OR REPLACE FUNCTION clear_map_verified_on_coord_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if LAT or LONG has changed
    IF (NEW."LAT" IS DISTINCT FROM OLD."LAT" OR NEW."LONG" IS DISTINCT FROM OLD."LONG") THEN
        -- ONLY clear it if the user ISN'T explicitly sending a NEW verification string in this same update
        -- (This allows the user to both change coordinates AND verify in a single 'Save' click)
        IF (NEW."MAP VERIFIED" IS NOT DISTINCT FROM OLD."MAP VERIFIED") THEN
            NEW."MAP VERIFIED" = NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the 'KIU Properties' table
DROP TRIGGER IF EXISTS trigger_clear_map_verified ON "KIU Properties";
CREATE TRIGGER trigger_clear_map_verified
BEFORE UPDATE ON "KIU Properties"
FOR EACH ROW
EXECUTE FUNCTION clear_map_verified_on_coord_change();

COMMENT ON FUNCTION clear_map_verified_on_coord_change() IS 'Automatically clears the MAP VERIFIED column when LAT/LONG coordinates change, unless a new verification is provided.';
