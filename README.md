# progress-image-server

Dotpaper image API for ADHD-friendly focus wallpapers.

This service generates PNG progress wallpapers based on URL query parameters.  
It is deployed with **EdgeOne Pages Node Functions**.

## Endpoints

- `/`  
  Returns a simple usage page.
- `/dotpaper`  
  Returns a usage page when no query is provided.
- `/dotpaper?...`  
  Returns a PNG image for the requested mode.

## Supported Modes

- `viewType=today`
- `viewType=month`
- `viewType=year&unit=day|week|month`
- `viewType=range&startDate=YYYYMMDD&endDate=YYYYMMDD`
- `viewType=birthday&birthDate=YYYYMMDD&targetAge=60..120`

## Project Structure

- `lib/progress-image.js`: core image generation logic
- `node-functions/index.js`: root usage handler
- `node-functions/dotpaper.js`: image API handler
- `edgeone.json`: EdgeOne Pages runtime config

## Local Run

```bash
npm ci
npm run dev
```

