import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// Replace with your Firebase project config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export async function sendOTP(phone: string, recaptchaContainerId: string) {
  const recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
    size: 'invisible',
  });
  // Format Saudi phone
  let formatted = phone.replace(/[\s-]/g, '');
  if (formatted.startsWith('0')) formatted = '+966' + formatted.slice(1);
  if (!formatted.startsWith('+')) formatted = '+' + formatted;

  const confirmationResult = await signInWithPhoneNumber(auth, formatted, recaptchaVerifier);
  return confirmationResult;
}
