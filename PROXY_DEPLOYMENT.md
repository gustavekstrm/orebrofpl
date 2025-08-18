# 🚀 FPL API Proxy Deployment Guide

## 📋 Overview
This guide explains how to deploy the Cloudflare Worker proxy to handle CORS issues with the FPL API.

## 🔧 Prerequisites
1. **Cloudflare Account** (free tier works)
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Domain** (optional, but recommended)

## 🚀 Deployment Steps

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
```bash
wrangler login
```

### 3. Update Configuration
Edit `wrangler.toml`:
- Replace `your-domain.com` with your actual domain
- Update the worker name if needed

### 4. Deploy the Worker
```bash
wrangler deploy
```

### 5. Get Your Worker URL
After deployment, you'll get a URL like:
`https://fpl-proxy.your-username.workers.dev`

### 6. Update Frontend Configuration
In `script.js`, update:
```javascript
const FPL_PROXY_BASE = 'https://fpl-proxy.your-username.workers.dev/api';
```

## 🔍 Testing the Proxy

### Test Bootstrap Data
```bash
curl https://fpl-proxy.your-username.workers.dev/api/bootstrap-static/
```

### Test Player Data
```bash
curl https://fpl-proxy.your-username.workers.dev/api/entry/1490173/
```

### Test Gameweek Picks
```bash
curl https://fpl-proxy.your-username.workers.dev/api/entry/1490173/event/1/picks/
```

## ✅ Expected Results
- All requests should return JSON data
- CORS headers should be present
- No CORS errors in browser console

## 🛠️ Troubleshooting

### Worker Not Deploying
- Check your Cloudflare account permissions
- Verify wrangler is logged in correctly

### CORS Still Blocked
- Ensure the worker URL is correct in `script.js`
- Check that `USE_PROXY = true`

### API Errors
- Verify the FPL API endpoints are working
- Check worker logs in Cloudflare dashboard

## 📊 Benefits
- ✅ No more CORS errors
- ✅ Real-time FPL data
- ✅ Fast response times
- ✅ Automatic caching
- ✅ Free tier available

## 🔄 Alternative Solutions
If Cloudflare Workers doesn't work:
1. **Vercel Functions**
2. **Netlify Functions**
3. **Express.js server**
4. **Heroku backend**

Let me know if you need help with any of these alternatives!
