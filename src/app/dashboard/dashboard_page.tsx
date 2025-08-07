'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Project } from '@/lib/supabase';
import { useViewPreference } from '@/hooks/useViewPreference';
import { getBuildingImage } from '@/lib/image-utils';


export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [projectFilter, setProjectFilter] = useState<'all' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const router = useRouter();
  
  // Use the view preference hook for persistent view state
  const { viewMode, toggleViewMode } = useViewPreference('dashboard-projects');

  useEffect(() => {
    // Set up auth state listener to handle auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Dashboard: Auth state changed:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('Dashboard: User authenticated:', session.user.email);
          setUser(session.user);
          fetchProjects(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          console.log('Dashboard: User signed out, redirecting to login');
          setUser(null);
          setProjects([]);
          setAllProjects([]);
          router.push('/auth/login');
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      }
    );

    // Initial session check (only once)
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log('Dashboard: Initial session found:', session.user.email);
          setUser(session.user);
          fetchProjects(session.user.id);
        } else {
          console.log('Dashboard: No initial session found, redirecting to login');
          router.push('/auth/login');
        }
      } catch (error) {
        console.error('Dashboard: Authentication error:', error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    checkInitialSession();

    // Cleanup subscription
    return () => subscription.unsubscribe();
  }, [router]);

  const fetchProjects = async (userId: string) => {
    setLoading(true);
    console.log(`Dashboard: Fetching projects for user ID: ${userId}`);
    
    try {
      // Add a retry mechanism
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;
      let data: any = null;
      let fetchError: any = null;
      
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
        setAllProjects([] as Project[]);
        setProjects([] as Project[]);
      } else {
        console.log(`Dashboard: Found ${data?.length || 0} projects`);
        setAllProjects(data || [] as Project[]);
        // Apply current filter
        applyProjectFilter(data || [] as Project[], projectFilter, userId);
      }
          } catch (error) {
        console.error('Unexpected error in fetchProjects:', error);
        // Set empty projects on error rather than crashing
        setAllProjects([] as Project[]);
        setProjects([] as Project[]);
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

  // Filter projects based on search query
  useEffect(() => {
    let filtered = [...projects];
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(project => 
        project.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project["Client Company Name"]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project["Project Title"]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project["Client Contact Name"]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project["Client Address 1"]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project["Client Address 2"]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project["Name"]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project["Project No."]?.toLowerCase().includes(searchQuery.toLowerCase())
        
      );
    }
    
    setFilteredProjects(filtered);
  }, [projects, searchQuery]);

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
                className={projectFilter === 'all' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                onClick={() => handleFilterChange('all')}
              >
                All Projects ({allProjects.length})
              </button>
              <button
                className={projectFilter === 'mine' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                onClick={() => handleFilterChange('mine')}
              >
                My Projects ({allProjects.filter(p => p.user_id === user?.id).length})
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link href="/projects/new">
              <button className="btn btn-primary">New Project</button>
            </Link>
          </div>
        </header>

        {/* Search Controls */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-body">
            <h3 style={{ marginBottom: '1rem' }}>Search Projects</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'start' }}>
              <div>
                <label className="form-label">Search Projects</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by project name, company, or title..."
                  className="form-input"
                />
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSearchQuery('')}
                style={{ marginTop: '2.35rem'}}
              >
                Clear Search
              </button>
            </div>
            <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-light)' }}>
              Showing {filteredProjects.length} of {projects.length} projects
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleViewMode}
          >
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </button>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: "center" }}>
              <div style={{ width: '100px', height: '100px', margin: '0 auto 1.5rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-text-lighter)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 style={{ marginBottom: "0.5rem" }}>
                {searchQuery ? 'No projects match your search' : 'No projects yet'}
              </h2>
              <p style={{ marginBottom: "1rem" }} className="text-secondary">
                {searchQuery ? 'Try adjusting your search terms.' : 'Get started by creating a new project for your reports.'}
              </p>
              {!searchQuery && (
                <Link href="/projects/new">
                  <button className="btn btn-primary">Create New Project</button>
                </Link>
              )}
            </div>
          </div>
        ) : (
          viewMode === 'grid' ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {filteredProjects.map((project, index) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="card" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  textDecoration: 'none',
                  background: '#f9fafb',
                  borderRadius: '1rem',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  padding: '0.75rem 0.5rem',
                  border: '1px solid #e5e7eb',
                  minHeight: '100px',
                  transition: 'box-shadow 0.18s, transform 0.18s',
                  cursor: 'pointer',
                  height: '100%',
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
                >
                  <div style={{ width: '40px', height: '40px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                      src={getBuildingImage(index)} 
                      alt="Building" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <h3 style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    color: '#2b579a',
                    letterSpacing: '0.01em',
                    textAlign: 'center',
                    width: '100%',
                    lineHeight: 1.2,
                    maxWidth: '90%',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-line',
                    marginBottom: '0rem',
                  }}>{project.project_name}</h3>
                  <div className="card-body">
                    <h3 style={{ marginBottom: "0.25rem", fontSize: "0.9rem" }}>{project.name}</h3>
                    <p style={{ marginBottom: "0.5rem", fontSize: "0.7rem" }} className="text-secondary">
                      <strong>Company:</strong> {project["Client Company Name"]}
                    </p>
                    <p style={{ marginBottom: "0.25rem", fontSize: "0.7rem" }} className="text-secondary">
                      <strong>Title:</strong> {project["Project Title"]}
                    </p>
                    
                    <div style={{ marginTop: "0.25rem" }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                        {project.user_id === user?.id ? 'Your project' : 'Shared project'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredProjects.map((project, index) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="card" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '0.5rem',
                  textDecoration: 'none',
                  transition: 'box-shadow 0.18s, transform 0.18s',
                  cursor: 'pointer'
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
                >
                  <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img 
                      src={getBuildingImage(index)} 
                      alt="Building" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginBottom: "0.25rem", fontSize: '1.25rem', fontWeight: 600, color: '#2b579a' }}>{project.project_name}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                      <span><strong>Company:</strong> {project["Client Company Name"]}</span>
                      <span>•</span>
                      <span><strong>Title:</strong> {project["Project Title"]}</span>
                      <span>•</span>
                      <span>{project.user_id === user?.id ? 'Your project' : 'Shared project'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </>
  );
} 