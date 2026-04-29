export const marketplace = {
  title: "Marketplace",
  search: "Search templates...",
  featured: "Featured",
  popular: "Popular",
  recent: "Recent",
  install: "Install",
  installed: "Installed",
  preview: "Preview",
  author: "Author",
  category: "Category",
  rating: "Rating",
  reviews: "Reviews",
  free: "Free",
  premium: "Premium",
} as const;

export type MarketplaceMessages = typeof marketplace;
