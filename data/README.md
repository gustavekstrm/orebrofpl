# FPL Data Directory

This directory contains FPL data synced by GitHub Actions to avoid CORS issues.

## Files

- `bootstrap-static.json` - FPL bootstrap data (events, teams, players)
- `entry-histories.json` - Entry history data for all participants
- `summary.json` - Data summary and metadata
- `last-updated.txt` - Timestamp of last sync

## Sync Schedule

Data is automatically synced every 15 minutes during FPL season via GitHub Actions.

## Usage

The frontend automatically falls back to this data when direct FPL API calls fail due to CORS restrictions.

## Manual Trigger

To manually sync data, go to Actions > FPL Data Sync > Run workflow in the GitHub repository.
