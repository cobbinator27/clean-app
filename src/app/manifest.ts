import type { MetadataRoute } from 'next'

// Without a manifest, "Add to Home Screen" pins whatever URL happened to be open
// at the time — which is why Julie's icon can land on Schedule and she never sees
// the missed cleans on Home. start_url makes the icon always open Home.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'clean. Business Manager',
    short_name: 'clean.',
    description: "Today's cleans, missed cleans, and payments due.",
    start_url: '/dashboard/home',
    scope: '/',
    display: 'standalone',
    background_color: '#F9FAFB',
    theme_color: '#2C5F8A',
    icons: [
      {
        src: '/photos/stock/clean._logo.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
