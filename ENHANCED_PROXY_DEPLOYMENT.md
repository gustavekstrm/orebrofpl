# Enhanced FPL Proxy Deployment Guide

## 🚀 Overview

This enhanced proxy provides:

- **Server-side caching** with stale-if-error fallback
- **Upstream queue management** to prevent rate limiting
- **Aggregate endpoints** for batch data fetching
- **Health monitoring** and metrics
- **Express 5 compatibility** with security middleware

## 📋 Prerequisites

- Render account (free tier works)
- Node.js 18+ environment
- Git repository access

## 🔧 Deployment Steps

### 1. Create New Render Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your Git repository
4. Configure the service:

**Basic Settings:**

- **Name**: `orebrofpl-proxy-enhanced`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free (or paid for better performance)

### 2. Environment Variables

Add these environment variables in Render dashboard:

```bash
# Core Configuration
FPL_API_BASE=https://fantasy.premierleague.com/api/
ALLOWED_ORIGINS=https://gustavekstrm.github.io

# Upstream Queue Settings
UPSTREAM_CONCURRENCY=2
UPSTREAM_DELAY_MS=200

# Cache TTL Settings (in milliseconds)
TTL_BOOTSTRAP_MS=900000      # 15 minutes
TTL_HISTORY_MS=300000        # 5 minutes
TTL_PICKS_MS=60000          # 1 minute
TTL_SUMMARY_MS=86400000     # 24 hours

# Stale Cache Settings
STALE_HOURS=12
```

### 3. Upload Proxy Files

Upload these files to your repository:

1. **`proxy-enhanced.js`** - Main proxy server
2. **`package.json`** - Dependencies and scripts
3. **`test-enhanced-proxy.js`** - Test script (optional)

### 4. Deploy and Test

1. **Deploy**: Render will automatically deploy when you push changes
2. **Wait**: First deployment takes 2-3 minutes
3. **Test**: Use the test script to verify functionality

## 🧪 Testing

### Quick Health Check

```bash
curl -i https://your-proxy-url.onrender.com/healthz
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "cache": {
    "size": 0,
    "max": 500
  },
  "queue": {
    "active": 0,
    "pending": 0
  }
}
```

### Full Test Suite

```bash
node test-enhanced-proxy.js
```

### Manual Endpoint Tests

```bash
# Health endpoints
curl https://your-proxy-url.onrender.com/healthz
curl https://your-proxy-url.onrender.com/readyz

# Basic API (should show cache headers)
curl -i https://your-proxy-url.onrender.com/api/bootstrap-static/

# Aggregate endpoints
curl "https://your-proxy-url.onrender.com/api/aggregate/summary?ids=141529,1490173"
curl "https://your-proxy-url.onrender.com/api/aggregate/history?ids=141529,1490173&gw=1"
```

## 🔍 Monitoring

### Health Endpoints

- **`/healthz`** - Detailed health with cache/queue metrics
- **`/readyz`** - Simple readiness check

### Response Headers

Look for these headers in API responses:

- **`X-Proxy-Cache`**: `HIT` (cached) or `MISS` (fresh)
- **`X-Proxy-Stale`**: `1` (serving stale data due to upstream error)
- **`X-Proxy-Upstream-Status`**: Upstream HTTP status or `ERR`
- **`Cache-Control`**: Browser cache directives

### Logs

Monitor Render logs for:

- Cache hits/misses
- Upstream errors
- Rate limiting events
- Queue activity

## ⚙️ Configuration Options

### Cache Settings

```bash
# Increase cache size (default: 500 entries)
CACHE_MAX_ENTRIES=1000

# Adjust TTLs based on data freshness needs
TTL_BOOTSTRAP_MS=1800000    # 30 minutes
TTL_HISTORY_MS=600000       # 10 minutes
TTL_PICKS_MS=120000         # 2 minutes
TTL_SUMMARY_MS=172800000    # 48 hours
```

### Queue Settings

```bash
# Reduce upstream pressure (default: 2 concurrent, 200ms delay)
UPSTREAM_CONCURRENCY=1
UPSTREAM_DELAY_MS=500

# Increase for better performance (if upstream allows)
UPSTREAM_CONCURRENCY=4
UPSTREAM_DELAY_MS=100
```

### Stale Cache

```bash
# How long to serve stale data on upstream errors
STALE_HOURS=24    # 24 hours (default: 12)
```

## 🔄 Updating Frontend

After deploying the enhanced proxy, update your frontend:

1. **Update proxy URL** in `script.js`:

```javascript
const FPL_PROXY_BASE = "https://your-new-proxy-url.onrender.com/api";
```

2. **Optional**: Use aggregate endpoints for better performance:

```javascript
// Instead of individual calls, use batch endpoints
const summaryResponse = await fetch(
  `${FPL_PROXY_BASE}/aggregate/summary?ids=${entryIds.join(",")}`
);
const historyResponse = await fetch(
  `${FPL_PROXY_BASE}/aggregate/history?ids=${entryIds.join(",")}&gw=${gameweek}`
);
```

## 🚨 Troubleshooting

### Common Issues

**1. 502 Bad Gateway**

- Check if upstream FPL API is accessible
- Verify environment variables
- Check Render logs for errors

**2. CORS Errors**

- Verify `ALLOWED_ORIGINS` includes your frontend domain
- Check that frontend is using HTTPS

**3. Rate Limiting**

- Reduce `UPSTREAM_CONCURRENCY`
- Increase `UPSTREAM_DELAY_MS`
- Monitor upstream 429 responses

**4. Cache Not Working**

- Check cache headers in responses
- Verify TTL settings
- Monitor cache size in health endpoint

### Performance Tuning

**High Traffic:**

```bash
UPSTREAM_CONCURRENCY=4
UPSTREAM_DELAY_MS=100
CACHE_MAX_ENTRIES=1000
```

**Conservative (Avoid Rate Limits):**

```bash
UPSTREAM_CONCURRENCY=1
UPSTREAM_DELAY_MS=500
STALE_HOURS=24
```

## 📊 Metrics

Monitor these key metrics:

- **Cache Hit Rate**: `X-Proxy-Cache: HIT` vs `MISS`
- **Stale Serves**: `X-Proxy-Stale: 1` frequency
- **Upstream Errors**: 403/429/5xx responses
- **Queue Depth**: Pending requests in health endpoint
- **Response Times**: Overall proxy latency

## ✅ Success Criteria

Your enhanced proxy is working correctly when:

1. ✅ `/healthz` returns 200 with cache/queue metrics
2. ✅ `/api/bootstrap-static/` returns 200 with cache headers
3. ✅ Aggregate endpoints return batch data
4. ✅ Second request to same endpoint shows `X-Proxy-Cache: HIT`
5. ✅ Upstream errors serve stale data with `X-Proxy-Stale: 1`
6. ✅ No CORS errors from frontend
7. ✅ Rate limiting prevents upstream overload

## 🔗 Next Steps

1. **Deploy** the enhanced proxy
2. **Test** all endpoints
3. **Update** frontend proxy URL
4. **Monitor** performance and logs
5. **Optimize** settings based on usage patterns

The enhanced proxy will significantly improve reliability and performance for your FPL application! 🚀
