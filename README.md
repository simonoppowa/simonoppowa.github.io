# Simon Oppowa — Portfolio

My personal developer portfolio: a single-page site presenting who I am, my
experience, education, and projects.

**Live site:** https://simonoppowa.github.io

## Tech

- Plain HTML, CSS, and a little vanilla JavaScript — no build step, no frameworks.
- Fonts: Inter, Space Grotesk, and Space Mono (via Google Fonts).
- Fully self-contained: all images and icons live in `assets/`.

## Features

- Responsive two-column layout (sidebar intro + scrolling content).
- Deep-blue theme with a cursor-follow spotlight.
- Scroll-reveal and entrance animations that respect `prefers-reduced-motion`.
- Light/dark app screenshots, project ratings, and download counts.

## Run locally

It's a static site — just open `index.html`, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Credits

Layout design inspired by the portfolio of
[Brittany Chiang](https://brittanychiang.com).
