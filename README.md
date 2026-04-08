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
- `/api`  
  Returns a simple usage page.
- `/api/dotpaper?...`  
  API alias route for EdgeOne function namespace.
- `/health` or `/api/health`  
  Health check route, should return `ok`.

## Supported Modes

- `viewType=today`
- `viewType=month`
- `viewType=year&unit=day|week|month`
- `viewType=range&startDate=YYYYMMDD&endDate=YYYYMMDD`
- `viewType=birthday&birthDate=YYYYMMDD&targetAge=60..120`

## Project Structure

- `lib/progress-image.js`: core image generation logic
- `functions/index.js`: usage handler (`/`)
- `functions/dotpaper.js`: image API (`/dotpaper`)
- `functions/api/index.js`: usage alias (`/api`)
- `functions/api/dotpaper.js`: image API alias (`/api/dotpaper`)
- `node-functions/*`: compatibility mirror for runtimes that still detect this directory name
- `edgeone.json`: EdgeOne Pages runtime config

## Local Run

```bash
npm ci
npm run dev
```
