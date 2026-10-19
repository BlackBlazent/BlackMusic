
import type { Promotion } from "./types";

/**
 * MANUAL promotions — personally selected brands/products.
 *
 * Allowed placements:
 * home, library-albums, library-artists,
 * library-playlists, folder, online-hero.
 *
 * Marketing principles:
 * - Lead with the product's primary value.
 * - Use clear, benefit-driven headlines.
 * - Keep descriptions concise and specific.
 * - Avoid unsupported claims and exaggerated promises.
 * - Preserve campaign tracking, destinations, and placement.
 */

export const MANUAL_PROMOTIONS: Promotion[] = [
  // Home Page Promotions
  {
    id: "udemy-us-cps",
    source: "manual",
    type: "course",
    brandName: "Udemy",
    title: "Learn Something New with Udemy",
    description:
      "Explore online courses to build practical skills, discover new interests, and advance your knowledge.",
    imageUrl: "https://img.involve.asia/ia_logo/4142_A25vvSQ2.png",
    trackingUrl: "https://invl.me/clo1pp8",
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
    title: "Bring Your Creative Ideas to Life with CapCut",
    description:
      "Edit videos, create engaging content, and explore creative tools. Check out CapCut Pro and its available subscription offers.",
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
    title: "Work Smarter with WPS Office",
    description:
      "Explore an AI-powered office suite for creating, editing, and managing documents, spreadsheets, and presentations.",
    imageUrl: "https://img.involve.asia/ia_logo/5104_dmxGmhwR.png",
    trackingUrl: "https://invl.app/clo2cnr",
    destinationUrl: "https://www.wps.com",
    enabled: true,
    priority: 1,
    placement: "home",
  },

  // Library / Albums Page Promotions
  {
    id: "binge-movies-tv",
    source: "manual",
    type: "service",
    brandName: "BINGE Networks",
    title: "Discover Your Next Favorite Story",
    description:
      "Explore movies and TV entertainment with BINGE. Discover its collection and find something new to watch.",
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
    title: "Simplify Your PDF Workflow with AI",
    description:
      "Edit, convert, annotate, sign, organize, and chat with PDFs using LightPDF's document tools across web, mobile, and desktop.",
    imageUrl: "https://img.involve.asia/ia_logo/5003_VnJg2MpW.jpg",
    trackingUrl: "https://invl.us/clo2glg",
    destinationUrl: "https://www.lightpdf.com",
    enabled: true,
    priority: 1,
    placement: "library-albums",
  },

  // Library / Playlists Page Promotions
  {
    id: "involve-asia-cpa",
    source: "manual",
    type: "service",
    brandName: "Involve Asia",
    title: "Turn Your Audience into Affiliate Opportunities",
    description:
      "Explore affiliate marketing opportunities connecting advertisers with publishers and content creators through Involve Asia.",
    imageUrl: "https://img.involve.asia/ia_logo/798.png",
    trackingUrl: "https://invl.me/clo2crh",
    destinationUrl: "https://app.involve.asia/v2/create-account",
    enabled: true,
    priority: 2,
    placement: "library-playlists",
  },

  // Library / Artists Page Promotions
  {
    id: "shein-global-campaign",
    source: "manual",
    type: "campaign",
    brandName: "SHEIN Group",
    title: "Explore SHEIN's Latest Styles and Offers",
    description:
      "Discover fashion and browse current promotions. Eligible new customers may find discounts of up to 60%, subject to availability and terms.",
    imageUrl: "https://img.involve.asia/ia_logo/ia_tmb/4808_ifQI39tI.jpg",
    trackingUrl: "https://miniurl.app/clo2gjo",
    destinationUrl: "https://onelink.shein.com/15/4wh5j6ktxgqy",
    enabled: true,
    priority: 1,
    placement: "library-artists",
  },

  // Library / Folder Page Promotions
  {
    id: "airwallex-cpa",
    source: "manual",
    type: "service",
    brandName: "Airwallex",
    title: "Build Your Business on a Global Scale",
    description:
      "Explore business financial tools designed to help companies manage payments and international operations.",
    imageUrl: "https://img.involve.asia/ia_logo/5080_fM9inkGl.png",
    trackingUrl: "https://invl.us/clo2gi6",
    destinationUrl: "https://www.airwallex.com/business-account",
    enabled: true,
    priority: 1,
    placement: "folder",
  },

  // Online Page Hero — Pepperstone
  {
    id: "online-hero-pepperstone",
    source: "manual",
    type: "campaign",
    brandName: "pepperstone",
    title: "Explore the Markets. Trade Your Strategy.",
    description:
      "Discover forex, indices, commodities, shares, and more with Pepperstone.",
    imageUrl: "https://img.involve.asia/ia_logo/4940_h2hfZGa5.jpg",
    trackingUrl: "https://invl.me/clo48t0",
    destinationUrl: "https://pepperstone.com",
    enabled: true,
    priority: 1,
    placement: "online-hero",
  },
];
