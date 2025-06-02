'use client';

import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="container page-content" style={{ maxWidth: "800px", padding: "2rem" , marginTop: "4rem"}}>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ marginBottom: "0.5rem", display: "flex" }}>
          <Link
            href="/dashboard"
            className="mr-2 text-accent"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <h1 style={{ marginBottom: "0.5rem" }}>Upload</h1>
        <p className="text-secondary">
          Manage your application settings and configurations
        </p>
      </div>

      <div className="grid" style={{ gap: "1rem" }}>
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: "0.5rem" }}>Report Templates</h3>
            <p className="text-secondary" style={{ marginBottom: "1rem" }}>
              Upload and manage report templates used for generating reports
            </p>
            <Link href="/settings/templates" className="btn btn-primary">
              Manage Templates
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: "0.5rem" }}>Training Documents</h3>
            <p className="text-secondary" style={{ marginBottom: "1rem" }}>
              Manage training documents used for AI report generation
            </p>
            <Link href="/settings/training" className="btn btn-primary">
              Manage Training
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 