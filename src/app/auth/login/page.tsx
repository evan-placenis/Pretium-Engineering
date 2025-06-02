import { Suspense } from 'react';
import LoginPage from './login_page';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPage />
    </Suspense>
  );
}