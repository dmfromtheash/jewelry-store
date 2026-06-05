# Security Checklist

- Do not commit secrets.
- Keep `.env` ignored.
- Do not connect real payments before a dedicated audit.
- Validate prices server-side in future backend work.
- Treat auth, admin, and checkout as high-risk areas.
- Validate and restrict uploads if uploads are added later.
- Avoid exposing private customer or order data.
- Review dependencies before adding them.

