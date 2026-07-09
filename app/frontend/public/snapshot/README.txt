Place the exported `latest.json` file in this directory for hosted snapshot mode.

Public portal will read:
- /snapshot/latest.json

Player private pages will also read:
- /snapshot/latest.json

Recommended Netlify environment variable:
- VITE_PORTAL_SNAPSHOT_URL=https://your-bucket.example.com/snapshot/latest.json
