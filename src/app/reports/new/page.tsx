import { Suspense } from 'react';
import NewReportPage from './new_report_page';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewReportPage />
    </Suspense>
  );
}