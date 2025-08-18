'use client';

import LoginPage from './login_page';
import { Suspense } from 'react';

export default function Login() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPage />
    </Suspense>
  );
}