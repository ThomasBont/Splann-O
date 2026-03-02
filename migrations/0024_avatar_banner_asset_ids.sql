ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_asset_id text;
ALTER TABLE barbecues ADD COLUMN IF NOT EXISTS banner_asset_id text;

-- Move legacy non-http avatar values into avatar_asset_id.
UPDATE users
SET
  avatar_asset_id = COALESCE(
    avatar_asset_id,
    NULLIF(regexp_replace(COALESCE(avatar_url, ''), '^.*/', ''), ''),
    NULLIF(regexp_replace(COALESCE(profile_image_url, ''), '^.*/', ''), '')
  ),
  avatar_url = CASE
    WHEN avatar_url IS NOT NULL AND avatar_url !~* '^https?://' THEN NULL
    ELSE avatar_url
  END,
  profile_image_url = CASE
    WHEN profile_image_url IS NOT NULL AND profile_image_url !~* '^https?://' THEN NULL
    ELSE profile_image_url
  END
WHERE
  (avatar_url IS NOT NULL AND avatar_url !~* '^https?://')
  OR (profile_image_url IS NOT NULL AND profile_image_url !~* '^https?://');

-- Move legacy non-http banner values into banner_asset_id.
UPDATE barbecues
SET
  banner_asset_id = COALESCE(
    banner_asset_id,
    NULLIF(regexp_replace(COALESCE(banner_image_url, ''), '^.*/', ''), '')
  ),
  banner_image_url = CASE
    WHEN banner_image_url IS NOT NULL AND banner_image_url !~* '^https?://' THEN NULL
    ELSE banner_image_url
  END
WHERE banner_image_url IS NOT NULL AND banner_image_url !~* '^https?://';
