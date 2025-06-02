'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Project } from '@/lib/supabase';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [projectFilter, setProjectFilter] = useState<'all' | 'mine'>('all');
  const router = useRouter();

  useEffect(() => {
    // Check for user authentication
    const checkUser = async () => {
      console.log('Dashboard: Checking user session');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('Dashboard: User authenticated:', session.user.email);
          setUser(session.user);
          fetchProjects(session.user.id);
        } else {
          console.log('Dashboard: No user session found, redirecting to login');
          router.push('/auth/login');
        }
      } catch (error) {
        console.error('Authentication error:', error);
        router.push('/auth/login');
      }
    };

    checkUser();
  }, [router]);

  const fetchProjects = async (userId: string) => {
    setLoading(true);
    console.log(`Dashboard: Fetching projects for user ID: ${userId}`);
    
    try {
      // Add a retry mechanism
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;
      let data = null;
      let fetchError = null;
      
      while (attempts < maxAttempts && !success) {
        attempts++;
        try {
          console.log(`Attempt ${attempts} to fetch projects`);
          
          // Fetch ALL projects (not just user's own)
          const response = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (response.error) {
            fetchError = response.error;
            console.error(`Attempt ${attempts} failed:`, response.error);
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            data = response.data;
            success = true;
          }
        } catch (err) {
          fetchError = err;
          console.error(`Attempt ${attempts} exception:`, err);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!success) {
        console.error('All attempts to fetch projects failed:', fetchError);
        // Handle the error but don't throw - we'll just show empty state
        setAllProjects([]);
        setProjects([]);
      } else {
        console.log(`Dashboard: Found ${data?.length || 0} projects`);
        setAllProjects(data || []);
        // Apply current filter
        applyProjectFilter(data || [], projectFilter, userId);
      }
    } catch (error) {
      console.error('Unexpected error in fetchProjects:', error);
      // Set empty projects on error rather than crashing
      setAllProjects([]);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const applyProjectFilter = (projectsData: Project[], filter: 'all' | 'mine', userId: string) => {
    if (filter === 'mine') {
      setProjects(projectsData.filter(project => project.user_id === userId));
    } else {
      setProjects(projectsData);
    }
  };

  const handleFilterChange = (filter: 'all' | 'mine') => {
    setProjectFilter(filter);
    if (user) {
      applyProjectFilter(allProjects, filter, user.id);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
      router.push('/auth/login');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: "1rem" }} className="text-secondary">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <>
      {/* Main Content */}
      <div className="container page-content">
        <header style={{ display: "flex", marginBottom: "1.5rem", justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem', color: 'var(--color-text-light)' }}>
                Hello, {user?.email?.split('@')[0] || user?.user_metadata?.full_name || 'User'}!
              </span>
            </div>
            <h1>Active Projects</h1>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => handleFilterChange('all')}
                className={`btn btn-sm ${projectFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              >
                All Projects ({allProjects.length})
              </button>
              <button
                onClick={() => handleFilterChange('mine')}
                className={`btn btn-sm ${projectFilter === 'mine' ? 'btn-primary' : 'btn-secondary'}`}
              >
                My Projects ({allProjects.filter(p => p.user_id === user?.id).length})
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link href="/projects/new" className="btn btn-primary">New Project</Link>
          </div>
        </header>

        {projects.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: "center" }}>
              <div style={{ width: '100px', height: '100px', margin: '0 auto 1.5rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-text-lighter)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 style={{ marginBottom: "0.5rem" }}>No projects yet</h2>
              <p style={{ marginBottom: "1rem" }} className="text-secondary">
                Get started by creating a new project for your reports.
              </p>
              <Link href="/projects/new" className="btn btn-primary">
                Create New Project
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="card" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                textDecoration: 'none',
                background: '#f9fafb',
                borderRadius: '1rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                padding: '2.5rem 1.5rem',
                border: '1px solid #e5e7eb',
                minHeight: '120px',
                transition: 'box-shadow 0.18s, transform 0.18s',
                cursor: 'pointer',
                height: '100%',
              }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
              >
                <div style={{ width: '48px', height: '48px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: '#2b579a' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: '1.75rem',
                  color: '#2b579a',
                  letterSpacing: '0.01em',
                  textAlign: 'center',
                  width: '100%',
                  lineHeight: 1.2,
                  maxWidth: '90%',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                  marginBottom: '1.5rem',
                }}>{project.project_name}</h3>
                <div className="card-body">
                  <h3 style={{ marginBottom: "0.5rem" }}>{project.name}</h3>
                  <p style={{ marginBottom: "1rem", fontSize: "0.875rem" }} className="text-secondary">
                    <strong>Company:</strong> {project["Client Company Name"]}
                  </p>
                  <p style={{ marginBottom: "0.25rem", fontSize: "0.875rem" }} className="text-secondary">
                    <strong>Title:</strong> {project["Project Title"]}
                  </p>
                  
                  <div style={{ marginTop: "0.5rem", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-secondary">
                      View Reports
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                      {project.user_id === user?.id ? 'Your project' : 'Shared project'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
} 