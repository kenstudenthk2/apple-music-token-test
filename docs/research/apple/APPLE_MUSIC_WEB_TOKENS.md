> **How this was produced, and what it is not.**
>
> Extracted from `music.apple.com/us/browse` with `dembrandt --dark-mode` on
> 2026-08-19. Two caveats that matter before anyone builds from it:
>
> 1. **This is the WEB client, not tvOS.** Apple Music on Apple TV is a native
>    app and cannot be scraped. The two share a design language and a brand
>    colour; they do not share a layout. For the television behaviour see
>    `APPLE_TV_MUSIC_UX.md`.
> 2. **The `--dark-mode` flag did not take on this site** — the captured
>    background is white. The palette below is the light theme. Use the colours
>    as brand reference, not as a dark-theme specification.
>
> The one value worth taking directly is Apple Music's brand red, **#D60017**.

---
name: "‎Apple Music"
description: "Design tokens extracted from https://music.apple.com/us/new"
colors:
  primary: "#D60017"
  secondary: "#FFFFFF"
  surface: "#FA586A"
  on-surface: "#282828"
typography:
  text-1:
    fontFamily: "-apple-system"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.18
  text-2:
    fontFamily: "-apple-system"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.23
  text-3:
    fontFamily: "-apple-system"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.29
  text-4:
    fontFamily: "-apple-system"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.29
  text-5:
    fontFamily: "-apple-system"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.29
  text-6:
    fontFamily: "-apple-system"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.29
  text-7:
    fontFamily: "-apple-system"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.29
  text-8:
    fontFamily: "-apple-system"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.33
  text-9:
    fontFamily: "-apple-system"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.33
  text-10:
    fontFamily: "-apple-system"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  text-11:
    fontFamily: "-apple-system"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 0
  text-12:
    fontFamily: "-apple-system"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.23
  text-13:
    fontFamily: "-apple-system"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.23
  text-14:
    fontFamily: "-apple-system"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 0
  text-15:
    fontFamily: "-apple-system"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.18
  text-16:
    fontFamily: "-apple-system"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.25
  text-17:
    fontFamily: "-apple-system"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.25
  text-18:
    fontFamily: "-apple-system"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.27
  text-19:
    fontFamily: "-apple-system"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.27
  text-20:
    fontFamily: "-apple-system"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.27
  text-21:
    fontFamily: "-apple-system"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.27
spacing:
  base: "8px"
  xs: "1px"
  sm: "2px"
  md: "3px"
  lg: "4px"
  xl: "6px"
  xxl: "7.5px"
  xxxl: "8px"
  xxxxl: "10px"
rounded:
  sm: "3px"
  md: "4px"
  lg: "5px"
  xl: "7px"
  full: "9999px"
components:
  button-observed:
    backgroundColor: "{colors.secondary}"
    textColor: "#000000"
    rounded: "{rounded.md}"
    padding: "8px 16px"
---

# Design System

## Overview
Design tokens extracted from music.apple.com. The YAML front matter contains machine-readable values observed by Dembrandt when available; the sections below summarize the extracted evidence without redesigning or correcting the source site.

## Colors
- **Primary** (#D60017): Observed color token extracted from the site's palette, semantic CSS, or component styles.
- **Secondary** (#FFFFFF): Observed color token extracted from the site's palette, semantic CSS, or component styles.
- **Surface** (#FA586A): Observed color token extracted from the site's palette, semantic CSS, or component styles.
- **On Surface** (#282828): Observed color token extracted from the site's palette, semantic CSS, or component styles.

## Typography
- **Text 1**: -apple-system, 34px, bold
- **Text 2**: -apple-system, 26px, bold
- **Text 3**: -apple-system, 17px, regular
- **Text 4**: -apple-system, 17px, regular
- **Text 5**: -apple-system, 17px, bold
- **Text 6**: -apple-system, 17px, bold
- **Font URLs**: https://music.apple.com/assets/fonts/locale-switcher/AppleSDGothicNeo-Regular-subset.woff2, https://music.apple.com/assets/fonts/locale-switcher/ArabicUIText-Regular-subset.woff2, https://music.apple.com/assets/fonts/locale-switcher/ArialHebrew-subset.woff2, https://music.apple.com/assets/fonts/locale-switcher/HiraginoSans-W4-subset.woff2, https://music.apple.com/assets/fonts/locale-switcher/KohinoorDevanagari-Regular-subset.woff2, https://music.apple.com/assets/fonts/locale-switcher/PingFangHK-Regular-subset.woff2, https://music.apple.com/assets/fonts/locale-switcher/PingFangSC-Regular-subset.woff2, https://music.apple.com/assets/fonts/locale-switcher/PingFangTC-Regular-subset.woff2, https://music.apple.com/assets/fonts/locale-switcher/ThonburiPro-Regular-subset.woff2

## Layout
Observed spacing scale: 8px spacing scale.
- **Spacing tokens**: base 8px, xs 1px, sm 2px, md 3px, lg 4px, xl 6px, xxl 7.5px, xxxl 8px, xxxxl 10px
- **Responsive breakpoints**: 32px, 320px, 400px, 414px, 415px, 480px

## Elevation & Depth
Observed box-shadow styles: rgba(0, 0, 0, 0.01) 0px 1px 1px 0px, rgba(0, 0, 0, 0.01) 0px 2px 2px 0px, rgba(0, 0, 0, 0.02) 0px 4px 4px 0px, rgba(0, 0, 0, 0.03) 0px 8px 8px 0px, rgba(0, 0, 0, 0.03) 0px 14px 14px 0px; rgba(0, 0, 0, 0.1) 0px 10px 40px 0px; rgba(0, 0, 0, 0.05) 0px 1px 0px 0px, rgba(0, 0, 0, 0.07) 0px 1px 3px 0px

## Shapes
Observed rounded-corner tokens: sm 3px, md 4px, lg 5px, xl 7px, full 9999px.

## Components
- **Buttons**: Observed sample with radius 4px, background #FFFFFF, text #000000, padding 8px 16px
