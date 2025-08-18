import ResetPasswordPage from './reset_password_page';
import { Suspense } from 'react';

export default function ResetPassword() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordPage />
    </Suspense>
  );
}
