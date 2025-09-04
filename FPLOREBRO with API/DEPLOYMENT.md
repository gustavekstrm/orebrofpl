# 🚀 FPL Örebro Deployment Guide

## 📋 Overview

This guide explains how to deploy the FPL Örebro website with full API integration.

## 🔧 Local Development vs Production

### Local Development (Current)

- **API Calls:** Disabled due to CORS restrictions
- **Data Source:** Mock data for testing
- **Indicator:** "📊 Mock Data (Local Dev)"

### Production Deployment

- **API Calls:** Enabled for real FPL data
- **Data Source:** Live FPL API integration
- **Indicator:** "🌐 Live FPL Data"

## 🚀 Deployment Steps

### 1. Enable API Mode

Before deploying to a proper server, run:

```bash
node deploy.js
```

This will:

- Enable FPL API integration
- Set `DISABLE_API_CALLS = false`
- Allow real-time data fetching

### 2. Deploy to Server

Deploy the files to your web server (GitHub Pages, Netlify, Vercel, etc.)

### 3. Verify API Integration

- Check data source indicator shows "🌐 Live FPL Data"
- Verify all 51 participants load real FPL data
- Confirm highlights and roasts use live data

## 🛠️ Local Development

To switch back to local development mode:

```bash
node local-dev.js
```

This will:

- Disable API calls to avoid CORS issues
- Use mock data for testing
- Set `DISABLE_API_CALLS = true`

## 📊 API Integration Features

When deployed with API enabled:

- **51 Participants:** All with real FPL IDs
- **Live Points:** Current season totals
- **Real Rankings:** Live league standings
- **Dynamic Highlights:** Based on actual performance
- **Smart Roasts:** Based on real transfer/captain activity
- **Gameweek Data:** Real-time scores and picks

## 🔍 Troubleshooting

### API Not Working

1. Check if deployed to proper server (not file://)
2. Verify FPL API is accessible
3. Check browser console for errors
4. Ensure all participants have valid FPL IDs

### CORS Errors

- Only occurs in local development
- Use `node local-dev.js` to disable API
- Deploy to proper server to enable API

### Testing API Integration

- **Local Testing:** Click the data source indicator to test API
- **API Test Button:** Shows helpful messages about current mode
- **Test Mode:** Run `node test-api.js` to temporarily enable API for testing
- **Console Logs:** Check browser console for detailed API test results

## 📝 Notes

- All 51 participants have been assigned real FPL IDs
- API integration preserves all existing features
- Admin panel functionality remains intact
- UI/UX unchanged - only data source changes
