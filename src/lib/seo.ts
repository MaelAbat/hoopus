/**
 * Default Open Graph / Twitter card image.
 *
 * Points at the root `opengraph-image.tsx` route. Next.js only auto-attaches
 * that file-based image to pages that DON'T declare their own `openGraph`
 * block — so any page that sets `openGraph` must reference this explicitly,
 * or its social preview ships without an image. Resolved against
 * `metadataBase`, so the relative path becomes an absolute URL.
 */
export const OG_IMAGE = "/opengraph-image";
