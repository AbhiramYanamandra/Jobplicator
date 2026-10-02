ADAPTERS = {
    "manual": {
        "status": "ready",
        "mode": "paste",
        "notes": "Paste any job description or source URL.",
    },
    "generic_url": {
        "status": "ready",
        "mode": "public_fetch",
        "notes": "Fetches readable text from public pages only; no login or anti-bot bypass.",
    },
    "greenhouse": {
        "status": "ready",
        "mode": "public_api",
        "notes": "Greenhouse public board API.",
    },
    "lever": {
        "status": "ready",
        "mode": "public_api",
        "notes": "Lever public postings API.",
    },
    "seek": {
        "status": "connector_required",
        "mode": "authorised_provider",
        "notes": "Use manual import, job-alert email, or an authorised connector/provider.",
    },
    "indeed": {
        "status": "connector_required",
        "mode": "authorised_provider",
        "notes": "Use manual import, email alerts, or an authorised provider/API.",
    },
    "linkedin": {
        "status": "connector_required",
        "mode": "authorised_provider",
        "notes": "People/job enrichment should use public search or authorised integration, not brittle scraping.",
    },
    "workday": {
        "status": "site_specific",
        "mode": "adapter_factory",
        "notes": "Workday tenants vary; add tenant-specific public endpoint adapter where available.",
    },
    "company_careers": {
        "status": "ready_via_url",
        "mode": "generic_url",
        "notes": "Use GenericURLAdapter or add a company-specific feed adapter.",
    },
    "email_alerts": {
        "status": "interface_ready",
        "mode": "email_connector",
        "notes": "Connect Gmail/Outlook later and parse job-alert messages into JobPosting objects.",
    },
    "startup_boards": {
        "status": "adapter_factory",
        "mode": "feed_or_url",
        "notes": "Use public feeds/APIs where available, otherwise generic URL import.",
    },
}
