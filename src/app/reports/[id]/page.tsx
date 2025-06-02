
import ReportsPage from './reports_page';

interface PageProps {
  params: {
    id: string;
  };
}

export default function Page({ params }: PageProps) {
  return <ReportsPage id={params.id} />;
}