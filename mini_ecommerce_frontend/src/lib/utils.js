import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Injects Cloudinary transformation params into a Cloudinary image URL.
 * Non-Cloudinary URLs are returned unchanged.
 *
 * @param {string|null} url   - Original image URL
 * @param {string} transforms - Cloudinary transformation string, e.g. "f_auto,q_auto,w_800"
 */
export function cldUrl(url, transforms) {
  if (!url || !url.includes('res.cloudinary.com')) return url
  // Insert transforms between "/upload/" and the rest of the path
  return url.replace('/upload/', `/upload/${transforms}/`)
}
