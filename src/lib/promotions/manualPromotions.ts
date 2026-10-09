import type { Promotion } from "./types";

/**
 * MANUAL promotions — personally selected brands/products (spec §3).
 * Allowed placements ONLY: home, library-albums, library-artists,
 * library-playlists, folder. Anything else is dropped by the renderer.
 *
 * To add one, copy the template below, paste YOUR Involve Asia tracking link
 * into `trackingUrl`, set `enabled: true`, and choose a `placement`.
 * The Udemy entry is the spec's example — it ships DISABLED because the real
 * tracking URL and banner come from your Involve Asia dashboard.
 */
export const MANUAL_PROMOTIONS: Promotion[] = [
  //* Home Page Promotions */
  {
    id: "udemy-us-cps",
    source: "manual",
    type: "course",
    brandName: "Udemy",
    title: "Udemy Courses Starting at $9.99",
    description: "Sponsored offer",
    imageUrl: "https://img.involve.asia/ia_logo/4142_A25vvSQ2.png", // e.g. a banner/logo URL from Involve Asia
    trackingUrl: "https://invl.me/clo1pp8", // your affiliate tracking link
    destinationUrl: "https://www.udemy.com/",
    enabled: true,
    priority: 1,
    placement: "home",
  },
  {
    id: "capcut-cpi-cps",
    source: "manual",
    type: "service",
    brandName: "CapCut",
    title: "CapCut - Subscribe now and get 7 days of free Pro",
    description: "Sponsored offer",
    imageUrl: "https://img.involve.asia/ia_logo/4981_cSeZlR4l.png",
    trackingUrl: "https://invl.me/clo1pp8",
    destinationUrl: "https://www.capcut.com/activities/subscribe",
    enabled: true,
    priority: 1,
    placement: "home",
  },
  {
    id: "wps-office-cpi-cps",
    source: "manual",
    type: "service",
    brandName: "WPS Office",
    title: "WPS Software - The New AI-Powered Office Suite",
    description: "Sponsored offer",
    imageUrl: "https://img.involve.asia/ia_logo/5104_dmxGmhwR.png",
    trackingUrl: "https://invl.app/clo2cnr",
    destinationUrl: "https://www.wps.com",
    enabled: true,
    priority: 1,
    placement: "home",
  },
  //* Library/Albums Page Promotions */
  {
    id: "binge-movies-tv",
    source: "manual",
    type: "service",
    brandName: "BINGE Networks",
    title: "BINGE Movies & TV - Discover Stories You Won’t Find Anywhere Else",
    description: "Sponsored offer",
    imageUrl: "https://img.involve.asia/ia_logo/5093_pQhOjyJZ.png",
    trackingUrl: "https://invl.us/clo2cph",
    destinationUrl: "https://trybinge.tv",
    enabled: true,
    priority: 1,
    placement: "library-albums",
  },
  {
    id: "lightpdf-cps",
    source: "manual",
    type: "service",
    brandName: "LightPDF",
    title: "LightPDF - AI-Powered PDF Simplify Every Step of Your Document Workflow",
    description: "Your all-in-one AI-powered PDF solution to edit, convert, annotate, sign, organize, chat, and more — available on Web, Mobile & Desktop. ",
    imageUrl: "https://img.involve.asia/ia_logo/5003_VnJg2MpW.jpg",
    trackingUrl: "https://invl.us/clo2glg",
    destinationUrl: "https://www.lightpdf.com",
    enabled: true,
    priority: 1,
    placement: "library-albums",
  },
  //* Library/Playlists Page Promotions */
  {
    id: "involve-asia-cpa",
    source: "manual",
    type: "service",
    brandName: "Involve Asia",
    title: "Involve Asia connects Advertisers with Affiliate Partners",
    description: "Sponsored offer",
    imageUrl: "https://img.involve.asia/ia_logo/798.png",
    trackingUrl: "https://invl.me/clo2crh",
    destinationUrl: "https://app.involve.asia/v2/create-account",
    enabled: true,
    priority: 2,
    placement: "library-playlists",
  },
  //* Library/Artists Page Promotions */
  {
    id: "shein-global-campaign",
    source: "manual",
    type: "campaign",
    brandName: "SHEIN Group",
    title: "SHEIN Global - Up to 60% Promo - Exclusive Discount Landing Page",
    description: "Exclusive Offer for New Customers - Up to 60% Discount - Free Shipping - Free Returns *T&C Apply",
    imageUrl: "https://img.involve.asia/ia_logo/ia_tmb/4808_ifQI39tI.jpg",
    trackingUrl: "https://miniurl.app/clo2gjo",
    destinationUrl: "https://onelink.shein.com/15/4wh5j6ktxgqy",
    enabled: true,
    priority: 1,
    placement: "library-artists",
  },
  //* Library/Folder Page Promotions */
  {
    id: "airwallex-cpa",
    source: "manual",
    type: "service",
    brandName: "Airwallex",
    title: "Airwallex - Agentic business accounts that move at the speed of your growth",
    description: "Sponsored offer",
    imageUrl: "https://img.involve.asia/ia_logo/5080_fM9inkGl.png",
    trackingUrl: "https://invl.us/clo2gi6",
    destinationUrl: "https://www.airwallex.com/business-account",
    enabled: true,
    priority: 1,
    placement: "folder",
  },
];
