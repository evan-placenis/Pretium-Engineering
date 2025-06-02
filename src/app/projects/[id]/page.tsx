// app/projects/[id]/page.tsx

import ProjectPage from './projects_page';

interface PageProps {
  params: {
    id: string;
  };
}

export default function Page({ params }: PageProps) {
  return <ProjectPage id={params.id} />;
}